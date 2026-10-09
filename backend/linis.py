"""Linis: exact duplicates, zero-byte files and empty folders. Report only — actions go through Kilos."""
import hashlib
import os
import threading
from pathlib import Path

from .folders import guard, roots
from .scan import SKIP_DIRS

# Listing is the folder walk; comparing is the SHA-256 read of same-size files (the slow part).
# The walk has no known end, so listing approaches this cap instead of stopping at a fixed percent.
_LIST_CAP = 85
_lock = threading.Lock()
_progress = {"phase": "idle", "done": 0, "total": 0, "listed": 0, "percent": 0, "run": 0}
_gate = threading.Lock()
_job: dict | None = None


def progress() -> dict:
    with _lock:
        return dict(_progress)


def _set(*, phase: str, percent: float, listed: int, done: int = 0, total: int = 0, new_run: bool = False) -> None:
    with _lock:
        percent = round(max(0.0, min(100.0, float(percent))), 1)
        # A second caller must not pull the bar backwards mid-scan.
        if not new_run and phase in ("listing", "comparing") and percent < _progress["percent"]:
            percent = _progress["percent"]
        if new_run:
            _progress["run"] = _progress.get("run", 0) + 1
        _progress.update(phase=phase, percent=percent, listed=listed, done=done, total=total)


def _hash_file(path: Path, on_read=None) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            block = f.read(1 << 20)
            if not block:
                break
            h.update(block)
            if on_read:
                on_read(len(block))
    return h.hexdigest()


def sha256(path: Path, on_read=None, timeout: float = 20) -> str | None:
    """Hash a file. A file that does not read within timeout is skipped so one locked file cannot freeze the scan."""
    if timeout <= 0:
        try:
            return _hash_file(path, on_read)
        except OSError:
            return None
    box: dict = {}

    def work() -> None:
        try:
            box["v"] = _hash_file(path, on_read)
        except OSError as exc:
            box["e"] = exc

    t = threading.Thread(target=work, daemon=True)
    t.start()
    t.join(timeout)
    if t.is_alive() or "e" in box:
        return None
    return box.get("v")


def _indexed_count(con, bases: list[Path]) -> int:
    """Files already listed in the index, used so the bar can move during the walk."""
    prefixes = [str(b) for b in bases]
    try:
        rows = con.execute("SELECT path FROM files").fetchall()
    except Exception:
        return 0
    n = 0
    for (path,) in rows:
        for prefix in prefixes:
            if path == prefix or path.startswith(prefix + "\\") or path.startswith(prefix + "/"):
                n += 1
                break
    return n


def scan(con, root_id: int | None = None, subpath: str | None = None) -> dict:
    """subpath narrows the scan to one folder inside an authorized root (e.g. Downloads)."""
    if subpath:
        bases = [guard(con, subpath)]
    else:
        bases = [Path(r["path"]) for r in roots(con) if root_id is None or r["id"] == root_id]
    by_size: dict[int, list[Path]] = {}
    zero, empty_dirs = [], []
    _set(phase="listing", percent=0, listed=0, done=0, total=0, new_run=True)
    expected = _indexed_count(con, bases)
    listed = 0
    _set(phase="listing", percent=0, listed=0, done=0, total=expected)

    def tick_list() -> None:
        # Approaches _LIST_CAP as more files are counted, including after the
        # indexed estimate is passed, so the bar keeps moving on a long walk.
        scale = max(expected, 2000)
        pct = int(_LIST_CAP * listed / (listed + scale)) if listed else 0
        _set(phase="listing", percent=min(_LIST_CAP - 1, pct), listed=listed, done=listed, total=max(expected, listed))

    for base in bases:
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
            p = Path(dirpath)
            if p != base and not dirnames and not filenames:
                empty_dirs.append(p)
            for fn in filenames:
                fp = p / fn
                try:
                    size = fp.stat().st_size
                except OSError:
                    continue
                listed += 1
                if listed % 40 == 0:
                    tick_list()
                if size == 0:
                    zero.append(fp)
                else:
                    by_size.setdefault(size, []).append(fp)
    tick_list()
    hash_bytes = sum(size * len(paths) for size, paths in by_size.items() if len(paths) > 1)
    read = 0
    last_pct = -1

    def on_read(n: int) -> None:
        nonlocal read, last_pct
        read += n
        if hash_bytes <= 0:
            return
        span = max(1, 99 - list_end)
        pct = min(99.0, list_end + span * min(read, hash_bytes) / hash_bytes)
        if abs(pct - last_pct) >= 0.1 or read - int(_progress["done"]) >= (8 << 20):
            last_pct = pct
            _set(phase="comparing", percent=pct, listed=listed, done=read, total=hash_bytes)

    list_end = progress()["percent"]
    if hash_bytes:
        _set(phase="comparing", percent=list_end, listed=listed, done=0, total=hash_bytes)
    dup_groups = []
    for size, paths in by_size.items():
        if len(paths) < 2:
            continue
        by_hash: dict[str, list[Path]] = {}
        for fp in paths:
            gate = {"on": True}

            def one_read(n: int, gate=gate) -> None:
                if gate["on"]:
                    on_read(n)

            digest = sha256(fp, one_read)
            if not digest:
                gate["on"] = False
                continue
            by_hash.setdefault(digest, []).append(fp)
        for digest, same in by_hash.items():
            if len(same) > 1:
                same.sort(key=lambda x: (x.stat().st_mtime, len(str(x))))  # keep the oldest, shortest path
                dup_groups.append({"sha256": digest, "size": size, "keep": _ref(con, same[0]),
                                   "extra": [_ref(con, x) for x in same[1:]]})
    dup_groups.sort(key=lambda g: -g["size"] * len(g["extra"]))
    _set(phase="done", percent=100, listed=listed, done=listed, total=max(listed, 1))
    return {
        "duplicates": dup_groups,
        "zero_byte": [_ref(con, x) for x in sorted(zero)],
        "empty_folders": [{"path": str(x), "name": x.name} for x in sorted(empty_dirs)],
        "reclaimable_bytes": sum(g["size"] * len(g["extra"]) for g in dup_groups),
    }


def scan_shared(subpath: str | None = None) -> dict:
    """One scan at a time. Another request waits for that result instead of starting a second walk."""
    global _job
    with _gate:
        if _job is not None and not _job["done"].is_set():
            job = _job
        else:
            job = {"done": threading.Event(), "result": None, "error": None, "subpath": subpath}
            _job = job
            threading.Thread(target=_worker, args=(job,), daemon=True).start()
    job["done"].wait()
    if job["error"] is not None:
        raise job["error"]
    return job["result"]


def _worker(job: dict) -> None:
    from .index import connect
    con = connect()
    try:
        job["result"] = scan(con, subpath=job["subpath"])
    except Exception as exc:
        job["error"] = exc
    finally:
        con.close()
        job["done"].set()


def _ref(con, p: Path) -> dict:
    row = con.execute("SELECT id FROM files WHERE path=?", (str(p),)).fetchone()
    return {"id": row[0] if row else None, "path": str(p), "name": p.name}
