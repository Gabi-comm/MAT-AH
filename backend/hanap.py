"""Hanap: Taglish query parser (rules first, LLM only as fallback) + hybrid retrieval with RRF."""
import json
import re
import time
import unicodedata
from datetime import datetime, timedelta

from . import llm, visual, winsearch
from .index import VECTORS, VISUAL

KIND_WORDS = {
    "image": ["screenshot", "screenshots", "ss", "screencap", "litrato", "larawan", "picture", "pictures", "pic",
              "pics", "photo", "photos", "image", "images", "imahe", "retrato", "png", "jpg", "jpeg"],
    "pdf": ["pdf", "pdfs"],
    "pptx": ["slides", "slide", "ppt", "pptx", "presentation", "deck", "powerpoint"],
    "docx": ["docx", "word", "doc"],
    "text": ["txt", "markdown"],
    "sheet": ["excel", "xlsx", "spreadsheet"],
    "video": ["video", "videos", "vid", "bidyo", "mp4", "recording", "clip", "clips"],
    "audio": ["audio", "voice", "mp3", "song", "kanta", "podcast"],
}
WORD_TO_KIND = {w: k for k, ws in KIND_WORDS.items() for w in ws}

# Small Taglish -> English bridge; the vector side handles the rest of the meaning.
SYNONYMS = {
    "resibo": ["receipt"], "receipt": ["resibo"], "bayad": ["payment", "paid"], "binayaran": ["paid", "payment"],
    "matrikula": ["tuition"], "tuition": ["matrikula"], "iskedyul": ["schedule"], "sched": ["schedule"],
    "klase": ["class"], "kailangan": ["requirements"], "requirements": ["kailangan", "reqs"],
    "reqs": ["requirements"], "enrolment": ["enrollment"], "pagpapatala": ["enrollment"],
    "huling": ["deadline", "last"], "petsa": ["date"], "anunsyo": ["announcement"], "announcement": ["anunsyo"],
    "pera": ["money", "amount"], "halaga": ["amount"], "grado": ["grades"], "marka": ["grades"],
    "takdang": ["assignment"], "aralin": ["lesson"], "pagsusulit": ["exam", "quiz"], "exam": ["pagsusulit"],
    "gcash": ["e-wallet"], "ewallet": ["e-wallet"], "padala": ["transfer", "sent"],
}

STOP = set("""yung ung iyong iyon yun ang ng nang sa na mga ko ni si kay tungkol ano anong saan nasaan asan nga po
ba pa lang din rin dun doon at o mo akin natin namin ito iyan diyan dito kasi kung pag para may meron wala
the a an of for about my me find hanapin pakihanap hanap show where is are files file based can you please and or
with to in on from that this what when which there here i we our your it its be was were do does did get
need want look looking kay kina sila siya nila niya ka kayo tayo kami""".split())

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
     "november", "december"], start=1)}
MONTHS.update({m[:3]: i for m, i in list(MONTHS.items())})
MONTHS.update({"enero": 1, "pebrero": 2, "marso": 3, "abril": 4, "mayo": 5, "hunyo": 6, "hulyo": 7,
               "agosto": 8, "setyembre": 9, "oktubre": 10, "nobyembre": 11, "disyembre": 12})

AMOUNT_RE = re.compile(r"(?:₱|php\s?|p(?=\d))\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?|\b(\d+(?:\.\d+)?)\s*k\b|\b(\d{1,3}(?:,\d{3})+|\d{3,})(?:\.\d+)?\b",
                       re.I)

RRF_K = 60


def fold(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)).lower()


def _month_range(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1)
    end = datetime(year + (month == 12), month % 12 + 1, 1)
    return start, end


