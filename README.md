# MAT-AH

**Remember what it was, not where you saved it.**

MAT-AH is one private place to find and act on the files scattered across your laptop: receipts, school announcements, lecture slides, notes and the screenshots on your phone-synced folders. You describe a file the way you remember it, in English, Filipino or Taglish, and MAT-AH finds it, answers questions from it with page citations, cleans up duplicates and organizes folders, but only after you say yes.

Everything runs on your Windows laptop. Indexing, search, answers and file actions work with Wi-Fi off; nothing is uploaded.

| Agent | What it does |
|---|---|
| **Hanap** (find) | Taglish search by content: "yung screenshot ng enrollment requirements". Keyword + meaning search, type/date/amount filters, opens the file at the right page. |
| **Sagot** (answer) | Answers from your files with clickable `[n]` page citations. A grounding verifier rejects any answer whose numbers or dates are not in the cited source, and says "insufficient evidence" instead of guessing. |
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
powershell -ExecutionPolicy Bypass -File .\run.ps1 -Demo
```

`run.ps1` creates `.venv`, installs `requirements.txt`, builds the UI, regenerates the synthetic demo folder (`-Demo`) and opens <http://127.0.0.1:8765>. Press **Add folder** and choose `demo_data\My Files` (or any folder of your own). RapidOCR downloads nothing; its ONNX models ship inside the pip package.

MAT-AH picks the first installed chat model from `gemma4:e4b, gemma4:e2b, qwen3:8b, qwen3:1.7b, llama3.2`. Override with `$env:MATAH_LLM = 'gemma4:e2b'`. Never use tags ending in `-cloud`: they run on Ollama's servers.

Tests and evaluation:

```powershell
.venv\Scripts\python -m pytest -q          # path guard, verifier, Linis, Kilos NO / YES+Undo, parser
.venv\Scripts\python -m eval.run_eval      # writes eval/results.md
```

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

Code map: `backend/` (`app.py` routes · `folders.py` roots and path guard · `scan.py`, `extract.py`, `chunk.py` indexing · `index.py` SQLite and vector store · `hanap.py`, `sagot.py`, `linis.py`, `kilos.py` agents · `llm.py` the only Ollama client · `status.py`), `web/` (React + Vite + TypeScript), `scripts/make_demo_data.py`, `eval/`, `tests/`.

## Evaluation

Measured on the synthetic demo set; see [`eval/results.md`](eval/results.md) for the full table, misses and timings. Numbers in the pitch come only from that file.

## Disclosures

- **Runs locally:** everything at runtime. **Needs internet:** only the one-time download of the Ollama models and the Python/npm packages.
- **Models:** the chat model you pulled (default `gemma4:e4b`), `embeddinggemma`, RapidOCR's bundled ONNX models.
- **Frameworks:** FastAPI, uvicorn, React, Vite, SQLite FTS5, PyMuPDF, python-docx, python-pptx, Pillow, NumPy, send2trash, Ollama Python client. Font: Atkinson Hyperlegible (bundled via Fontsource).
- **Cloud services at runtime:** none.
- **Demo data:** fully synthetic, every file marked SAMPLE; the school ("Bagong Liwayway State College") and e-wallet ("PayLokal") are made up.
- **AI-assisted tools:** Claude (planning and Claude Code for implementation).
