"""Kilos: propose file actions, wait for YES/NO, execute with a log, undo in reverse order."""
import json
import os
import re
import shutil
from datetime import datetime
from pathlib import Path

from send2trash import send2trash

from . import llm
from .chunk import name_words
from .folders import OutsideRoots, guard, root_for
from .hanap import search
from .index import delete_file_rows

BAD_NAME = re.compile(r'[<>:"/\\|?*\x00-\x1f]')

PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "folder_name": {"type": "string"},
        "reason": {"type": "string"},
        "file_ids": {"type": "array", "items": {"type": "integer"}},
    },
    "required": ["folder_name", "reason", "file_ids"],
}

SYSTEM = """You are Kilos, the action agent of MAT-AH. The user wants files organized.
Choose which candidate files belong together for the request and name ONE new folder for them.
Use only file ids from the candidate list. Folder name: short, Title Case, no slashes.
Give a one-sentence reason in the user's language."""


def now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def safe_folder_name(s: str) -> str:
    s = BAD_NAME.sub(" ", s)
    s = re.sub(r"\.{2,}", " ", s)
    s = re.sub(r"\s+", " ", s).strip(" .")[:60]
    return s or "MAT-AH Organized"


def unique_dest(dst: Path, taken: set[str]) -> Path:
    stem, suf, i = dst.stem, dst.suffix, 2
    cand = dst
    while cand.exists() or str(cand).lower() in taken:
        cand = dst.with_name(f"{stem} ({i}){suf}")
        i += 1
    return cand


def _candidates(con, request: str) -> list[dict]:
    res = search(con, request, limit=15)
    return [h for h in res["hits"] if h["score"] > 0][:15]


def _rules_plan(request: str, cands: list[dict]) -> dict:
    words = [w for w in re.findall(r"[A-Za-z]+", request) if len(w) > 3 and w.lower() not in
             {"organize", "ayusin", "files", "documents", "please", "pakiayos", "lahat", "yung", "mga"}]
    name = " ".join(w.title() for w in words[:3]) or "Organized"
    top = cands[0]["score"] if cands else 0
    ids = [c["file"]["id"] for c in cands if c["score"] >= top * 0.5][:10]
    return {"folder_name": name, "reason": "Top search matches for your request.", "file_ids": ids}


def propose(con, request: str) -> dict:
    cands = _candidates(con, request)
    if not cands:
        raise ValueError("No matching files to organize.")
    by_id = {c["file"]["id"]: c for c in cands}
    planner = "rules"
    raw = None
    if llm.available():
        listing = "\n".join(f"id={c['file']['id']} | {c['file']['name']} | folder: {Path(c['file']['path']).parent.name}"
                            f" | {c['snippet'][:120]}" for c in cands)
        try:
            raw = llm.chat_json(SYSTEM, f"Request: {request}\n\nCandidates:\n{listing}", PLAN_SCHEMA)
            planner = llm.chat_model()
        except Exception:
            raw = None
    if not raw or not raw.get("file_ids"):
        raw, planner = _rules_plan(request, cands), "rules"
    # Validator: unknown ids are dropped; destination must stay inside an authorized root.
    ids = [i for i in dict.fromkeys(raw["file_ids"]) if i in by_id]
    rejected = [i for i in raw["file_ids"] if i not in by_id]
    if not ids:
        raise ValueError("The plan had no valid files.")
    folder = safe_folder_name(raw["folder_name"])
    paths = [Path(by_id[i]["file"]["path"]) for i in ids]
    try:
        common = Path(os.path.commonpath([str(p.parent) for p in paths]))
        guard(con, common)
    except (ValueError, OutsideRoots):
        r = root_for(con, paths[0])
        common = Path(r["path"])
    dest_dir = guard(con, common / folder)
    ops, taken = [], set()
    if not dest_dir.exists():
        ops.append({"op": "mkdir", "dst": str(dest_dir)})
    for i, p in zip(ids, paths):
        if p.parent == dest_dir:
            continue
        dst = unique_dest(dest_dir / p.name, taken)
        taken.add(str(dst).lower())
        ops.append({"op": "move", "file_id": i, "src": str(p), "dst": str(dst), "renamed": dst.name != p.name})
    plan = {"kind": "organize", "folder": str(dest_dir), "reason": raw.get("reason", ""), "planner": planner,
            "rejected_ids": rejected, "ops": ops}
    return _store(con, request, plan)


def propose_cleanup(con, file_ids: list[int], folders: list[str], request: str = "Linis cleanup") -> dict:
    ops = []
    for fid in file_ids:
        row = con.execute("SELECT path FROM files WHERE id=?", (fid,)).fetchone()
        if row:
            ops.append({"op": "trash", "file_id": fid, "src": str(guard(con, row[0]))})
    for d in folders:
        ops.append({"op": "rmdir", "src": str(guard(con, d))})
    if not ops:
        raise ValueError("Nothing selected.")
    return _store(con, request, {"kind": "cleanup", "reason": "Send selected items to the Recycle Bin.",
                                 "planner": "linis", "ops": ops})


