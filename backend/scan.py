"""Indexing pipeline for whole-computer use, in phases so search is useful within minutes:

1. listing   — walk every authorized folder; every file becomes findable by name and folder at once
2. reading   — open files by priority (documents → images → video/audio, newest first): text, OCR, speech
3. seeing    — CLIP vectors for images and video keyframes (visual search)
4. embedding — meaning vectors for any chunk still missing one
5. describing— optional captions from a local vision model for images (gemma4 etc.), newest first

Search and Sagot work during every phase; Sagot also reads a not-yet-read file on demand."""
import json
import os
import queue
import stat
import threading
import time
from pathlib import Path

from . import llm, media, visual
from .chunk import chunk, name_words
from .extract import extract, kind_of, ocr_image, readable
from .folders import root_for, roots
from .index import DB_PATH, VECTORS, VISUAL, delete_file_rows

# Folders that are never personal documents: dependencies, caches, build output, system and app data.
SKIP_DIRS = {
    ".git", ".svn", ".hg", "node_modules", "bower_components", "__pycache__", ".venv", "venv", "env",
    "site-packages", ".tox", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".next", ".nuxt", ".turbo",
    ".cache", ".npm", ".yarn", ".pnpm-store", ".gradle", ".m2", ".nuget", ".cargo", ".rustup", ".vscode",
    ".idea", ".vs", ".ollama", ".conda", "anaconda3", "miniconda3", ".android", ".docker", ".expo",
    "AppData", "Application Data", "Local Settings", "$RECYCLE.BIN", "System Volume Information",
    "Windows", "Program Files", "Program Files (x86)", "ProgramData", "dist", "build", "out", "target",
    ".remember", ".claude", "OneDriveTemp",
}
DATA_DIR = DB_PATH.parent.resolve()
REPO_DEMO = (Path(__file__).resolve().parent.parent / "demo_data").resolve()  # MAT-AH's own test fixtures
NEVER = {DATA_DIR, REPO_DEMO}
READ_ORDER = {"pdf": 0, "docx": 0, "pptx": 0, "sheet": 0, "text": 1, "image": 2, "audio": 3, "video": 4}
EMBED_NOW_MAX = 150  # chunks; larger files get meaning vectors in the later embedding phase
CAPTION_LIMIT = int(os.environ.get("MATAH_CAPTION_LIMIT", "150"))  # per indexing run; 0 disables

progress = {"running": False, "phase": "idle", "listed": 0, "total": 0, "done": 0, "current": "",
            "errors": [], "started": 0.0, "finished": 0.0, "embedded": 0, "seen": 0, "described": 0,
            "embed_skipped": False, "stop": False}
_run_lock = threading.Lock()
_write_lock = threading.Lock()  # one writer at a time across the indexer and on-demand reads


def _err(msg: str) -> None:
    progress["errors"] = (progress["errors"] + [msg])[-30:]


def _skip_dir(entry: os.DirEntry) -> bool:
    if entry.name in SKIP_DIRS or entry.name.startswith("."):
        return True
    try:
        if Path(entry.path).resolve() in NEVER:
            return True
    except OSError:
        return True
    return os.path.exists(os.path.join(entry.path, "pyvenv.cfg"))  # any Python virtualenv


def _hidden(entry: os.DirEntry) -> bool:
    if entry.name.startswith("~$") or entry.name.lower() in ("desktop.ini", "thumbs.db"):
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
                    try:
                        if e.is_dir(follow_symlinks=False):
                            if not _skip_dir(e):
                                stack.append(Path(e.path))
                        elif e.is_file(follow_symlinks=False):
                            yield Path(e.path), e.stat()
                    except OSError:
                        continue
        except OSError:
            continue


# ---------------------------------------------------------------- phase 1: listing

def _name_chunk(con, fid: int, p: Path, notes: str = "") -> None:
    names = name_words(p)
    cid = con.execute("INSERT INTO chunks(file_id, text, locator) VALUES(?,?,?)", (fid, names, "{}")).lastrowid
    con.execute("INSERT INTO chunks_fts(chunk_id, text, name, notes) VALUES(?,?,?,?)", (cid, "", names, notes))


def upsert_listing(con, root_id: int, p: Path, size: int, mtime: float, existing_id: int | None) -> int:
    """Record a file by name/metadata and queue it for reading if its content is worth reading."""
    kind = kind_of(p)
    status = "queued" if readable(kind, size) else "meta"
    if existing_id:
        delete_file_rows(con, existing_id)
        con.execute("UPDATE files SET size=?, mtime=?, kind=?, status=?, sha256=NULL, described=0, root_id=? "
                    "WHERE id=?", (size, mtime, kind, status, root_id, existing_id))
        fid = existing_id
    else:
        fid = con.execute("INSERT INTO files(root_id, path, name, ext, kind, size, mtime, status) "
                          "VALUES(?,?,?,?,?,?,?,?)",
                          (root_id, str(p), p.name, p.suffix.lower(), kind, size, mtime, status)).lastrowid
    notes = " ".join(r[0] for r in con.execute("SELECT text FROM notes WHERE file_id=?", (fid,)))
    _name_chunk(con, fid, p, notes)
    return fid


