"""Linis: exact duplicates, zero-byte files and empty folders. Report only — actions go through Kilos."""
import hashlib
import os
from pathlib import Path

from .folders import guard, roots
from .scan import SKIP_DIRS


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def scan(con, root_id: int | None = None, subpath: str | None = None) -> dict:
    """subpath narrows the scan to one folder inside an authorized root (e.g. Downloads)."""
    if subpath:
        bases = [guard(con, subpath)]
    else:
        bases = [Path(r["path"]) for r in roots(con) if root_id is None or r["id"] == root_id]
    by_size: dict[int, list[Path]] = {}
    zero, empty_dirs = [], []
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
                if size == 0:
                    zero.append(fp)
                else:
                    by_size.setdefault(size, []).append(fp)
    dup_groups = []
    for size, paths in by_size.items():
        if len(paths) < 2:
            continue
        by_hash: dict[str, list[Path]] = {}
        for fp in paths:
            try:
                by_hash.setdefault(sha256(fp), []).append(fp)
            except OSError:
                continue
        for digest, same in by_hash.items():
            if len(same) > 1:
                same.sort(key=lambda x: (x.stat().st_mtime, len(str(x))))  # keep the oldest, shortest path
                dup_groups.append({"sha256": digest, "size": size, "keep": _ref(con, same[0]),
                                   "extra": [_ref(con, x) for x in same[1:]]})
    dup_groups.sort(key=lambda g: -g["size"] * len(g["extra"]))
    return {
        "duplicates": dup_groups,
        "zero_byte": [_ref(con, x) for x in sorted(zero)],
        "empty_folders": [{"path": str(x), "name": x.name} for x in sorted(empty_dirs)],
        "reclaimable_bytes": sum(g["size"] * len(g["extra"]) for g in dup_groups),
    }


def _ref(con, p: Path) -> dict:
    row = con.execute("SELECT id FROM files WHERE path=?", (str(p),)).fetchone()
    return {"id": row[0] if row else None, "path": str(p), "name": p.name}
