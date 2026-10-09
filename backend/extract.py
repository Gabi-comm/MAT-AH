"""Text extractors. Each returns a list of units: {"text", "locator"} where locator says where inside the file."""
import threading
from datetime import datetime
from pathlib import Path

KINDS = {
    ".pdf": "pdf", ".docx": "docx", ".pptx": "pptx",
    ".txt": "text", ".md": "text", ".csv": "text",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image", ".bmp": "image",
}

_ocr = None
_ocr_lock = threading.Lock()


def kind_of(path: Path) -> str:
    return KINDS.get(path.suffix.lower(), "other")


def ocr_engine():
    global _ocr
    with _ocr_lock:
        if _ocr is None:
            from rapidocr_onnxruntime import RapidOCR
            _ocr = RapidOCR()
    return _ocr


def ocr_image(img) -> tuple[str, list[dict]]:
    """img: path or numpy array. Returns text and word boxes as [x0, y0, x1, y1] in pixels."""
    result, _ = ocr_engine()(img)
    if not result:
        return "", []
    boxes, lines = [], []
    for pts, text, score in result:
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        boxes.append({"text": text, "box": [min(xs), min(ys), max(xs), max(ys)], "score": round(float(score), 3)})
        lines.append(text)
    return "\n".join(lines), boxes


def extract_pdf(path: Path) -> list[dict]:
    import numpy as np
    import pymupdf
    units = []
    with pymupdf.open(path) as doc:
        for i, page in enumerate(doc, start=1):
            text = page.get_text().strip()
            if len(text) < 20:  # scanned page: render and OCR
                pix = page.get_pixmap(dpi=144)
                arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                if pix.n == 4:
                    arr = arr[:, :, :3]
                ocr_text, _ = ocr_image(arr)
                text = (text + "\n" + ocr_text).strip()
            units.append({"text": text, "locator": {"page": i}})
    return units


def extract_docx(path: Path) -> list[dict]:
    import docx
    d = docx.Document(str(path))
    parts = [p.text for p in d.paragraphs if p.text.strip()]
    for table in d.tables:
        for row in table.rows:
            parts.append(" | ".join(c.text.strip() for c in row.cells))
    return [{"text": "\n".join(parts), "locator": {}}]


def extract_pptx(path: Path) -> list[dict]:
    from pptx import Presentation
    units = []
    for i, slide in enumerate(Presentation(str(path)).slides, start=1):
        texts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                texts.append(shape.text_frame.text)
        if slide.has_notes_slide:
            texts.append(slide.notes_slide.notes_text_frame.text)
        units.append({"text": "\n".join(t for t in texts if t.strip()), "locator": {"slide": i}})
    return units


def extract_text(path: Path) -> list[dict]:
    raw = path.read_bytes()
    for enc in ("utf-8", "utf-16", "cp1252"):
        try:
            return [{"text": raw.decode(enc), "locator": {}}]
        except UnicodeDecodeError:
            continue
    return [{"text": raw.decode("utf-8", "ignore"), "locator": {}}]


def extract_image(path: Path) -> tuple[list[dict], str | None]:
    from PIL import Image
    taken = None
    w = h = None
    try:
        with Image.open(path) as im:
            w, h = im.size
            exif = im.getexif()
            raw = exif.get_ifd(0x8769).get(36867) or exif.get(306)  # DateTimeOriginal, DateTime
            if raw:
                taken = datetime.strptime(str(raw)[:19], "%Y:%m:%d %H:%M:%S").isoformat()
    except Exception:
        pass
    text, boxes = ocr_image(str(path))
    return [{"text": text, "locator": {"boxes": boxes, "size": [w, h]}}], taken


def extract(path: Path) -> tuple[str, list[dict], str | None]:
    """Returns (kind, units, taken_at)."""
    kind = kind_of(path)
    taken = None
    if kind == "pdf":
        units = extract_pdf(path)
    elif kind == "docx":
        units = extract_docx(path)
    elif kind == "pptx":
        units = extract_pptx(path)
    elif kind == "text":
        units = extract_text(path)
    elif kind == "image":
        units, taken = extract_image(path)
    else:
        units = []
    return kind, units, taken
