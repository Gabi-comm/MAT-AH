"""Turn extracted units into chunks that each keep a locator."""
import re
from pathlib import Path

PAGE_MAX = 1200
TEXT_SIZE = 800
OVERLAP = 150


def _split(text: str, size: int) -> list[tuple[int, int]]:
    if len(text) <= size:
        return [(0, len(text))]
    spans, start = [], 0
    while start < len(text):
        end = min(len(text), start + size)
        if end < len(text):  # prefer to break at whitespace
            ws = text.rfind(" ", start + size // 2, end)
            if ws > 0:
                end = ws
        spans.append((start, end))
        if end >= len(text):
            break
        start = max(end - OVERLAP, start + 1)
    return spans


def name_words(path: Path) -> str:
    """File name and parent folder as searchable words: 'Enrollment_Reqs (2).png' -> 'Enrollment Reqs 2'."""
    parts = [path.stem, path.parent.name]
    return " ".join(re.sub(r"[_\-.()\[\]]+", " ", p).strip() for p in parts if p)


def chunk(path: Path, kind: str, units: list[dict]) -> list[dict]:
    chunks = []
    words = name_words(path)
    for u in units:
        text, loc = u["text"].strip(), u["locator"]
        if kind == "image":
            chunks.append({"text": f"{text}\n{words}".strip(), "locator": loc})
            continue
        if not text:
            continue
        size = PAGE_MAX if ("page" in loc or "slide" in loc or "t" in loc) else TEXT_SIZE
        for a, b in _split(text, size):
            l = dict(loc)
            if not loc or "sheet" in loc:
                l["chars"] = [a, b]
            chunks.append({"text": text[a:b], "locator": l})
    if not chunks:  # metadata-only so the file is still findable by name
        chunks.append({"text": words, "locator": {}})
    return chunks