def list_files(con) -> None:
    progress.update(phase="listing", current="looking through your folders…", listed=0)
    known = {r[1].lower(): (r[0], r[2], r[3]) for r in con.execute("SELECT id, path, size, mtime FROM files")}
    seen: set[str] = set()
    pending: list[tuple] = []

    def flush():
        with _write_lock:  # one short transaction per batch, so on-demand reads never wait long
            con.execute("BEGIN")
            try:
                for args in pending:
                    upsert_listing(con, *args)
                con.execute("COMMIT")
            except Exception:
                con.execute("ROLLBACK")
                raise
        pending.clear()

    for r in roots(con):
        for p, st in walk(Path(r["path"])):
            if progress["stop"]:
                break
            key = str(p).lower()
            if key in seen:  # nested roots
                continue
            seen.add(key)
            progress["listed"] += 1
            old = known.get(key)
            if old and old[1] == st.st_size and abs((old[2] or 0) - st.st_mtime) < 1e-6:
                continue
            pending.append((r["id"], p, st.st_size, st.st_mtime, old[0] if old else None))
            if len(pending) >= 500:
                progress["current"] = str(p.parent)
                flush()
    if pending:
        flush()
    if not progress["stop"]:
        gone = [v[0] for k, v in known.items() if k not in seen]
        with _write_lock:
            con.execute("BEGIN")
            for fid in gone:
                delete_file_rows(con, fid)
                con.execute("DELETE FROM files WHERE id=?", (fid,))
            con.execute("COMMIT")


# ---------------------------------------------------------------- phase 2: reading

def _store_chunks(con, fid: int, p: Path, chunks: list[dict]) -> list[tuple[int, str]]:
    notes = " ".join(r[0] for r in con.execute("SELECT text FROM notes WHERE file_id=?", (fid,)))
    names = name_words(p)
    out = []
    for c in chunks:
        cid = con.execute("INSERT INTO chunks(file_id, text, locator) VALUES(?,?,?)",
                          (fid, c["text"], json.dumps(c["locator"]))).lastrowid
        con.execute("INSERT INTO chunks_fts(chunk_id, text, name, notes) VALUES(?,?,?,?)",
                    (cid, c["text"], names, notes))
        out.append((cid, c["text"]))
    return out


def _store_visual(con, fid: int, items: list[tuple[float | None, object]]) -> None:
    if not items or not visual.ready():
        return
    vecs = visual.embed_images([im for _, im in items])
    ids = []
    for (t, _), v in zip(items, vecs):
        ids.append(con.execute("INSERT INTO visual(file_id, t, model, vec) VALUES(?,?,?,?)",
                               (fid, t, visual.MODEL, v.tobytes())).lastrowid)
    VISUAL.add(ids, vecs)
    progress["seen"] += len(ids)


