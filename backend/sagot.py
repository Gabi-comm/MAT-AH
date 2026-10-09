"""Sagot: RAG answer with numbered citations, then a grounding verifier that enforces 'no invented figures'."""
import re
import time
import unicodedata

from . import llm
from .hanap import MONTHS, top_chunks

SYSTEM = """You are Sagot, the answer agent of MAT-AH, a private file assistant.
Answer ONLY from the numbered sources. Rules:
- Reply in the same language the user used (English, Filipino or Taglish).
- After every sentence that states a fact, cite its source like [1] or [2].
- Copy numbers, amounts and dates exactly as written in the source.
- Keep it short: 1-3 sentences.
- If the sources do not contain the answer, reply with exactly: INSUFFICIENT"""

INSUFFICIENT_MSG = "Kulang ang ebidensya sa files mo — insufficient evidence. Here are the closest sources."

NUM_RE = re.compile(r"\d+(?:[.,]\d+)*")
CITE_RE = re.compile(r"\[(\d+)\]")


def _fold(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)).lower()


def _norm_num(s: str) -> set[str]:
    """Canonical forms that survive OCR/locale separators: '3,275.50' == '3.275.50' == '3275.5'; '18,450.00' == '18450'."""
    m = re.fullmatch(r"(.*?)[.,](\d{2})", s)
    whole, dec = (m.group(1), m.group(2)) if m and m.group(1) else (s, "")
    digits = re.sub(r"[.,]", "", whole)
    forms = {digits.lstrip("0") or "0"}
    if dec and dec != "00":
        forms.add(forms.copy().pop() + "." + dec.rstrip("0"))
    return forms


def _nums_in(text: str) -> set[str]:
    out: set[str] = set()
    for n in NUM_RE.findall(text):
        out |= _norm_num(n)
    return out


def _claims_in(text: str) -> list[set[str]]:
    return [_norm_num(n) for n in NUM_RE.findall(text)]


def _sentences(text: str) -> list[str]:
    # split after sentence punctuation or after a citation group, keep citations attached
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\"'(])|\n+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def verify(answer: str, sources: list[dict], question: str = "") -> tuple[bool, list[str]]:
    """Every [n] must exist; every number, amount and month in a sentence must appear in that sentence's cited chunks."""
    problems = []
    n = len(sources)
    all_cites = [int(c) for c in CITE_RE.findall(answer)]
    if not all_cites:
        problems.append("no citations")
    for c in all_cites:
        if c < 1 or c > n:
            problems.append(f"citation [{c}] does not exist")
    texts = {i + 1: _fold(s["text"]) for i, s in enumerate(sources)}
    asked = _nums_in(question)
    nums = {i: _nums_in(t) for i, t in texts.items()}
    last_cites: list[int] = []
    for sent in _sentences(answer):
        cites = [int(c) for c in CITE_RE.findall(sent) if 1 <= int(c) <= n] or last_cites
        last_cites = cites or last_cites
        body = CITE_RE.sub(" ", sent)
        claimed = _claims_in(body)
        months = {m for m in MONTHS if len(m) > 3 and re.search(rf"\b{m}\b", _fold(body))}
        if not (claimed or months):
            continue
        if not cites:
            problems.append(f"uncited figure in: {sent[:60]}")
            continue
        pool_nums = set().union(*(nums[c] for c in cites)) | asked  # echoing the question is not inventing
        pool_text = " ".join(texts[c] for c in cites)
        for forms in claimed:
            if not (forms & pool_nums):
                problems.append(f"'{max(forms, key=len)}' not found in cited source(s) {cites}")
        for m in months:
            if not re.search(rf"\b{m}", pool_text) and not re.search(rf"\b{m[:3]}\b", pool_text):
                problems.append(f"'{m}' not found in cited source(s) {cites}")
    return (not problems), problems


def where(loc: dict, kind: str) -> str:
    if "page" in loc:
        return f"page {loc['page']}"
    if "slide" in loc:
        return f"slide {loc['slide']}"
    if "t" in loc:
        m, sec = divmod(int(loc["t"]), 60)
        return f"{'speech' if kind == 'audio' or 'end' in loc else 'video'} at {m}:{sec:02d}"
    if loc.get("caption"):
        return "image description"
    return "image text" if kind == "image" else "file"


def _image_bytes(sources: list[dict]) -> list[bytes]:
    """The top image source, downscaled, so a vision model can look at it while answering."""
    import io
    from PIL import Image
    for s in sources[:3]:
        if s["file"]["kind"] == "image":
            try:
                with Image.open(s["file"]["path"]) as im:
                    im = im.convert("RGB")
                    im.thumbnail((1024, 1024))
                    buf = io.BytesIO()
                    im.save(buf, "JPEG", quality=85)
                return [buf.getvalue()]
            except OSError:
                return []
    return []


def _source_block(sources: list[dict]) -> str:
    out = []
    for i, s in enumerate(sources, start=1):
        out.append(f"[{i}] {s['file']['name']} ({where(s['locator'], s['file']['kind'])}):\n{s['text'][:1500]}")
    return "\n\n".join(out)


def _public(s: dict, i: int) -> dict:
    return {"n": i, "file": s["file"], "locator": {k: v for k, v in s["locator"].items() if k != "boxes"},
            "chunk_id": s["chunk_id"], "snippet": s["snippet"], "highlight": s["highlight"]}


def answer(con, question: str) -> dict:
    timings = {}
    t0 = time.perf_counter()
    from .scan import note_query
    note_query()
    sources, res = top_chunks(con, question, 6)
    timings.update(res["timings"])
    timings["retrieve"] = round((time.perf_counter() - t0) * 1000 - timings.get("parse", 0), 1)
    pub = [_public(s, i) for i, s in enumerate(sources, start=1)]
    base = {"question": question, "sources": pub, "timings": timings, "model": llm.chat_model(),
            "search_mode": res["mode"], "read_now": res.get("read_now", [])}
    if not llm.available():
        return {**base, "status": "offline", "answer": None,
                "message": "Local AI is not running — showing the best matching sources instead."}
    if not sources:
        return {**base, "status": "insufficient", "answer": None, "message": INSUFFICIENT_MSG, "problems": ["no sources"]}

    t1 = time.perf_counter()
    images = _image_bytes(sources) if llm.vision_model() else []
    if images:
        base["model"] = llm.vision_model()
    system = SYSTEM + ("\nThe attached image is the first image source; state only what it visibly shows."
                       if images else "")
    note_query()  # keep the GPU free for the answer
    raw = llm.chat(system, f"Sources:\n\n{_source_block(sources)}\n\nQuestion: {question}", temperature=0.1,
                   images=images)
    timings["generate"] = round((time.perf_counter() - t1) * 1000, 1)

    t2 = time.perf_counter()
    if raw.strip().upper().startswith("INSUFFICIENT") or not raw.strip():
        ok, problems, status = False, ["model said INSUFFICIENT"], "insufficient"
    else:
        ok, problems = verify(raw, sources, question)
        status = "grounded" if ok else "insufficient"
    timings["verify"] = round((time.perf_counter() - t2) * 1000, 1)
    if not ok:
        return {**base, "status": status, "answer": None, "rejected": raw if raw.strip().upper() != "INSUFFICIENT" else None,
                "message": INSUFFICIENT_MSG, "problems": problems}
    cited = sorted({int(c) for c in CITE_RE.findall(raw)})
    return {**base, "status": "grounded", "answer": raw.strip(), "cited": cited, "problems": []}
