"""Walk authorized roots, detect changes, extract + chunk + embed into the index."""
import json
import os
import stat
import threading
import time
from pathlib import Path

from . import llm
from .chunk import chunk, name_words
from .extract import extract, kind_of
from .folders import roots
from .index import VECTORS, delete_file_rows

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "$RECYCLE.BIN", "System Volume Information"}

progress = {"running": False, "total": 0, "done": 0, "current": "", "errors": [], "started": 0.0,
            "finished": 0.0, "embedded": 0, "embed_skipped": False}
_run_lock = threading.Lock()


def _hidden(entry: os.DirEntry) -> bool:
    if entry.name.startswith(".") or entry.name.startswith("~$"):
        return True
    try:
        attrs = entry.stat(follow_symlinks=False).st_file_attributes
        return bool(attrs & (stat.FILE_ATTRIBUTE_HIDDEN | stat.FILE_ATTRIBUTE_SYSTEM))
    except (AttributeError, OSError):
        return False


def walk(root: Path):
    stack = [root]
    while stack:
        d = stack.pop()
        try:
            with os.scandir(d) as it:
                for e in it:
                    if _hidden(e):
                        continue
                    if e.is_dir(follow_symlinks=False):
                        if e.name not in SKIP_DIRS:
                            stack.append(Path(e.path))
                    elif e.is_file(follow_symlinks=False):
                        yield Path(e.path), e.stat()
        except OSError:
            continue


def plan(con) -> tuple[list[tuple], list[int]]:
    """Returns (queue of (root_id, path, st, existing_id), ids of files that vanished)."""
    queue, seen = [], set()
    known = {r["path"]: r for r in con.execute("SELECT id, path, size, mtime FROM files")}
    for r in roots(con):
        for p, st in walk(Path(r["path"])):
            sp = str(p)
            seen.add(sp)
            old = known.get(sp)
            if old and old["size"] == st.st_size and abs(old["mtime"] - st.st_mtime) < 1e-6:
                continue
            queue.append((r["id"], p, st, old["id"] if old else None))
    gone = [r["id"] for sp, r in known.items() if sp not in seen]
    return queue, gone


def index_one(con, root_id: int, p: Path, st, existing_id: int | None, embed: bool) -> int:
    kind = kind_of(p)
    try:
        kind, units, taken = extract(p)
        status = "ok"
    except Exception as e:  # corrupt or locked file: keep it findable by name
        units, taken, status = [], None, f"error: {e.__class__.__name__}"
    chunks = chunk(p, kind, units)
    if existing_id:
        delete_file_rows(con, existing_id)
        con.execute("UPDATE files SET size=?, mtime=?, kind=?, taken_at=?, status=?, sha256=NULL WHERE id=?",
                    (st.st_size, st.st_mtime, kind, taken, status, existing_id))
        fid = existing_id
    else:
        cur = con.execute(
            "INSERT INTO files(root_id, path, name, ext, kind, size, mtime, taken_at, status) VALUES(?,?,?,?,?,?,?,?,?)",
            (root_id, str(p), p.name, p.suffix.lower(), kind, st.st_size, st.st_mtime, taken, status))
        fid = cur.lastrowid
    notes = " ".join(r[0] for r in con.execute("SELECT text FROM notes WHERE file_id=?", (fid,)))
    names = name_words(p)
    new_ids = []
    for c in chunks:
        cid = con.execute("INSERT INTO chunks(file_id, text, locator) VALUES(?,?,?)",
                          (fid, c["text"], json.dumps(c["locator"]))).lastrowid
        con.execute("INSERT INTO chunks_fts(chunk_id, text, name, notes) VALUES(?,?,?,?)",
                    (cid, c["text"], names, notes))
        new_ids.append((cid, c["text"]))
    if embed:
        embed_chunks(con, new_ids, names, notes)
    return fid


def embed_chunks(con, items: list[tuple[int, str]], names: str = "", notes: str = "") -> None:
    if not items:
        return
    texts = [f"{names}\n{notes}\n{t}"[:2000] for _, t in items]
    vecs = llm.embed(texts, "doc")
    for (cid, _), v in zip(items, vecs):
        con.execute("INSERT OR REPLACE INTO vectors(chunk_id, model, dim, vec) VALUES(?,?,?,?)",
                    (cid, llm.EMBED_MODEL, v.shape[0], v.tobytes()))
    VECTORS.add([cid for cid, _ in items], vecs)
    progress["embedded"] += len(items)


def backfill_embeddings(con) -> None:
    """Embed chunks indexed while the embedding model was unavailable."""
    rows = con.execute("""SELECT c.id, c.text, f.path FROM chunks c JOIN files f ON f.id=c.file_id
                          LEFT JOIN vectors v ON v.chunk_id=c.id WHERE v.chunk_id IS NULL""").fetchall()
    by_file: dict[str, list] = {}
    for r in rows:
        by_file.setdefault(r["path"], []).append((r["id"], r["text"]))
    for path, items in by_file.items():
        embed_chunks(con, items, name_words(Path(path)))


def run(con) -> dict:
    if not _run_lock.acquire(blocking=False):
        return progress
    try:
        progress.update(running=True, done=0, total=0, errors=[], started=time.time(), finished=0.0,
                        embedded=0, current="scanning…")
        embed = llm.embed_available()
        progress["embed_skipped"] = not embed
        queue, gone = plan(con)
        for fid in gone:
            delete_file_rows(con, fid)
            con.execute("DELETE FROM files WHERE id=?", (fid,))
        progress["total"] = len(queue)
        for root_id, p, st, existing in queue:
            progress["current"] = p.name
            try:
                con.execute("BEGIN")
                index_one(con, root_id, p, st, existing, embed)
                con.execute("COMMIT")
            except Exception as e:
                con.execute("ROLLBACK")
                progress["errors"].append(f"{p.name}: {e}")
            progress["done"] += 1
        if embed:
            progress["current"] = "embedding backlog…"
            try:
                backfill_embeddings(con)
            except Exception as e:
                progress["errors"].append(f"embeddings: {e}")
        return progress
    finally:
        progress.update(running=False, current="", finished=time.time())
        _run_lock.release()
