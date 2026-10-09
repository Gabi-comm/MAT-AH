"""FastAPI app: the API under /api and the built React UI at /. Listens on 127.0.0.1 only."""
import json
import mimetypes
import os
import subprocess
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import folders, hanap, kilos, linis, llm, media, sagot, scan, status, visual, winsearch
from .chunk import name_words
from .index import VECTORS, VISUAL, connect

WEB_DIST = Path(__file__).resolve().parent.parent / "dist"  # the React UI, built at the repo root


def db():
    con = connect()
    try:
        yield con
    finally:
        con.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    con = connect()
    VECTORS.load(con)
    VISUAL.load(con)
    con.close()
    threading.Thread(target=llm.warm, daemon=True).start()
    visual.ready()  # start loading CLIP in the background
    yield


app = FastAPI(title="MAT-AH", lifespan=lifespan)


@app.exception_handler(folders.OutsideRoots)
async def _outside(_: Request, exc: folders.OutsideRoots):
    return JSONResponse({"detail": "That path is outside your authorized folders."}, status_code=403)


@app.exception_handler(ValueError)
async def _value(_: Request, exc: ValueError):
    return JSONResponse({"detail": str(exc)}, status_code=400)


# ---------- folders & indexing ----------
class RootIn(BaseModel):
    path: str | None = None


@app.get("/api/roots")
def get_roots(con=Depends(db)):
    out = []
    for r in folders.roots(con):
        n = con.execute("SELECT COUNT(*) FROM files WHERE root_id=?", (r["id"],)).fetchone()[0]
        out.append({**r, "files": n, "name": Path(r["path"]).name or r["path"]})
    return out


@app.post("/api/roots")
def add_root(body: RootIn, con=Depends(db)):
    path = body.path or folders.pick_folder()
    if not path:
        return {"cancelled": True}
    return folders.add_root(con, path)


@app.post("/api/roots/computer")
def add_computer(con=Depends(db)):
    """'Search my whole computer': your user folder plus any other non-system drives."""
    added = [folders.add_root(con, str(Path.home()))]
    for d in folders.extra_drives():
        try:
            added.append(folders.add_root(con, d))
        except ValueError:
            pass
    return {"added": added}


@app.delete("/api/roots/{root_id}")
def del_root(root_id: int, con=Depends(db)):
    folders.remove_root(con, root_id)
    return {"ok": True}


@app.post("/api/index")
def start_index():
    if scan.progress["running"]:
        return scan.progress

    def work():
        con = connect()
        try:
            scan.run(con)
        finally:
            con.close()

    threading.Thread(target=work, daemon=True).start()
    return {**scan.progress, "running": True}


@app.post("/api/index/stop")
def stop_index():
    scan.progress["stop"] = True
    return scan.progress


@app.get("/api/index/status")
def index_status():
    return scan.progress


# ---------- Hanap & Sagot ----------
@app.get("/api/search")
def do_search(q: str, mode: str = "hybrid", limit: int = 60, con=Depends(db)):
    res = hanap.search(con, q, limit=limit, mode=mode)
    status.last_timings.clear()
    status.last_timings.update({"kind": "search", **res["timings"]})
    for h in res["hits"]:
        h["locator"] = _slim_locator(h["locator"])
    return res


class AskIn(BaseModel):
    q: str


@app.post("/api/ask")
def do_ask(body: AskIn, con=Depends(db)):
    res = sagot.answer(con, body.q)
    status.last_timings.clear()
    status.last_timings.update({"kind": "answer", **res["timings"]})
    return res


def _slim_locator(loc: dict) -> dict:
    return {k: v for k, v in loc.items() if k != "boxes"}


# ---------- files ----------
def _file(con, fid: int):
    r = con.execute("SELECT * FROM files WHERE id=?", (fid,)).fetchone()
    if not r:
        raise HTTPException(404, "Unknown file")
    p = folders.guard(con, r["path"])
    if not p.exists():
        raise HTTPException(410, "File no longer exists — press Re-index")
    return r, p


@app.get("/api/files/{fid}")
def file_meta(fid: int, chunk: int | None = None, con=Depends(db)):
    r, p = _file(con, fid)
    q = "SELECT id, text, locator FROM chunks WHERE file_id=?" + (" AND id=?" if chunk else "") + " ORDER BY id LIMIT 1"
    c = con.execute(q, (fid, chunk) if chunk else (fid,)).fetchone()
    notes = [dict(n) for n in con.execute("SELECT id, text, created_at FROM notes WHERE file_id=?", (fid,))]
    return {**dict(r), "folder": str(p.parent), "locator": json.loads(c["locator"]) if c else {},
            "text": c["text"][:4000] if c else "", "notes": notes}


@app.get("/api/files/{fid}/raw")
def file_raw(fid: int, con=Depends(db)):
    r, p = _file(con, fid)
    media = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    return FileResponse(p, media_type=media, headers={"Content-Disposition": f'inline; filename="{p.name}"'})