def parse_time(q: str, now: datetime) -> tuple[tuple[datetime, datetime] | None, str | None, str]:
    """Returns (range, label, query with the time words removed)."""
    rules = [
        (r"\b(kahapon|yesterday)\b", lambda m: ((now - timedelta(days=1)).replace(hour=0, minute=0, second=0),
                                                now.replace(hour=0, minute=0, second=0)), "yesterday"),
        (r"\b(ngayong araw|today|kanina)\b", lambda m: (now.replace(hour=0, minute=0, second=0), now + timedelta(days=1)), "today"),
        (r"\b(last week|nakaraang linggo|noong isang linggo|nung isang linggo)\b",
         lambda m: (now - timedelta(days=14), now), "last 2 weeks"),
        (r"\b(this week|ngayong linggo)\b", lambda m: (now - timedelta(days=7), now + timedelta(days=1)), "this week"),
        (r"\b(last month|nakaraang buwan|nung isang buwan)\b", lambda m: (now - timedelta(days=62), now), "last month"),
        (r"\b(last sem|last semester|nakaraang sem)\b", lambda m: (now - timedelta(days=270), now - timedelta(days=60)), "last sem"),
        (r"\b(this year|ngayong taon)\b", lambda m: (datetime(now.year, 1, 1), now + timedelta(days=1)), str(now.year)),
        (r"\b(last year|nakaraang taon)\b", lambda m: (datetime(now.year - 1, 1, 1), datetime(now.year, 1, 1)), str(now.year - 1)),
    ]
    for pat, fn, label in rules:
        m = re.search(pat, q, re.I)
        if m:
            return fn(m), label, (q[:m.start()] + " " + q[m.end():])
    m = re.search(r"\b(?:nung|noong|last|in|sa|ng)?\s*(" + "|".join(sorted(MONTHS, key=len, reverse=True)) +
                  r")\b\.?\s*(\d{4})?", q, re.I)
    if m and (m.group(0).strip().lower() not in ("may", "mar") or m.group(2)):  # 'may' is also Filipino 'there is'
        month = MONTHS[m.group(1).lower()]
        year = int(m.group(2)) if m.group(2) else (now.year if month <= now.month else now.year - 1)
        return _month_range(year, month), f"{m.group(1).title()} {year}", q[:m.start()] + " " + q[m.end():]
    return None, None, q


def parse_amounts(q: str) -> tuple[list[float], str]:
    found = []
    for m in AMOUNT_RE.finditer(q):
        raw = m.group(1) or m.group(3) or m.group(4)
        if not raw:
            continue
        val = float(raw.replace(",", ""))
        if m.group(2) or (m.group(3) and not m.group(1)):
            val *= 1000
        if 1900 <= val <= 2100 and not m.group(1) and "," not in raw:  # that's a year, not money
            continue
        found.append(val)
    q2 = AMOUNT_RE.sub(lambda m: " " if (m.group(1) or m.group(3) or (m.group(4) and "," in m.group(4))) else m.group(0), q)
    return found, q2


def amount_variants(v: float) -> list[str]:
    """Forms an amount takes in extracted text, as FTS phrases."""
    whole = int(v)
    out = {str(whole)}
    if whole >= 1000:
        out.add(f"{whole:,}".replace(",", " "))  # '1,500' tokenizes to '1 500'
    return sorted(out)


def parse(q: str, now: datetime | None = None, use_llm: bool = True) -> dict:
    now = now or datetime.now()
    out = {"raw": q, "kinds": [], "date": None, "date_label": None, "amounts": [], "phrases": [], "terms": [],
           "llm": False}
    phrases = re.findall(r'"([^"]+)"', q)
    rest = re.sub(r'"[^"]+"', " ", q)
    rng, label, rest = parse_time(rest, now)
    if rng:
        out["date"], out["date_label"] = [rng[0].isoformat(), rng[1].isoformat()], label
    amounts, rest = parse_amounts(rest)
    out["amounts"], out["phrases"] = amounts, phrases
    terms = []
    for tok in re.findall(r"[\w'-]+", fold(rest)):
        tok = tok.strip("'-")
        if tok in WORD_TO_KIND:
            k = WORD_TO_KIND[tok]
            if k not in out["kinds"]:
                out["kinds"].append(k)
            continue
        if tok in STOP or len(tok) < 2:
            continue
        terms.append(tok)
    out["terms"] = terms
    structured = out["kinds"] or out["date"] or out["amounts"] or phrases
    if use_llm and not structured and len(terms) >= 8 and llm.available():
        try:
            r = llm.chat_json(
                "Extract file-search fields from a Filipino/English/Taglish request. Keywords must be the "
                "distinctive content words (translate Filipino to English too). kinds is a subset of "
                "image,pdf,pptx,docx,text.",
                q, {"type": "object", "properties": {
                    "keywords": {"type": "array", "items": {"type": "string"}},
                    "kinds": {"type": "array", "items": {"type": "string"}}},
                    "required": ["keywords", "kinds"]})
            out["terms"] = list(dict.fromkeys(terms + [fold(k) for k in r.get("keywords", []) if k.strip()]))[:16]
            out["kinds"] = [k for k in r.get("kinds", []) if k in KIND_WORDS]
            out["llm"] = True
        except Exception:
            pass
    return out