def _store(con, request: str, plan: dict) -> dict:
    for i, op in enumerate(plan["ops"]):
        op["i"] = i
    pid = con.execute("INSERT INTO proposals(request, plan_json, status, created_at) VALUES(?,?,?,?)",
                      (request, json.dumps(plan), "pending", now())).lastrowid
    return get(con, pid)


def get(con, pid: int) -> dict:
    r = con.execute("SELECT * FROM proposals WHERE id=?", (pid,)).fetchone()
    if not r:
        raise KeyError(pid)
    ops = [dict(o) for o in con.execute("SELECT * FROM operations WHERE proposal_id=? ORDER BY id", (pid,))]
    return {"id": r["id"], "request": r["request"], "status": r["status"], "created_at": r["created_at"],
            "plan": json.loads(r["plan_json"]), "log": ops}


def decline(con, pid: int) -> dict:
    p = get(con, pid)
    if p["status"] != "pending":
        raise ValueError(f"Proposal is {p['status']}")
    con.execute("UPDATE proposals SET status='declined' WHERE id=?", (pid,))
    return get(con, pid)


def _log(con, pid, op, src, dst, status, error=None):
    con.execute("INSERT INTO operations(proposal_id, op, src, dst, status, error, done_at) VALUES(?,?,?,?,?,?,?)",
                (pid, op, src, dst, status, error, now()))


def _repoint(con, file_id: int | None, new_path: Path) -> None:
    if not file_id:
        return
    r = root_for(con, new_path)
    con.execute("UPDATE files SET path=?, name=?, root_id=? WHERE id=?",
                (str(new_path), new_path.name, r["id"] if r else None, file_id))
    con.execute("UPDATE chunks_fts SET name=? WHERE chunk_id IN (SELECT id FROM chunks WHERE file_id=?)",
                (name_words(new_path), file_id))


def approve(con, pid: int, selected: list[int] | None = None) -> dict:
    p = get(con, pid)
    if p["status"] != "pending":
        raise ValueError(f"Proposal is {p['status']}")
    ops = p["plan"]["ops"]
    chosen = set(selected) if selected is not None else {o["i"] for o in ops}
    moving = any(o["op"] == "move" and o["i"] in chosen for o in ops)
    con.execute("UPDATE proposals SET status='approved' WHERE id=?", (pid,))
    for o in ops:
        if o["op"] == "mkdir":
            if not moving:
                continue
        elif o["i"] not in chosen:
            continue
        try:
            if o["op"] == "mkdir":
                d = guard(con, o["dst"])
                d.mkdir(parents=False, exist_ok=False)
                _log(con, pid, "mkdir", None, str(d), "done")
            elif o["op"] == "move":
                src, dst = guard(con, o["src"]), guard(con, o["dst"])
                if dst.exists():
                    dst = unique_dest(dst, set())
                shutil.move(str(src), str(dst))
                _repoint(con, o.get("file_id"), dst)
                _log(con, pid, "move", str(src), str(dst), "done")
            elif o["op"] == "trash":
                src = guard(con, o["src"])
                send2trash(str(src))
                if o.get("file_id"):
                    delete_file_rows(con, o["file_id"])
                    con.execute("DELETE FROM files WHERE id=?", (o["file_id"],))
                _log(con, pid, "trash", str(src), "Recycle Bin", "done")
            elif o["op"] == "rmdir":
                src = guard(con, o["src"])
                src.rmdir()
                _log(con, pid, "rmdir", str(src), None, "done")
        except Exception as e:
            _log(con, pid, o["op"], o.get("src"), o.get("dst"), "failed", str(e))
    return get(con, pid)


def undo(con, pid: int) -> dict:
    p = get(con, pid)
    if p["status"] != "approved":
        raise ValueError("Only approved proposals can be undone.")
    for o in reversed(p["log"]):
        if o["status"] != "done" or o["undone_at"]:
            continue
        try:
            if o["op"] == "move":
                src, dst = guard(con, o["src"]), guard(con, o["dst"])
                if src.exists():
                    raise FileExistsError(f"{src.name} already exists at the original place")
                shutil.move(str(dst), str(src))
                fid = con.execute("SELECT id FROM files WHERE path=?", (str(dst),)).fetchone()
                _repoint(con, fid[0] if fid else None, src)
            elif o["op"] == "mkdir":
                d = guard(con, o["dst"])
                if d.exists() and not any(d.iterdir()):
                    d.rmdir()
            elif o["op"] == "rmdir":
                guard(con, o["src"]).mkdir(exist_ok=True)
            elif o["op"] == "trash":
                con.execute("UPDATE operations SET error=? WHERE id=?",
                            ("Restore it from the Windows Recycle Bin", o["id"]))
                continue
            con.execute("UPDATE operations SET undone_at=?, status='undone' WHERE id=?", (now(), o["id"]))
        except Exception as e:
            con.execute("UPDATE operations SET error=? WHERE id=?", (f"undo failed: {e}", o["id"]))
    con.execute("UPDATE proposals SET status='undone' WHERE id=?", (pid,))
    return get(con, pid)


def history(con, limit: int = 20) -> list[dict]:
    return [get(con, r[0]) for r in con.execute("SELECT id FROM proposals ORDER BY id DESC LIMIT ?", (limit,))]
