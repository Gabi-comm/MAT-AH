"""Text extractors. Each returns a list of units: {"text", "locator"} where locator says where inside the file."""
import threading
from datetime import datetime
from pathlib import Path

from .media import AUDIO_EXT, VIDEO_EXT

KINDS = {
    ".pdf": "pdf", ".docx": "docx", ".pptx": "pptx", ".xlsx": "sheet",
    ".txt": "text", ".md": "text", ".csv": "text", ".rtf": "text", ".log": "text",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image", ".bmp": "image", ".gif": "image",
    **{e: "video" for e in VIDEO_EXT},
    **{e: "audio" for e in AUDIO_EXT},
}
# Read the inside of a file only within these sizes; everything else is still findable by name.
MAX_BYTES = {"pdf": 150 << 20, "docx": 60 << 20, "pptx": 200 << 20, "sheet": 30 << 20, "text": 5 << 20,
             "image": 40 << 20, "video": 8 << 30, "audio": 1 << 30}
MIN_IMAGE_BYTES = 12 << 10  # smaller images are icons and UI assets, not photos or screenshots

_ocr = None
_ocr_lock = threading.Lock()


def kind_of(path: Path) -> str:
    return KINDS.get(path.suffix.lower(), "other")


def readable(kind: str, size: int) -> bool:
    """Whether MAT-AH should open this file and read its content (vs. name and metadata only)."""
    if kind not in MAX_BYTES or size == 0 or size > MAX_BYTES[kind]:
        return False
    return not (kind == "image" and size < MIN_IMAGE_BYTES)


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


def extract_xlsx(path: Path) -> list[dict]:
    from openpyxl import load_workbook
    wb = load_workbook(str(path), read_only=True, data_only=True)
    units = []
    for ws in wb.worksheets[:20]:
        rows = []
        for row in ws.iter_rows(values_only=True, max_row=2000):
            cells = [str(c) for c in row if c is not None and str(c).strip()]
            if cells:
                rows.append(" | ".join(cells))
        if rows:
            units.append({"text": f"[{ws.title}]\n" + "\n".join(rows), "locator": {"sheet": ws.title}})
    wb.close()
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
    elif kind == "sheet":
        units = extract_xlsx(path)
    elif kind == "image":
        units, taken = extract_image(path)
    else:
        units = []
    return kind, units, taken
