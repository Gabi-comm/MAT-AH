"""Video and audio: sample keyframes (for CLIP and on-screen text) and transcribe speech with timestamps.
Every unit keeps {"t": seconds} so a hit opens the video at that moment."""
import os
import threading

import numpy as np

VIDEO_EXT = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v", ".wmv", ".3gp"}
AUDIO_EXT = {".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".opus", ".wma"}
WHISPER_MODEL = os.environ.get("MATAH_WHISPER", "base")  # tiny | base | small | large-v3-turbo
MAX_FRAMES = 40
MAX_TRANSCRIBE_S = 45 * 60

_w = {"model": None, "error": None}
_wlock = threading.Lock()


def keyframes(path, max_frames: int = MAX_FRAMES) -> tuple[list[tuple[float, "object"]], float]:
    """Evenly spaced frames (at least every 5 s apart). Returns ([(t, PIL.Image)], duration_s)."""
    import cv2
    from PIL import Image
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return [], 0.0
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    n = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    dur = n / fps if fps > 0 else 0.0
    if dur <= 0:
        cap.release()
        return [], 0.0
    step = max(5.0, dur / max_frames)
    times = list(np.arange(min(1.0, dur / 2), dur, step))[:max_frames]
    frames = []
    for t in times:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, frame = cap.read()
        if not ok:
            continue
        img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        img.thumbnail((640, 640))
        frames.append((round(float(t), 1), img))
    cap.release()
    return frames, dur


def frame_at(path, t: float, width: int = 480) -> bytes | None:
    import cv2
    cap = cv2.VideoCapture(str(path))
    cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, t) * 1000)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        return None
    h, w = frame.shape[:2]
    frame = cv2.resize(frame, (width, int(h * width / w)))
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return buf.tobytes() if ok else None


def whisper_installed() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except Exception:
        return False


def _whisper():
    with _wlock:
        if _w["model"] is None and not _w["error"]:
            try:
                from faster_whisper import WhisperModel
                _w["model"] = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
            except Exception as e:
                _w["error"] = f"{e.__class__.__name__}: {e}"[:300]
        return _w["model"]


def transcribe(path) -> list[dict]:
    """Speech as ~30 s windows: [{"text", "locator": {"t": start, "end": end}}]. Empty when no speech."""
    model = _whisper() if whisper_installed() else None
    if model is None:
        return []
    segments, info = model.transcribe(str(path), vad_filter=True, beam_size=1)
    units, buf, start = [], [], None
    for seg in segments:
        if seg.start > MAX_TRANSCRIBE_S:
            break
        if start is None:
            start = seg.start
        buf.append(seg.text.strip())
        if seg.end - start >= 30:
            units.append({"text": " ".join(buf), "locator": {"t": round(start, 1), "end": round(seg.end, 1)}})
            buf, start = [], None
    if buf:
        units.append({"text": " ".join(buf), "locator": {"t": round(start or 0, 1)}})
    return units


def status() -> dict:
    return {"whisper_model": WHISPER_MODEL, "whisper_installed": whisper_installed(),
            "whisper_loaded": _w["model"] is not None, "whisper_error": _w["error"]}
