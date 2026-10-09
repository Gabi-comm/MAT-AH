# MAT-AH

**Remember what it was, not where you saved it.**

MAT-AH is one private place to find and act on the files scattered across your laptop: receipts, school announcements, lecture slides, notes and the screenshots on your phone-synced folders. You describe a file the way you remember it, in English, Filipino or Taglish, and MAT-AH finds it, answers questions from it with page citations, cleans up duplicates and organizes folders, but only after you say yes.

Everything runs on your Windows laptop. Indexing, search, answers and file actions work with Wi-Fi off; nothing is uploaded.

| Agent | What it does |
|---|---|
| **Hanap** (find) | Taglish search across your whole computer: documents by their words and meaning, pictures by what they show ("litrato ng buwaya"), videos by what is seen or said, opened at the right page or moment. Type/date/amount filters. |
| **Sagot** (answer) | Answers from your files with clickable `[n]` page citations; files not read yet are read on the spot. With a vision model it also looks at the matching image. A grounding verifier rejects any answer whose numbers or dates are not in the cited source, and says "insufficient evidence" instead of guessing. |
| **Linis** (clean) | Exact duplicates (SHA-256), zero-byte files and empty folders. Report only. |
| **Kilos** (act) | Proposes a folder and moves, shows a before → after table, and does nothing until you press **Yes**. Every step is logged and **Undo** reverses it. Deletes go to the Recycle Bin. |
| **Tala** (note) | Notes on a file make it findable by the note's words. |

## Run it (Windows)

Prerequisites: [Ollama](https://ollama.com) for Windows, Python 3.12+ and Node 20+.

```powershell
# one-time, while online
ollama pull gemma4:e4b        # chat model (e2b on 8 GB RAM; qwen3:8b / qwen3:1.7b also work)
ollama pull embeddinggemma    # embeddings
git clone <this repo>; cd mat-ah
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

`run.ps1` creates `.venv`, installs `requirements.txt` (CPU PyTorch: `pip install torch --index-url https://download.pytorch.org/whl/cpu`), builds the UI and opens <http://127.0.0.1:8765>. On first run MAT-AH asks before reading anything; **Ok, I allow** starts reading your user folder (plus other non-system drives). First use downloads the multilingual CLIP weights (~1.4 GB) and Whisper `base` (~145 MB) from Hugging Face; after that everything runs offline. RapidOCR's ONNX models ship inside the pip package.

MAT-AH picks the first installed chat model from `gemma4:e4b, gemma4:e2b, qwen3:8b, qwen3:1.7b, llama3.2`. Override with `$env:MATAH_LLM = 'gemma4:e2b'`. Never use tags ending in `-cloud`: they run on Ollama's servers.

Tests and evaluation:

```powershell
.venv\Scripts\python -m pytest -q          # path guard, verifier, Linis, Kilos NO / YES+Undo, parser
.venv\Scripts\python -m eval.run_eval      # writes eval/results.md
```

## Whole-computer indexing

Reading a whole user folder happens in phases, so search is useful within minutes:

| Phase | What happens |
|---|---|
| Listing | Walk the user folder, skipping system folders, app data, caches and code dependencies (`node_modules`, `.git`, virtualenvs…). Every file becomes findable by name and folder. On the dev laptop: ~378k files on disk → ~38k listed in under a minute. |
| Reading | Documents and your own images first (text, OCR), newest first; then video keyframes and on-screen text; dataset images last. |
| Seeing | CLIP vectors for photos and video keyframes: visual search with no text needed. Your own photos are seen before any video is read. |
| Listening | Speech in videos and audio (faster-whisper `base`, int8 CPU), shortest files first, as timestamped passages. |
| Embedding | Meaning vectors for big files deferred from reading (books over 150 chunks). |
| Describing | Optional: a local vision model (gemma4) writes captions with Filipino/English keywords for recent images (`MATAH_CAPTION_LIMIT` per run). |

- **Windows Search bridge:** Hanap also queries the index Windows already keeps (`SystemIndex`, scoped to the folders you allowed). That gives full-text recall across the whole profile in ~0.4 s, even for files MAT-AH hasn't read yet; those files are then read first.
- **Datasets aren't your files:** folders with hundreds of same-type files (e.g. 9,000 YOLO training images) get visual vectors only and are read last; their label `.txt` files stay name-only.
- **Limits:** PDFs are read up to 500 pages (30 OCR'd scanned pages) and speech up to 45 minutes per file; anything larger is still found by name and by Windows Search.

## How it works

```
Index path (Re-index)                          Query path (every request)
authorized folders (native folder dialog)      web UI on 127.0.0.1
  → extract: PDF pages, DOCX, PPTX slides,       → Hanap: rule parser (type, time, amount words)
    TXT/MD, image OCR with word boxes                     + FTS5 BM25 and vector top-50, RRF fusion
  → chunk: one per page/slide, locator kept      → Sagot: top 6 chunks → local LLM → verifier
  → embed with embeddinggemma                    → Kilos/Linis: plan → YES/NO → execute + log
              ↘                                ↙
         one SQLite file: files · chunks · FTS5 · vectors · notes · proposals · operations
```

- **Every hit is a pointer plus a locator** (page, slide, character range or OCR word boxes), which is why a citation opens the PDF at its page and an image shows the matched words highlighted.
- **Vectors** are float32 blobs in SQLite, loaded into one NumPy matrix; a search is one matrix-vector product.
- **Most searches don't call the LLM.** Only Sagot, Kilos and long unstructured queries do. If Ollama is down, keyword search, Linis and opening files keep working.
- **Safety:** the server binds 127.0.0.1 only; the browser sends file ids, never paths; every path is resolved and re-checked against the authorized folders before any read or move; Kilos's validator drops file ids the model invented and keeps destinations inside your folders.

Code map: `backend/` (`app.py` routes · `folders.py` roots and path guard · `scan.py`, `extract.py`, `chunk.py` indexing · `media.py` video/audio · `visual.py` CLIP · `winsearch.py` Windows Search bridge · `index.py` SQLite and vector store · `hanap.py`, `sagot.py`, `linis.py`, `kilos.py` agents · `llm.py` the only Ollama client · `status.py`), `web/` (React + Vite + TypeScript), `scripts/make_demo_data.py`, `eval/`, `tests/`.

## Evaluation

Measured on the synthetic demo set; see [`eval/results.md`](eval/results.md) for the full table, misses and timings. Numbers in the pitch come only from that file.

## Disclosures

- **Runs locally:** everything at runtime. **Needs internet:** only the one-time download of the Ollama models and the Python/npm packages.
- **Models:** the chat model you pulled (default `gemma4:e4b`), `embeddinggemma`, RapidOCR's bundled ONNX models, LAION multilingual CLIP (`xlm-roberta-base-ViT-B-32`, `laion5b_s13b_b90k`) via open_clip, Whisper `base` via faster-whisper.
- **Frameworks:** FastAPI, uvicorn, React, Vite, SQLite FTS5, PyMuPDF, python-docx, python-pptx, openpyxl, Pillow, NumPy, OpenCV, PyTorch (CPU), open_clip, faster-whisper, pywin32 (Windows Search), send2trash, Ollama Python client. Font: Atkinson Hyperlegible (bundled via Fontsource).
- **Cloud services at runtime:** none.
- **Test data:** `scripts/make_demo_data.py` makes fully synthetic documents for the tests and eval (no images), every file marked SAMPLE, and MAT-AH never indexes that folder; the school ("Bagong Liwayway State College") and e-wallet ("PayLokal") are made up.
- **AI-assisted tools:** Claude (planning and Claude Code for implementation).