def _fts_escape(t: str) -> str:
    return '"' + t.replace('"', '""') + '"'


def fts_query(p: dict) -> str:
    parts = []
    for t in p["terms"]:
        alts = [t] + SYNONYMS.get(t, [])
        for a in alts:
            for w in re.findall(r"\w+", a):
                parts.append(_fts_escape(w) + ("*" if len(w) >= 4 else ""))
    for ph in p["phrases"]:
        parts.append(_fts_escape(fold(ph)))
    for v in p["amounts"]:
        parts.extend(_fts_escape(a) for a in amount_variants(v))
    return " OR ".join(dict.fromkeys(parts))


def _fts(con, query: str, limit: int = 50) -> list[int]:
    if not query:
        return []
    try:
        rows = con.execute(
            "SELECT chunk_id FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts, 0, 1.0, 2.0, 1.5) LIMIT ?",
            (query, limit)).fetchall()
    except Exception:
        return []
    return [int(r[0]) for r in rows]


def _in_range(f, rng) -> bool:
    if not rng:
        return True
    ts = f["taken_at"] or datetime.fromtimestamp(f["mtime"]).isoformat()
    return rng[0] <= ts < rng[1]


def _snippet(text: str, needles: list[str], width: int = 220) -> str:
    low = fold(text)
    pos = -1
    for n in needles:
        i = low.find(n)
        if i >= 0 and (pos < 0 or i < pos):
            pos = i
    start = max(0, pos - 70) if pos >= 0 else 0
    s = re.sub(r"\s+", " ", text[start:start + width]).strip()
    return ("…" if start > 0 else "") + s + ("…" if start + width < len(text) else "")


# Visual (CLIP) cosine floors: below these a "match" is noise. Calibrated in eval/visual_check.
VIS_MIN_VISUAL_QUERY = 0.20  # the query asks for a picture/video ("litrato ng aso")
VIS_MIN_ANY_QUERY = 0.27     # any other query: only strong visual matches join in
WEIGHTS = {"keyword": 1.0, "meaning": 1.0, "visual": 1.0, "windows": 0.8}
WHY = {"keyword": "words", "meaning": "meaning", "visual": "looks like", "windows": "Windows index"}


def _file_ranking(con, chunk_ids: list[int]) -> list[tuple[int, int]]:
    """Chunk ranking -> file ranking, keeping each file's best chunk: [(file_id, chunk_id)]."""
    if not chunk_ids:
        return []
    q = ",".join("?" * len(chunk_ids))
    owner = {r[0]: r[1] for r in con.execute(f"SELECT id, file_id FROM chunks WHERE id IN ({q})", chunk_ids)}
    seen, out = set(), []
    for cid in chunk_ids:
        fid = owner.get(cid)
        if fid is not None and fid not in seen:
            seen.add(fid)
            out.append((fid, cid))
    return out