@app.get("/api/files/{fid}/thumb")
def file_thumb(fid: int, page: int = 1, w: int = 360, t: float = 1.0, con=Depends(db)):
    r, p = _file(con, fid)
    import io
    from PIL import Image
    if r["kind"] == "pdf":
        import pymupdf
        with pymupdf.open(p) as doc:
            pg = doc[max(0, min(page, len(doc)) - 1)]
            zoom = w / pg.rect.width
            png = pg.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).tobytes("png")
        return Response(png, media_type="image/png", headers={"Cache-Control": "max-age=300"})
    if r["kind"] == "image":
        with Image.open(p) as im:
            im = im.convert("RGB")
            im.thumbnail((w, w * 2))
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=82)
        return Response(buf.getvalue(), media_type="image/jpeg", headers={"Cache-Control": "max-age=300"})
    if r["kind"] == "video":
        jpg = media.frame_at(p, t, w)
        if jpg:
            return Response(jpg, media_type="image/jpeg", headers={"Cache-Control": "max-age=300"})
    raise HTTPException(415, "No preview")


@app.post("/api/files/{fid}/open")
def file_open(fid: int, con=Depends(db)):
    _, p = _file(con, fid)
    os.startfile(str(p))
    return {"ok": True}


@app.post("/api/files/{fid}/reveal")
def file_reveal(fid: int, con=Depends(db)):
    _, p = _file(con, fid)
    subprocess.Popen(f'explorer /select,"{p}"')
    return {"ok": True}


class NoteIn(BaseModel):
    text: str


@app.post("/api/files/{fid}/notes")
def add_note(fid: int, body: NoteIn, con=Depends(db)):
    """Tala (P1): a note's words make the file findable."""
    from datetime import datetime
    _file(con, fid)
    con.execute("INSERT INTO notes(file_id, text, created_at) VALUES(?,?,?)",
                (fid, body.text.strip(), datetime.now().isoformat(timespec="seconds")))
    allnotes = " ".join(r[0] for r in con.execute("SELECT text FROM notes WHERE file_id=?", (fid,)))
    con.execute("UPDATE chunks_fts SET notes=? WHERE chunk_id IN (SELECT id FROM chunks WHERE file_id=?)",
                (allnotes, fid))
    if llm.embed_available():  # the note feeds the meaning index too
        rows = con.execute("SELECT c.id, c.text, f.path FROM chunks c JOIN files f ON f.id=c.file_id WHERE c.file_id=?",
                           (fid,)).fetchall()
        VECTORS.remove([r["id"] for r in rows])
        try:
            scan.embed_chunks(con, [(r["id"], r["text"]) for r in rows], name_words(Path(rows[0]["path"])), allnotes)
        except Exception:
            pass
    return file_meta(fid, None, con)


# ---------- Linis & Kilos ----------
@app.get("/api/linis/progress")
def linis_progress():
    """Polled while /api/linis is still walking and hashing. In-memory only."""
    return linis.progress()


@app.get("/api/linis")
def do_linis(path: str | None = None):
    # Own connection inside the scan thread. A second call joins the scan already running.
    return linis.scan_shared(subpath=path)


class ProposeIn(BaseModel):
    request: str


class CleanupIn(BaseModel):
    file_ids: list[int] = []
    folders: list[str] = []


class ApproveIn(BaseModel):
    selected: list[int] | None = None


@app.post("/api/kilos/propose")
def kilos_propose(body: ProposeIn, con=Depends(db)):
    import time
    t = time.perf_counter()
    res = kilos.propose(con, body.request)
    status.last_timings.clear()
    status.last_timings.update({"kind": "kilos", "generate": round((time.perf_counter() - t) * 1000, 1)})
    return res


@app.post("/api/kilos/cleanup")
def kilos_cleanup(body: CleanupIn, con=Depends(db)):
    return kilos.propose_cleanup(con, body.file_ids, body.folders)


@app.post("/api/kilos/{pid}/approve")
def kilos_approve(pid: int, body: ApproveIn, con=Depends(db)):
    return kilos.approve(con, pid, body.selected)


@app.post("/api/kilos/{pid}/decline")
def kilos_decline(pid: int, con=Depends(db)):
    return kilos.decline(con, pid)


@app.post("/api/kilos/{pid}/undo")
def kilos_undo(pid: int, con=Depends(db)):
    return kilos.undo(con, pid)


@app.get("/api/ops")
def ops(con=Depends(db)):
    return kilos.history(con)


# ---------- local LLM settings ----------
def _llm_info() -> dict:
    return {"config": llm.config(), "defaults": llm.DEFAULTS, "auto_order": llm.CHAT_PREFS,
            "up": llm.reachable(), "installed": [m for m in llm.installed() if not m.endswith("-cloud")],
            "chat_model": llm.chat_model(), "vision_model": llm.vision_model(), "embed_model": llm.EMBED_MODEL,
            "embed_installed": llm.embed_available(), "downloaded": (dl := llm.downloaded()),
            "recommended": llm.recommended({m["name"] for m in dl}), "ram_gb": llm.ram_gb(), "pulls": llm.pulls}


@app.get("/api/llm")
def get_llm(refresh: bool = False):
    if refresh:
        llm.refresh()
    return _llm_info()


@app.put("/api/llm")
def put_llm(patch: dict):
    llm.set_config(patch)
    return _llm_info()


class PullIn(BaseModel):
    model: str


@app.post("/api/llm/pull")
def pull_llm(body: PullIn):
    llm.pull(body.model)
    return _llm_info()


@app.get("/api/status")
def get_status(con=Depends(db)):
    return {**status.snapshot(con), "indexing": scan.progress["running"], "index": scan.progress,
            "visual": visual.status(), "media": media.status(), "windows_search": winsearch.status(),
            "vision_model": llm.vision_model()}


if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