def read_file(con, fid: int, embed: bool | None = None) -> bool:
    """Open one queued file and index its content. Safe to call on demand (Sagot) or from the indexer."""
    with _write_lock:  # claim it, so the indexer and the priority reader never read the same file twice
        claimed = con.execute("UPDATE files SET status='reading' WHERE id=? AND status IN ('queued','error')",
                              (fid,)).rowcount
    if not claimed:
        return False
    row = con.execute("SELECT * FROM files WHERE id=?", (fid,)).fetchone()
    p = Path(row["path"])
    if not p.exists():
        with _write_lock:
            con.execute("UPDATE files SET status='error' WHERE id=?", (fid,))
        return False
    kind = row["kind"]
    embed = llm.embed_available() if embed is None else embed
    taken, frames = None, []
    try:
        if kind == "video":
            frames, _ = media.keyframes(p)
            units = []
            for t, im in frames[:: max(1, len(frames) // 8)][:8]:  # on-screen text from a few frames
                import numpy as np
                txt, _ = ocr_image(np.asarray(im))
                if len(txt) > 15:
                    units.append({"text": txt, "locator": {"t": t}})
            units += media.transcribe(p)
        elif kind == "audio":
            units = media.transcribe(p)
        elif kind == "image" and in_bulk(p):  # dataset image: it gets seen (CLIP), not read (OCR)
            units = []
        else:
            kind, units, taken = extract(p)
        status = "ok"
    except Exception as e:
        units, status = [], "error"
        _err(f"{p.name}: {e.__class__.__name__}: {str(e)[:120]}")
    chunks = chunk(p, kind, units)
    with _write_lock:
        con.execute("BEGIN")
        try:
            delete_file_rows(con, fid)
            con.execute("UPDATE files SET taken_at=?, status=? WHERE id=?", (taken, status, fid))
            items = _store_chunks(con, fid, p, chunks)
            if kind == "image" and status == "ok":
                from PIL import Image
                with Image.open(p) as im:
                    im.thumbnail((640, 640))
                    _store_visual(con, fid, [(None, im.copy())])
            elif frames:
                _store_visual(con, fid, frames)
            con.execute("COMMIT")
        except Exception as e:
            con.execute("ROLLBACK")
            _err(f"{p.name}: {e}")
            return False
    if embed and len(items) <= EMBED_NOW_MAX:  # big books wait for the embedding phase; words work already
        try:
            embed_chunks(con, items, name_words(p))
        except Exception as e:
            _err(f"embed {p.name}: {e}")
    return True


def ensure_listed(con, path: str) -> int | None:
    """A file found by Windows Search that MAT-AH hasn't listed yet: add it (inside authorized roots only)."""
    p = Path(path)
    row = con.execute("SELECT id FROM files WHERE path=? COLLATE NOCASE", (str(p),)).fetchone()
    if row:
        return row[0]
    r = root_for(con, p)
    if not r or not p.is_file():
        return None
    st = p.stat()
    with _write_lock:
        return upsert_listing(con, r["id"], p, st.st_size, st.st_mtime, None)


_prio: "queue.Queue[tuple[str, int]]" = queue.Queue()
_prio_thread: list[threading.Thread] = []


def prioritize(con, fids: list[int]) -> None:
    """Read these files next, on a side worker, so a search result fills in with its content."""
    db_file = con.execute("PRAGMA database_list").fetchone()[2]
    if not _prio_thread:
        def worker():
            from .index import connect
            cons = {}
            while True:
                path, fid = _prio.get()
                try:
                    c = cons.get(path) or cons.setdefault(path, connect(Path(path)))
                    read_file(c, fid)
                except Exception as e:
                    _err(f"priority read {fid}: {e}")
        t = threading.Thread(target=worker, daemon=True, name="matah-priority-reader")
        t.start()
        _prio_thread.append(t)
    for f in fids:
        _prio.put((db_file, f))


DATASET_NAMES = {"images", "labels", "train", "valid", "val", "test", "all", "dataset", "data", "frames"}
BULK: set[str] = set()  # folders that are collections (datasets, exports), not personal files


def find_bulk_folders(con) -> set[str]:
    """Folders with hundreds of same-type files are datasets or exports (e.g. 9,000 training images).
    Their text files stay name-only and their images get visual vectors only (no OCR), read last."""
    counts: dict[tuple[str, str], int] = {}
    for path, kind in con.execute("SELECT path, kind FROM files WHERE kind IN ('image','text')"):
        key = (os.path.dirname(path), kind)
        counts[key] = counts.get(key, 0) + 1
    bulk = set()
    for (folder, _), n in counts.items():
        if n >= 300 or (n >= 100 and os.path.basename(folder).lower() in DATASET_NAMES):
            bulk.add(folder.lower())
    return bulk


def in_bulk(path) -> bool:
    return os.path.dirname(str(path)).lower() in BULK


def read_queue(con) -> None:
    BULK.clear()
    BULK.update(find_bulk_folders(con))
    queued_text = [r[0] for r in con.execute("SELECT id, path FROM files WHERE status='queued' AND kind='text'")
                   if in_bulk(r[1])]
    with _write_lock:
        con.executemany("UPDATE files SET status='meta' WHERE id=?", [(i,) for i in queued_text])
    order = " ".join(f"WHEN '{k}' THEN {v}" for k, v in READ_ORDER.items())
    rows = con.execute(f"SELECT id, path, kind FROM files WHERE status='queued' "
                       f"ORDER BY CASE kind {order} ELSE 9 END, mtime DESC").fetchall()
    ids = [r[0] for r in rows if not in_bulk(r[1])] + [r[0] for r in rows if in_bulk(r[1])]
    progress.update(phase="reading", total=len(ids), done=0)
    embed = llm.embed_available()
    progress["embed_skipped"] = not embed
    for fid in ids:
        if progress["stop"]:
            return
        r = con.execute("SELECT name FROM files WHERE id=?", (fid,)).fetchone()
        progress["current"] = r[0] if r else ""
        read_file(con, fid, embed)
        progress["done"] += 1


# ---------------------------------------------------------------- phases 3-5

def embed_chunks(con, items: list[tuple[int, str]], names: str = "", notes: str = "") -> None:
    items = [(cid, t) for cid, t in items if t.strip()]
    if not items:
        return
    texts = [f"{names}\n{notes}\n{t}"[:2000] for _, t in items]
    vecs = llm.embed(texts, "doc")
    with _write_lock:
        for (cid, _), v in zip(items, vecs):
            con.execute("INSERT OR REPLACE INTO vectors(chunk_id, model, dim, vec) VALUES(?,?,?,?)",
                        (cid, llm.EMBED_MODEL, v.shape[0], v.tobytes()))
    VECTORS.add([cid for cid, _ in items], vecs)
    progress["embedded"] += len(items)


def backfill_embeddings(con) -> None:
    """Meaning vectors for read content that has none yet (e.g. Ollama was off while reading)."""
    rows = con.execute("""SELECT c.id, c.text, f.path FROM chunks c JOIN files f ON f.id=c.file_id
                          LEFT JOIN vectors v ON v.chunk_id=c.id
                          WHERE v.chunk_id IS NULL AND f.status='ok' AND c.locator != '{}'""").fetchall()
    progress.update(phase="embedding", total=len(rows), done=0)
    by_file: dict[str, list] = {}
    for r in rows:
        by_file.setdefault(r["path"], []).append((r["id"], r["text"]))
    for path, items in by_file.items():
        if progress["stop"]:
            return
        embed_chunks(con, items, name_words(Path(path)))
        progress["done"] += len(items)


def backfill_visual(con) -> None:
    """CLIP vectors for images/videos read before the visual model was available."""
    if not visual.installed():
        return
    progress.update(phase="seeing", current="loading the visual model…", total=0, done=0)
    while not visual.wait_ready(timeout=2):  # first run downloads the model; pausing still works
        if progress["stop"] or visual.status()["error"]:
            return
    rows = con.execute("""SELECT f.id, f.path, f.kind FROM files f WHERE f.status='ok' AND f.kind IN ('image','video')
                          AND NOT EXISTS (SELECT 1 FROM visual v WHERE v.file_id=f.id) ORDER BY f.mtime DESC""").fetchall()
    progress.update(phase="seeing", total=len(rows), done=0)
    from PIL import Image
    for r in rows:
        if progress["stop"]:
            return
        progress["current"] = Path(r["path"]).name
        try:
            if r["kind"] == "image":
                with Image.open(r["path"]) as im:
                    im.thumbnail((640, 640))
                    items = [(None, im.copy())]
            else:
                items, _ = media.keyframes(r["path"])
            with _write_lock:
                _store_visual(con, r["id"], items)
        except Exception as e:
            _err(f"see {Path(r['path']).name}: {e}")
        progress["done"] += 1


CAPTION_PROMPT = ("Describe this image for a personal file search index in 2-3 short sentences: what it shows, "
                  "any visible text, document type (receipt, ID, screenshot, schedule, photo...), people/places/"
                  "objects. Then a line 'Keywords:' with 8-12 keywords in English and Filipino.")


def describe_images(con, limit: int = CAPTION_LIMIT) -> None:
    if limit <= 0 or not llm.vision_model():
        return
    rows = con.execute("""SELECT id, path FROM files WHERE kind='image' AND status='ok' AND described=0
                          ORDER BY mtime DESC LIMIT ?""", (limit,)).fetchall()
    progress.update(phase="describing", total=len(rows), done=0)
    for r in rows:
        if progress["stop"]:
            return
        p = Path(r["path"])
        progress["current"] = p.name
        try:
            text = llm.describe_image(p, CAPTION_PROMPT)
            if text:
                with _write_lock:
                    items = _store_chunks(con, r["id"], p, [{"text": text, "locator": {"caption": True}}])
                    con.execute("UPDATE files SET described=1 WHERE id=?", (r["id"],))
                if llm.embed_available():
                    embed_chunks(con, items, name_words(p))
                progress["described"] += 1
        except Exception as e:
            _err(f"describe {p.name}: {e}")
            with _write_lock:
                con.execute("UPDATE files SET described=-1 WHERE id=?", (r["id"],))
        progress["done"] += 1


def run(con) -> dict:
    if not _run_lock.acquire(blocking=False):
        return progress
    try:
        progress.update(running=True, stop=False, errors=[], started=time.time(), finished=0.0, embedded=0,
                        seen=0, described=0, done=0, total=0)
        with _write_lock:  # a read cut off by a crash or restart goes back in the queue
            con.execute("UPDATE files SET status='queued' WHERE status='reading'")
        steps = [list_files, read_queue, backfill_visual, backfill_embeddings, describe_images]
        for step in steps:
            if progress["stop"]:
                break
            if step is backfill_embeddings and not llm.embed_available():
                progress["embed_skipped"] = True
                continue
            try:
                step(con)
            except Exception as e:
                _err(f"{step.__name__}: {e}")
        return progress
    finally:
        progress.update(running=False, phase="idle" if progress["stop"] else "done", current="",
                        finished=time.time(), stop=False)
        _run_lock.release()
