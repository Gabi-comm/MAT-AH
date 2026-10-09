"""Local AI status: Ollama up, loaded models, offline badge, last timings."""
import socket
import time

from . import llm
from .index import VECTORS

_net = {"checked": 0.0, "online": False}
last_timings: dict = {}


def online() -> bool:
    if time.time() - _net["checked"] < 5:
        return _net["online"]
    ok = False
    for host in ("1.1.1.1", "8.8.8.8"):
        try:
            with socket.create_connection((host, 443), timeout=1):
                ok = True
                break
        except OSError:
            continue
    _net.update(checked=time.time(), online=ok)
    return ok


def loaded_models() -> list[str]:
    try:
        return [m.model for m in llm._client.ps().models]
    except Exception:
        return []


def snapshot(con) -> dict:
    files = {r[0]: r[1] for r in con.execute("SELECT kind, COUNT(*) FROM files GROUP BY kind")}
    return {
        "online": online(),
        "ollama": llm.available() or llm.embed_available(),
        "chat_model": llm.chat_model(),
        "embed_model": llm.EMBED_MODEL if llm.embed_available() else None,
        "loaded": loaded_models(),
        "cloud_models": [m for m in llm.installed() if m.endswith("-cloud")],
        "ocr": "RapidOCR (ONNX)",
        "vectors": len(VECTORS),
        "files": files,
        "last": last_timings,
    }