def _visual_ranking(con, text: str, floor: float, k: int = 80) -> list[tuple[int, None, dict]]:
    """CLIP text->image: [(file_id, None, {"t": best frame time, "visual": score})], best frame per file."""
    if not len(VISUAL) or not visual.ready():
        return []
    qv = visual.embed_text([text])[0]
    vis = [(vid, s) for vid, s in VISUAL.search(qv, k) if s >= floor]
    if not vis:
        return []
    q = ",".join("?" * len(vis))
    rows = {r[0]: (r[1], r[2]) for r in con.execute(f"SELECT id, file_id, t FROM visual WHERE id IN ({q})",
                                                    [v[0] for v in vis])}
    seen, out = set(), []
    for vid, s in vis:
        fid, t = rows.get(vid, (None, None))
        if fid is None or fid in seen:
            continue
        seen.add(fid)
        loc = {"visual": round(s, 3)}
        if t is not None:
            loc["t"] = t
        out.append((fid, None, loc))
    return out


def search(con, q: str, limit: int = 20, mode: str = "hybrid", use_llm: bool = True) -> dict:
    """mode 'hybrid' fuses every source; 'keyword' is FTS only (the eval baseline)."""
    timings: dict[str, float] = {}
    t0 = time.perf_counter()
    p = parse(q, use_llm=use_llm)
    timings["parse"] = round((time.perf_counter() - t0) * 1000, 1)
    t1 = time.perf_counter()
    lists: dict[str, list] = {"keyword": [(f, c, {}) for f, c in _file_ranking(con, _fts(con, fts_query(p)))]}
    wants_visual = any(k in p["kinds"] for k in ("image", "video"))
    if mode == "hybrid":
        if len(VECTORS) and llm.embed_available():
            try:
                qv = llm.embed([q if len(q) < 300 else " ".join(p["terms"])], "query")[0]
                ids = [cid for cid, s in VECTORS.search(qv, 60) if s > 0.2]
                lists["meaning"] = [(f, c, {}) for f, c in _file_ranking(con, ids)]
            except Exception:
                pass
        try:
            clip_text = " ".join(p["terms"] + p["phrases"]) or q
            lists["visual"] = _visual_ranking(con, clip_text,
                                              VIS_MIN_VISUAL_QUERY if wants_visual else VIS_MIN_ANY_QUERY)
        except Exception:
            pass
        if winsearch.available():
            from .scan import ensure_listed
            terms = p["terms"] + p["phrases"] + [str(int(a)) for a in p["amounts"]]
            scopes = [r[0] for r in con.execute("SELECT path FROM roots")]
            out = []
            for path, _rank in winsearch.search(terms, scopes, 30):
                try:
                    fid = ensure_listed(con, path)
                except Exception:
                    fid = None
                if fid:
                    out.append((fid, None, {}))
            lists["windows"] = out
    lists = {k: v for k, v in lists.items() if v}
    timings["retrieve"] = round((time.perf_counter() - t1) * 1000, 1)

    # Reciprocal rank fusion over files; each file keeps its best chunk and, for video, its best moment.
    score: dict[int, float] = {}
    why: dict[int, set] = {}
    best: dict[int, tuple[int | None, dict]] = {}
    for src, ranking in lists.items():
        w = WEIGHTS[src] * (1.4 if src == "visual" and wants_visual else 1.0)
        for rank, (fid, cid, loc) in enumerate(ranking):
            score[fid] = score.get(fid, 0) + w / (RRF_K + rank + 1)
            why.setdefault(fid, set()).add(WHY[src])
            cur_c, cur_loc = best.get(fid, (None, {}))
            best[fid] = (cur_c if cur_c is not None else cid, {**loc, **cur_loc} if cur_c is not None else {**cur_loc, **loc})
    hits = _build_hits(con, score, why, best, p)

    relaxed = []
    filtered = hits
    if p["kinds"]:
        f2 = [h for h in filtered if h["file"]["kind"] in p["kinds"]]
        if not f2 and hits:
            f2 = _kind_browse(con, p)
        filtered = f2 if f2 else filtered
        if not f2:
            relaxed.append("type")
    if p["date"]:
        f3 = [h for h in filtered if _in_range(h["file"], p["date"])]
        if f3:
            filtered = f3
        else:
            relaxed.append("date")
    queued = [h["file"]["id"] for h in filtered[:10] if h["file"]["status"] == "queued"]
    if queued:
        from .scan import prioritize
        prioritize(con, queued)  # read these next, so the following search shows what's inside them
    return {"query": p, "hits": filtered[:limit], "timings": timings, "relaxed": relaxed,
            "mode": "hybrid" if len(lists) > 1 else "keyword", "sources": sorted(lists),
            "llm_model": llm.chat_model() if p["llm"] else None}


