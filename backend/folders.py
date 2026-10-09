"""Authorized roots, the path guard, and the native Windows folder dialog."""
import threading
from datetime import datetime
from pathlib import Path


class OutsideRoots(Exception):
    pass


def roots(con) -> list[dict]:
    return [dict(r) for r in con.execute("SELECT id, path, added_at FROM roots ORDER BY id")]


def add_root(con, path: str) -> dict:
    p = Path(path).resolve()
    if not p.is_dir():
        raise ValueError(f"Not a folder: {p}")
    con.execute("INSERT OR IGNORE INTO roots(path, added_at) VALUES(?, ?)", (str(p), datetime.now().isoformat()))
    return dict(con.execute("SELECT id, path, added_at FROM roots WHERE path=?", (str(p),)).fetchone())


def remove_root(con, root_id: int) -> None:
    from .index import delete_file_rows
    for (fid,) in con.execute("SELECT id FROM files WHERE root_id=?", (root_id,)).fetchall():
        delete_file_rows(con, fid)
    con.execute("DELETE FROM files WHERE root_id=?", (root_id,))
    con.execute("DELETE FROM roots WHERE id=?", (root_id,))


def guard(con, path: str | Path) -> Path:
    """Resolve and reject anything that is not inside an authorized root."""
    p = Path(path).resolve()
    for r in roots(con):
        rp = Path(r["path"])
        if p == rp or rp in p.parents:
            return p
    raise OutsideRoots(str(p))


def root_for(con, path: Path) -> dict | None:
    for r in roots(con):
        rp = Path(r["path"])
        if path == rp or rp in path.parents:
            return r
    return None


def pick_folder() -> str | None:
    """Open a native folder dialog on its own thread (tkinter needs a fresh Tk each time)."""
    result: list[str | None] = [None]

    def run():
        import tkinter as tk
        from tkinter import filedialog
        tk_root = tk.Tk()
        tk_root.withdraw()
        tk_root.attributes("-topmost", True)
        tk_root.update()
        chosen = filedialog.askdirectory(parent=tk_root, title="MAT-AH: choose a folder to index", mustexist=True)
        tk_root.destroy()
        result[0] = chosen or None

    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join()
    return result[0]
