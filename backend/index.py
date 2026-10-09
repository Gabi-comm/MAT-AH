"""SQLite index: schema, connection helper and the in-memory vector store."""
import os
import sqlite3
import threading
from pathlib import Path

import numpy as np

DB_PATH = Path(os.environ.get("MATAH_DB", Path(__file__).resolve().parent.parent / "data" / "matah.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS roots(id INTEGER PRIMARY KEY, path TEXT UNIQUE, added_at TEXT);
CREATE TABLE IF NOT EXISTS files(id INTEGER PRIMARY KEY, root_id INT, path TEXT UNIQUE, name TEXT,
  ext TEXT, kind TEXT, size INT, mtime REAL, sha256 TEXT, taken_at TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS chunks(id INTEGER PRIMARY KEY, file_id INT, text TEXT, locator TEXT);
CREATE INDEX IF NOT EXISTS chunks_file ON chunks(file_id);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(chunk_id UNINDEXED, text, name, notes,
  tokenize = 'unicode61 remove_diacritics 2');
CREATE TABLE IF NOT EXISTS vectors(chunk_id INTEGER PRIMARY KEY, model TEXT, dim INT, vec BLOB);
CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY, file_id INT, text TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS proposals(id INTEGER PRIMARY KEY, request TEXT, plan_json TEXT,
  status TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS operations(id INTEGER PRIMARY KEY, proposal_id INT, op TEXT, src TEXT,
  dst TEXT, status TEXT, error TEXT, done_at TEXT, undone_at TEXT);
"""

_lock = threading.RLock()


def connect(path: Path | None = None) -> sqlite3.Connection:
    p = Path(path or DB_PATH)
    p.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(p, check_same_thread=False, isolation_level=None)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA busy_timeout=8000")
    con.executescript(SCHEMA)
    return con


def delete_file_rows(con: sqlite3.Connection, file_id: int) -> None:
    ids = [r[0] for r in con.execute("SELECT id FROM chunks WHERE file_id=?", (file_id,))]
    if ids:
        q = ",".join("?" * len(ids))
        con.execute(f"DELETE FROM chunks_fts WHERE chunk_id IN ({q})", ids)
        con.execute(f"DELETE FROM vectors WHERE chunk_id IN ({q})", ids)
    con.execute("DELETE FROM chunks WHERE file_id=?", (file_id,))
    VECTORS.remove(ids)


class VectorStore:
    """All chunk vectors as one normalized float32 matrix; search is one mat-vec product."""

    def __init__(self):
        self.ids = np.zeros(0, dtype=np.int64)
        self.mat = np.zeros((0, 0), dtype=np.float32)

    def load(self, con: sqlite3.Connection) -> None:
        rows = con.execute("SELECT chunk_id, dim, vec FROM vectors").fetchall()
        with _lock:
            if not rows:
                self.ids, self.mat = np.zeros(0, dtype=np.int64), np.zeros((0, 0), dtype=np.float32)
                return
            self.ids = np.array([r[0] for r in rows], dtype=np.int64)
            self.mat = np.stack([np.frombuffer(r[2], dtype=np.float32) for r in rows])

    def add(self, chunk_ids: list[int], vecs: np.ndarray) -> None:
        if not chunk_ids:
            return
        with _lock:
            if self.mat.size == 0:
                self.ids, self.mat = np.array(chunk_ids, dtype=np.int64), vecs.astype(np.float32)
            else:
                self.ids = np.concatenate([self.ids, np.array(chunk_ids, dtype=np.int64)])
                self.mat = np.vstack([self.mat, vecs.astype(np.float32)])

    def remove(self, chunk_ids: list[int]) -> None:
        if not chunk_ids or self.ids.size == 0:
            return
        with _lock:
            keep = ~np.isin(self.ids, chunk_ids)
            self.ids, self.mat = self.ids[keep], self.mat[keep]

    def search(self, qvec: np.ndarray, k: int = 50) -> list[tuple[int, float]]:
        with _lock:
            if self.ids.size == 0 or qvec.shape[0] != self.mat.shape[1]:
                return []
            scores = self.mat @ qvec
            k = min(k, scores.shape[0])
            top = np.argpartition(-scores, k - 1)[:k]
            top = top[np.argsort(-scores[top])]
            return [(int(self.ids[i]), float(scores[i])) for i in top]

    def __len__(self):
        return int(self.ids.size)


VECTORS = VectorStore()


def normalize(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    n[n == 0] = 1
    return (v / n).astype(np.float32)