def _kind_browse(con, p) -> list[dict]:
    rows = con.execute(f"SELECT * FROM files WHERE kind IN ({','.join('?' * len(p['kinds']))}) "
                       "ORDER BY mtime DESC LIMIT 50", p["kinds"]).fetchall()
    out = []
    for f in rows:
        c = con.execute("SELECT id, text, locator FROM chunks WHERE file_id=? ORDER BY id LIMIT 1", (f["id"],)).fetchone()
        out.append(_hit(f, c, 0.0, {"type"}, p))
    return out


def _hit(f, c, score, why, p, loc_extra: dict | None = None) -> dict:
    needles = p["terms"] + [fold(x) for x in p["phrases"]] + [a for v in p["amounts"] for a in amount_variants(v)]
    needles += [f"{int(v):,}" for v in p["amounts"] if v >= 1000] + [s for t in p["terms"] for s in SYNONYMS.get(t, [])]
    loc = json.loads(c["locator"]) if c else {}
    if loc_extra:
        loc = {**loc, **loc_extra}
    return {
        "file": {k: f[k] for k in ("id", "path", "name", "ext", "kind", "size", "mtime", "taken_at", "status")},
        "chunk_id": c["id"] if c else None,
        "locator": loc,
        "snippet": _snippet(c["text"], needles) if c and c["text"] else "",
        "score": round(score, 5),
        "why": sorted(why),
        "highlight": needles,
    }


def _build_hits(con, score, why, best, p) -> list[dict]:
    if not score:
        return []
    q = ",".join("?" * len(score))
    files = {f["id"]: f for f in con.execute(f"SELECT * FROM files WHERE id IN ({q})", list(score))}
    hits = []
    for fid, s in score.items():
        f = files.get(fid)
        if not f:
            continue
        cid, loc = best.get(fid, (None, {}))
        if cid is not None:
            c = con.execute("SELECT id, text, locator FROM chunks WHERE id=?", (cid,)).fetchone()
        else:  # found by sight or by the Windows index: show its first chunk
            c = con.execute("SELECT id, text, locator FROM chunks WHERE file_id=? ORDER BY id LIMIT 1", (fid,)).fetchone()
        if p["amounts"] and c:  # exact amounts are strong evidence for receipts
            norm = re.sub(r"[,\s.]", "", c["text"])
            if any(str(int(v)) in norm for v in p["amounts"]):
                s *= 1.5
        hits.append(_hit(f, c, s, why.get(fid, set()), p, loc))
    hits.sort(key=lambda h: -h["score"])
    return hits


READ_NOW_KINDS = {"pdf", "docx", "pptx", "sheet", "text", "image"}


def top_chunks(con, q: str, k: int = 6) -> tuple[list[dict], dict]:
    """Best content chunks for Sagot. Files MAT-AH hasn't read yet are read right now (scan on demand)."""
    res = search(con, q, limit=12)
    unread = [h for h in res["hits"][:6] if h["file"]["status"] == "queued" and h["file"]["kind"] in READ_NOW_KINDS]
    if unread:
        from .scan import read_file
        t = time.perf_counter()
        for h in unread[:4]:
            read_file(con, h["file"]["id"])
        res = search(con, q, limit=12)
        res["timings"]["read_now"] = round((time.perf_counter() - t) * 1000, 1)
        res["read_now"] = [h["file"]["name"] for h in unread[:4]]
    out, seen = [], set()
    for h in res["hits"]:
        if not h["chunk_id"] or h["chunk_id"] in seen:
            continue
        row = con.execute("SELECT text, locator FROM chunks WHERE id=?", (h["chunk_id"],)).fetchone()
        if row["locator"] == "{}" and h["file"]["kind"] != "text":  # only a file name, nothing to quote
            continue
        seen.add(h["chunk_id"])
        h["text"] = row["text"]
        out.append(h)
        if len(out) >= k:
            break
    return out, res
