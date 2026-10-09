"""The only module that talks to Ollama. Everything degrades gracefully when it is down."""
import json
import os
import re
import time

import numpy as np

try:
    import ollama
except ImportError:  # pragma: no cover
    ollama = None

from .index import DB_PATH, normalize

EMBED_MODEL = os.environ.get("MATAH_EMBED", "embeddinggemma")
# With chat_model on "auto", the first installed model in this list becomes the chat model.
CHAT_PREFS = [m for m in [os.environ.get("MATAH_LLM")] if m] + [
    "gemma4:e4b", "gemma4:e2b", "qwen3:8b", "qwen3:1.7b", "llama3.2:latest",
]

# User-editable local LLM settings (Settings > Local LLM), saved next to the database.
CONFIG_PATH = DB_PATH.parent / "llm.json"
DEFAULTS = {
    "host": os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434"),
    "chat_model": "",    # "" = auto: first installed model from CHAT_PREFS
    "vision_model": "",  # "" = auto: the chat model if it can see, else any local vision model
    "num_ctx": 8192,
    "keep_alive": "1h",
}
_KEEP_ALIVE_RE = re.compile(r"^(-1|0|\d+(\.\d+)?(ms|s|m|h))$")


def _load_config() -> dict:
    cfg = dict(DEFAULTS)
    try:
        saved = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        cfg.update(validate({k: v for k, v in saved.items() if k in DEFAULTS}))
    except (OSError, ValueError):
        pass  # missing or corrupt file: defaults
    return cfg


def validate(patch: dict) -> dict:
    """Checks a partial config; raises ValueError (HTTP 400) with a readable message."""
    out = {}
    for k, v in patch.items():
        if k not in DEFAULTS:
            raise ValueError(f"Unknown setting: {k}")
        if k == "host":
            v = str(v).strip().rstrip("/")
            if not re.match(r"^https?://[^\s/]+$", v):
                raise ValueError("Ollama address must look like http://127.0.0.1:11434")
        elif k in ("chat_model", "vision_model"):
            v = str(v or "").strip()
            if v.endswith("-cloud"):
                raise ValueError("Cloud models send your files off this computer. Pick a local model.")
        elif k == "num_ctx":
            if isinstance(v, bool) or not isinstance(v, int) or not 2048 <= v <= 131072:
                raise ValueError("Context window must be a whole number from 2048 to 131072.")
        elif k == "keep_alive":
            v = str(v).strip()
            if not _KEEP_ALIVE_RE.match(v):
                raise ValueError('Keep loaded must be a duration like "5m" or "1h", "0" or "-1".')
        out[k] = v
    return out


_cfg = _load_config()


def config() -> dict:
    return dict(_cfg)


def _make_client():
    return ollama.Client(host=_cfg["host"], timeout=180) if ollama else None


_client = _make_client()
_state = {"checked": 0.0, "up": False, "models": []}


def set_config(patch: dict) -> dict:
    global _client
    clean = validate(patch)
    host_changed = "host" in clean and clean["host"] != _cfg["host"]
    _cfg.update(clean)
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(_cfg, indent=2), encoding="utf-8")
    if host_changed:
        _client = _make_client()
        _caps.clear()
    _refresh(force=True)
    return config()


def _keep_alive():
    v = _cfg["keep_alive"]
    return int(v) if v in ("0", "-1") else v


def _refresh(force: bool = False) -> None:
    if not force and time.time() - _state["checked"] < 5:
        return
    _state["checked"] = time.time()
    try:
        names = [m.model for m in _client.list().models]
        _state.update(up=True, models=names)
    except Exception:
        _state.update(up=False, models=[])


def refresh() -> None:
    _refresh(force=True)


def reachable() -> bool:
    _refresh()
    return _state["up"]


def available() -> bool:
    _refresh()
    return _state["up"] and chat_model() is not None


def embed_available() -> bool:
    _refresh()
    return _state["up"] and any(m.split(":")[0] == EMBED_MODEL.split(":")[0] for m in _state["models"])


def installed() -> list[str]:
    _refresh()
    return list(_state["models"])


def _installed(m: str, names: set[str]) -> bool:
    return m in names or (":" not in m and f"{m}:latest" in names)


def chat_model() -> str | None:
    _refresh()
    names = set(_state["models"])
    if _cfg["chat_model"]:
        return _cfg["chat_model"] if _installed(_cfg["chat_model"], names) else None
    for m in CHAT_PREFS:
        if _installed(m, names):
            return m
    return None


_caps: dict[str, list[str]] = {}


def capabilities(model: str) -> list[str]:
    if model not in _caps:
        try:
            _caps[model] = list(_client.show(model).capabilities or [])
        except Exception:
            return []
    return _caps[model]


def vision_model() -> str | None:
    """The chat model if it can see images (gemma4 can), else any installed local vision model."""
    _refresh()
    if _cfg["vision_model"]:
        return _cfg["vision_model"] if _installed(_cfg["vision_model"], set(_state["models"])) else None
    m = chat_model()
    if m and "vision" in capabilities(m):
        return m
    for name in _state["models"]:
        if not name.endswith("-cloud") and "vision" in capabilities(name):
            return name
    return None


def describe_image(path, prompt: str) -> str:
    from PIL import Image
    import io
    with Image.open(path) as im:  # downscale: faster, and enough for captions
        im = im.convert("RGB")
        im.thumbnail((896, 896))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=85)
    r = _client.chat(model=vision_model(), keep_alive=_keep_alive(), think=False, options=_opts(0.2),
                     messages=[{"role": "user", "content": prompt, "images": [buf.getvalue()]}])
    return _strip_think(r.message.content or "")


def _opts(temperature: float) -> dict:
    return {"temperature": temperature, "num_ctx": _cfg["num_ctx"]}


def chat(system: str, user: str, temperature: float = 0.2, images: list[bytes] | None = None) -> str:
    msg = {"role": "user", "content": user}
    model = chat_model()
    if images:
        model = vision_model() or model
        msg["images"] = images
    r = _client.chat(
        model=model, keep_alive=_keep_alive(), think=False, options=_opts(temperature),
        messages=[{"role": "system", "content": system}, msg],
    )
    return _strip_think(r.message.content or "")


def chat_json(system: str, user: str, schema: dict, temperature: float = 0.1) -> dict:
    r = _client.chat(
        model=chat_model(), keep_alive=_keep_alive(), think=False, format=schema, options=_opts(temperature),
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    return json.loads(_strip_think(r.message.content or "{}"))


def _strip_think(s: str) -> str:
    if "</think>" in s:
        s = s.split("</think>", 1)[1]
    return s.strip()


_query_cache: dict[str, np.ndarray] = {}


def embed(texts: list[str], kind: str = "doc") -> np.ndarray:
    """embeddinggemma prompt formats from its model card. Single queries are cached."""
    if kind == "query" and len(texts) == 1 and texts[0] in _query_cache:
        return _query_cache[texts[0]][None, :]
    if kind == "query" and len(texts) == 1:
        v = _embed(texts, kind)
        if len(_query_cache) > 512:
            _query_cache.clear()
        _query_cache[texts[0]] = v[0]
        return v
    return _embed(texts, kind)


def _embed(texts: list[str], kind: str) -> np.ndarray:
    if kind == "query":
        texts = [f"task: search result | query: {t}" for t in texts]
    else:
        texts = [f"title: none | text: {t}" for t in texts]
    out = []
    for i in range(0, len(texts), 32):
        r = _client.embed(model=EMBED_MODEL, input=texts[i:i + 32], keep_alive=_keep_alive())
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
