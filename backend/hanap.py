"""Hanap: Taglish query parser (rules first, LLM only as fallback) + hybrid retrieval with RRF."""
import json
import re
import time
import unicodedata
from datetime import datetime, timedelta

from . import llm
from .index import VECTORS

KIND_WORDS = {
    "image": ["screenshot", "screenshots", "ss", "screencap", "litrato", "larawan", "picture", "pictures", "pic",
              "pics", "photo", "photos", "image", "images", "imahe", "retrato", "png", "jpg", "jpeg"],
    "pdf": ["pdf", "pdfs"],
    "pptx": ["slides", "slide", "ppt", "pptx", "presentation", "deck", "powerpoint"],
    "docx": ["docx", "word", "doc"],
    "text": ["txt", "markdown"],
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


def search(con, q: str, limit: int = 20, mode: str = "hybrid", use_llm: bool = True) -> dict:
    timings = {}
    t0 = time.perf_counter()
    p = parse(q, use_llm=use_llm)
    timings["parse"] = round((time.perf_counter() - t0) * 1000, 1)

    t1 = time.perf_counter()
    fts_ids = _fts(con, fts_query(p))
    vec_ids: list[int] = []
    vector_used = False
    if mode == "hybrid" and len(VECTORS) and llm.embed_available():
        try:
            sem = " ".join(p["terms"] + p["phrases"]) or q
            qv = llm.embed([q if len(q) < 300 else sem], "query")[0]
            vec_ids = [cid for cid, s in VECTORS.search(qv, 50) if s > 0.2]
            vector_used = True
        except Exception:
            vec_ids = []
    fused: dict[int, float] = {}
    why: dict[int, set] = {}
    for rank, cid in enumerate(fts_ids):
        fused[cid] = fused.get(cid, 0) + 1 / (RRF_K + rank + 1)
        why.setdefault(cid, set()).add("keyword")
    for rank, cid in enumerate(vec_ids):
        fused[cid] = fused.get(cid, 0) + 1 / (RRF_K + rank + 1)
        why.setdefault(cid, set()).add("meaning")

    hits = _group(con, fused, why, p)
    # Filters are hard unless they would empty the list; then they're reported as relaxed.
    relaxed = []
    filtered = hits
    if p["kinds"]:
        f2 = [h for h in filtered if h["file"]["kind"] in p["kinds"]]
        if not f2 and hits:
            # nothing matched the words; fall back to all files of that kind in the date window
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
    timings["retrieve"] = round((time.perf_counter() - t1) * 1000, 1)
    return {"query": p, "hits": filtered[:limit], "timings": timings, "relaxed": relaxed,
            "mode": "hybrid" if vector_used else "keyword", "llm_model": llm.chat_model() if p["llm"] else None}


def _kind_browse(con, p) -> list[dict]:
    rows = con.execute(f"SELECT * FROM files WHERE kind IN ({','.join('?' * len(p['kinds']))}) ORDER BY mtime DESC LIMIT 50",
                       p["kinds"]).fetchall()
    out = []
    for f in rows:
        c = con.execute("SELECT id, text, locator FROM chunks WHERE file_id=? ORDER BY id LIMIT 1", (f["id"],)).fetchone()
        out.append(_hit(f, c, 0.0, {"type"}, p))
    return out


def _hit(f, c, score, why, p) -> dict:
    needles = p["terms"] + [fold(x) for x in p["phrases"]] + [a for v in p["amounts"] for a in amount_variants(v)]
    needles += [f"{int(v):,}" for v in p["amounts"] if v >= 1000] + [SYN for t in p["terms"] for SYN in SYNONYMS.get(t, [])]
    return {
        "file": {k: f[k] for k in ("id", "path", "name", "ext", "kind", "size", "mtime", "taken_at")},
        "chunk_id": c["id"] if c else None,
        "locator": json.loads(c["locator"]) if c else {},
        "snippet": _snippet(c["text"], needles) if c else "",
        "score": round(score, 5),
        "why": sorted(why),
        "highlight": needles,
    }


def _group(con, fused: dict[int, float], why: dict[int, set], p: dict) -> list[dict]:
    if not fused:
        return []
    ids = list(fused)
    q = ",".join("?" * len(ids))
    rows = con.execute(f"SELECT c.id, c.text, c.locator, c.file_id FROM chunks c WHERE c.id IN ({q})", ids).fetchall()
    by_file: dict[int, list] = {}
    for r in rows:
        by_file.setdefault(r["file_id"], []).append(r)
    if not by_file:
        return []
    files = {f["id"]: f for f in con.execute(
        f"SELECT * FROM files WHERE id IN ({','.join('?' * len(by_file))})", list(by_file)).fetchall()}
    hits = []
    for fid, chunks in by_file.items():
        f = files.get(fid)
        if not f:
            continue
        chunks.sort(key=lambda r: -fused[r["id"]])
        best = chunks[0]
        # File score: best chunk plus a small bonus for additional matching chunks.
        score = fused[best["id"]] + 0.15 * sum(fused[r["id"]] for r in chunks[1:4])
        # Amount boost: exact amounts are strong evidence for receipts.
        if p["amounts"]:
            norm = re.sub(r"[,\s]", "", best["text"])
            if any(str(int(v)) in norm for v in p["amounts"]):
                score *= 1.5
        w = set()
        for r in chunks:
            w |= why.get(r["id"], set())
        hits.append(_hit(f, best, score, w, p))
    hits.sort(key=lambda h: -h["score"])
    return hits


def top_chunks(con, q: str, k: int = 6) -> tuple[list[dict], dict]:
    """Best chunks across files for Sagot: the best chunk of each top file, then runners-up."""
    res = search(con, q, limit=12)
    out, seen = [], set()
    for h in res["hits"]:
        if h["chunk_id"] and h["chunk_id"] not in seen:
            seen.add(h["chunk_id"])
            out.append(h)
        if len(out) >= k:
            break
    for h in out:
        h["text"] = con.execute("SELECT text FROM chunks WHERE id=?", (h["chunk_id"],)).fetchone()[0]
    return out, res
