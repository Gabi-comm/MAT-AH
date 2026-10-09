"""Visual search: CLIP puts images, video frames and text queries in one vector space, so
"litrato sa beach" finds a beach photo with no text in it. Runs on this PC (open_clip, CPU or CUDA).

Default model: LAION's multilingual CLIP (XLM-RoBERTa text tower) so Filipino and Taglish queries work.
Override with MATAH_CLIP="ViT-B-32:laion2b_s34b_b79k" for the smaller English-only model."""
import os
import threading

import numpy as np

from .index import normalize

MODEL = os.environ.get("MATAH_CLIP", "xlm-roberta-base-ViT-B-32:laion5b_s13b_b90k")
_lock = threading.Lock()
_m = {"model": None, "preprocess": None, "tokenizer": None, "device": "cpu", "error": None}


def installed() -> bool:
    try:
        import open_clip  # noqa: F401
        import torch  # noqa: F401
        return True
    except Exception:
        return False


def _load():
    with _lock:
        if _m["model"] is not None or _m["error"]:
            return _m["model"] is not None
        try:
            import open_clip
            import torch
            arch, tag = MODEL.split(":", 1)
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model, _, preprocess = open_clip.create_model_and_transforms(arch, pretrained=tag, device=device)
            model.eval()
            torch.set_num_threads(max(2, (os.cpu_count() or 4) - 2))
            _m.update(model=model, preprocess=preprocess, tokenizer=open_clip.get_tokenizer(arch), device=device)
            return True
        except Exception as e:
            _m["error"] = f"{e.__class__.__name__}: {e}"[:300]
            return False


def ready() -> bool:
    return installed() and _load()


def status() -> dict:
    return {"model": MODEL, "installed": installed(), "loaded": _m["model"] is not None, "error": _m["error"],
            "device": _m["device"]}


def embed_images(images: list) -> np.ndarray:
    """images: PIL images. Returns normalized float32 [n, d]."""
    import torch
    if not images or not ready():
        return np.zeros((0, 0), dtype=np.float32)
    out = []
    with torch.no_grad():
        for i in range(0, len(images), 16):
            batch = torch.stack([_m["preprocess"](im.convert("RGB")) for im in images[i:i + 16]]).to(_m["device"])
            out.append(_m["model"].encode_image(batch).float().cpu().numpy())
    return normalize(np.concatenate(out))


def embed_text(texts: list[str]) -> np.ndarray:
    import torch
    if not ready():
        return np.zeros((0, 0), dtype=np.float32)
    with torch.no_grad():
        tok = _m["tokenizer"](texts).to(_m["device"])
        return normalize(_m["model"].encode_text(tok).float().cpu().numpy())
