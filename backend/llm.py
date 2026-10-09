"""The only module that talks to Ollama. Everything degrades gracefully when it is down."""
import json
import os
import time

import numpy as np

try:
    import ollama
except ImportError:  # pragma: no cover
    ollama = None

from .index import normalize

KEEP_ALIVE = "1h"
EMBED_MODEL = os.environ.get("MATAH_EMBED", "embeddinggemma")
# First installed model in this list becomes the chat model.
CHAT_PREFS = [m for m in [os.environ.get("MATAH_LLM")] if m] + [
    "gemma4:e4b", "gemma4:e2b", "qwen3:8b", "qwen3:1.7b", "llama3.2:latest",
]

_client = ollama.Client(host=os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434"), timeout=180) if ollama else None
_state = {"checked": 0.0, "up": False, "models": []}


def _refresh(force: bool = False) -> None:
    if not force and time.time() - _state["checked"] < 5:
        return
    _state["checked"] = time.time()
    try:
        names = [m.model for m in _client.list().models]
        _state.update(up=True, models=names)
    except Exception:
        _state.update(up=False, models=[])


def available() -> bool:
    _refresh()
    return _state["up"] and chat_model() is not None


def embed_available() -> bool:
    _refresh()
    return _state["up"] and any(m.split(":")[0] == EMBED_MODEL.split(":")[0] for m in _state["models"])


def installed() -> list[str]:
    _refresh()
    return list(_state["models"])


def chat_model() -> str | None:
    _refresh()
    names = set(_state["models"])
    for m in CHAT_PREFS:
        if m in names or (":" not in m and f"{m}:latest" in names):
            return m
    return None


def _opts(temperature: float) -> dict:
    return {"temperature": temperature, "num_ctx": 8192}


def chat(system: str, user: str, temperature: float = 0.2) -> str:
    r = _client.chat(
        model=chat_model(), keep_alive=KEEP_ALIVE, think=False, options=_opts(temperature),
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    return _strip_think(r.message.content or "")


def chat_json(system: str, user: str, schema: dict, temperature: float = 0.1) -> dict:
    r = _client.chat(
        model=chat_model(), keep_alive=KEEP_ALIVE, think=False, format=schema, options=_opts(temperature),
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    return json.loads(_strip_think(r.message.content or "{}"))


def _strip_think(s: str) -> str:
    if "</think>" in s:
        s = s.split("</think>", 1)[1]
    return s.strip()


def embed(texts: list[str], kind: str = "doc") -> np.ndarray:
    """embeddinggemma prompt formats from its model card."""
    if kind == "query":
        texts = [f"task: search result | query: {t}" for t in texts]
    else:
        texts = [f"title: none | text: {t}" for t in texts]
    out = []
    for i in range(0, len(texts), 32):
        r = _client.embed(model=EMBED_MODEL, input=texts[i:i + 32], keep_alive=KEEP_ALIVE)
        out.extend(r.embeddings)
    return normalize(np.array(out, dtype=np.float32))


def warm() -> None:
    try:
        if embed_available():
            embed(["warm up"], "query")
        if available():
            chat("Reply with OK.", "ping")
    except Exception:
        pass
