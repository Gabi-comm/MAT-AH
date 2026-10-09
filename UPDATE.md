# MAT-AH — System Update

**Date:** October 10, 2026
**Scope:** from a demo-folder prototype to a private search assistant for the whole computer: documents, images and videos, in English, Filipino and Taglish, fully offline.

> **Remember what it was, not where you saved it.**

---

## 1. What changed in this update

| Before | Now |
|---|---|
| Searched only one folder you picked (a synthetic demo folder) | **Searches your whole computer**: your user folder plus other non-system drives, after you allow it in a first-run popup |
| Images were found only by the words inside them (OCR) | **Images are found by what they show**: "litrato ng sirang kalsada" finds road photos with no text in them |
| Videos and audio were found only by file name | **Videos by what's on screen and what's said**, opening at the matching second |
| Sagot answered only from files already read | **Sagot reads unread files on the spot** before answering, and can **look at the matching image** |
| One search source at a time | **Four sources fused**: keyword, meaning, visual and the Windows Search index, run in parallel |
| Chat model: qwen3:8b | **gemma4:e4b**: faster, answers in the asker's language, can see images |
| Folder-picker buttons | **"Ok, I allow" consent popup**: nothing is read until you agree |
| Synthetic demo images and suggested-search chips | **Removed.** The app shows only your real files |
| Prototype UI | **The team's MAT-AH UI** (React + Iris mascot) connected to the real backend |

---

## 2. Features

### Hanap: find a file by what you remember
- Describe a file in English, Filipino or Taglish: *"yung screenshot ng enrollment requirements"*, *"resibo na ₱1,500 nung December"*.
- **Understands your query:** file type (screenshot, litrato, slides, video…), time (kahapon, last week, nung December, last sem), amounts (₱1,500 / 1.5k) and quoted phrases. The parsed filters appear as pills.
- **Four sources, fused into one ranking** (reciprocal rank fusion):
  - **Words:** SQLite FTS5 over file text, names and notes, accent-insensitive.
  - **Meaning:** embeddinggemma vectors, so a search doesn't need the exact words.
  - **Looks like:** CLIP vectors for photos and video frames.
  - **Windows index:** the full-text index Windows already keeps, for instant recall of files MAT-AH hasn't read yet.
- **Opens the exact spot:** PDF at the cited page, video or audio at the matching second, image with the matching words highlighted.
- **File-name bonus:** "resume" puts *Resume - SOLOMON.pdf* first.
- Results the search surfaces that haven't been read yet are **read next in the background**, so the next search shows what's inside them.

### Sagot: answers from your files, with sources
- Answers cite numbered sources `[1]`, `[2]`; each citation opens the file at the right page, timestamp or image.
- **Grounding verifier:** every number, amount and date in the answer must appear in the source it cites (numbers you typed in your own question are allowed). Otherwise MAT-AH says *"Kulang ang ebidensya — insufficient evidence"* instead of guessing.
- **Scan on demand:** if the best matches haven't been read yet, Sagot reads up to 4 of them before answering.
- **Image questions:** with gemma4, Sagot also looks at the top matching image ("Ano ang ipinapakita ng confusion matrix screenshot ko?").
- Answers in the language you asked in.

### Linis: clean up
- Exact duplicates (SHA-256), zero-byte files and empty folders. **Report only**; any deletion goes through Kilos approval.

### Kilos: organize, only with your YES
- Proposes a new folder and the moves as a before → after table.
- **Nothing happens until you press Yes.** Every step is logged; **Undo** reverses it; deletions go to the Recycle Bin.
- A validator drops file ids the model invented and keeps every destination inside the folders you allowed.

### Tala: notes on files
- Add a note to any file ("pinasa ko kay Ma'am Reyes"); the note's words find the file by keyword and by meaning.

---

## 3. Whole-computer indexing

Reading a whole computer takes hours, so it happens in phases ordered to make search useful **within minutes**:

| # | Phase | What happens |
|---|---|---|
| 1 | **Listing** | Walks your folders, skipping system folders, app data, caches and code dependencies (`node_modules`, `.git`, virtualenvs…). Every file is findable by name and folder at once. On the dev laptop: ~378,000 files on disk became ~38,000 listed in **under a minute**. |
| 2 | **Reading** | Your documents and images first, newest first: PDF pages, Word, PowerPoint slides, Excel sheets, text and Markdown, OCR on screenshots and photos. |
| 3 | **Seeing** | CLIP vectors for your own photos, so visual search works early. |
| 4 | **Reading media** | Video keyframes (≈1 per 5 s, up to 40 per video): visual vectors plus on-screen text. |
| 5 | **Dataset images** | Training-set folders (e.g. 9,000 YOLO images): visual vectors only, no OCR, read last. |
| 6 | **Listening** | Speech in videos and audio as timestamped passages, shortest files first. |
| 7 | **Embedding** | Meaning vectors for big files that were deferred (books over 150 chunks). |
| 8 | **Describing** | Optional: gemma4 writes captions with English/Filipino keywords for recent images. |

- **Search keeps working through every phase,** and the indexer pauses for a few seconds whenever you search or ask.
- **Pause anytime** from the sidebar; the queue is saved and resumes where it stopped.
- **Datasets aren't your files:** a folder with 300+ files of one type (or 100+ in folders named `train`, `valid`, `test`, `images`, `labels`) is treated as a dataset. Its label files stay name-only and its images are seen but not OCR'd.
- **Limits:** PDFs up to 500 pages (30 OCR'd scanned pages); speech up to 45 minutes per file. Anything larger is still found by name and by Windows Search.

---

## 4. Integrations

Everything runs on the laptop. The internet is used only once, to download the models.

| Integration | Used for | Details |
|---|---|---|
| **Ollama: gemma4:e4b** | Sagot answers, Kilos plans, image questions, captions | Default chat and vision model. Fallbacks in order: gemma4:e2b, qwen3:8b, qwen3:1.7b, llama3.2. Thinking off; kept loaded 1 h |
| **Ollama: embeddinggemma** | Meaning search | Query/document prompt formats from the model card; vectors in SQLite, searched with NumPy |
| **CLIP (open_clip)** | Visual search for images and video frames | LAION multilingual `xlm-roberta-base-ViT-B-32` (`laion5b_s13b_b90k`), so Filipino queries work; runs on CPU |
| **faster-whisper** | Speech in videos and audio | `base` model, int8 on CPU, voice-activity filter, repetition-loop guard |
| **RapidOCR (ONNX)** | Text in screenshots, photos, scanned PDF pages, video frames | Models ship inside the pip package |
| **Windows Search (SystemIndex)** | Instant whole-computer full-text recall | Queried over OLE DB with pywin32, scoped to the folders you allowed |
| **OpenCV** | Video keyframes and thumbnails | Comes with RapidOCR |
| **PyMuPDF · python-docx · python-pptx · openpyxl** | Reading PDF, Word, PowerPoint, Excel | PDFs keep page numbers; slides keep slide numbers |
| **SQLite + FTS5** | The one local index | files · chunks · keyword index · vectors · visual vectors · notes · proposals · operation log |
| **Windows shell** | Open, Show in folder, Recycle Bin | `os.startfile`, `explorer /select`, send2trash |
| **FastAPI + React (Vite)** | The app | Server on `127.0.0.1:8765` only; the UI lives at the repo root, is built to `dist/` and served by FastAPI; `npm run dev` runs from the repo root |

---

## 5. System architecture

```
                    ┌──────────── Web UI (React + Iris) on 127.0.0.1:8765 ────────────┐
                    │  Home · Hanap · Sagot · Kilos · Linis · Settings · consent popup │
                    └───────────────────────────────┬──────────────────────────────────┘
                                                    │ /api
   Index path (background)                          │            Query path (each request)
   listing → reading → seeing → media →             │   Hanap: parse → [words | meaning | looks like |
   datasets → listening → embedding → describing    │           Windows index] in parallel → fuse
              │                                     │   Sagot: top chunks (+ read on demand)
              ▼                                     ▼          → gemma4 (+ image) → verifier
        ┌──────────────────────── one SQLite file (data/matah.db) ────────────────────────┐
        │ files · chunks · chunks_fts · vectors · visual · notes · proposals · operations │
        └──────────────────────────────────────────────────────────────────────────────────┘
                    │ approved actions only                     ▲ instant recall
                    ▼                                           │
        Windows shell (open, reveal, move, Recycle Bin)   Windows Search index
```

**Safety rules, enforced in code:**
- The server listens on `127.0.0.1` only.
- The browser sends file ids, never paths.
- Every path is resolved and checked against the folders you allowed before any read or move.
- Nothing is moved or deleted without YES.
- No `-cloud` Ollama models are used.

### Backend code map
| File | Responsibility |
|---|---|
| `backend/app.py` | API routes; serves the UI |
| `backend/folders.py` | Allowed folders, path guard, extra drives, native picker |
| `backend/scan.py` | Phased indexing pipeline, dataset detection, on-demand and priority reading |
| `backend/extract.py` · `chunk.py` | Text, OCR and spreadsheet extraction; chunks that keep their page/slide/time locator |
| `backend/media.py` | Video keyframes, frame thumbnails, Whisper transcription |
| `backend/visual.py` | CLIP model (background load), image and text embeddings |
| `backend/winsearch.py` | Windows Search bridge |
| `backend/index.py` | SQLite schema, migrations, in-memory vector stores |
| `backend/hanap.py` | Query parser, parallel sources, fusion, ranking |
| `backend/sagot.py` | Answer prompt, image hand-off, grounding verifier |
| `backend/linis.py` · `kilos.py` | Cleanup report; proposals, approval, execution, undo |
| `backend/llm.py` | The only Ollama client: chat, vision, embeddings, caches |
| `backend/status.py` | Offline badge, loaded models, timings |

### API
| Area | Routes |
|---|---|
| Folders | `GET/POST /api/roots`, `POST /api/roots/computer`, `DELETE /api/roots/{id}` |
| Indexing | `POST /api/index`, `POST /api/index/stop`, `GET /api/index/status` |
| Hanap / Sagot | `GET /api/search?q=`, `POST /api/ask` |
| Files | `GET /api/files/{id}`, `/raw`, `/thumb?page=&t=`, `POST /open`, `/reveal`, `/notes` |
| Linis / Kilos | `GET /api/linis`, `POST /api/kilos/propose`, `/cleanup`, `/{id}/approve`, `/{id}/decline`, `/{id}/undo`, `GET /api/ops` |
| Status | `GET /api/status` (models, offline badge, index phase, visual/speech/Windows Search status) |

---

## 6. Measured results

**Evaluation** on the synthetic test documents, with gemma4:e4b and nothing else running (full table in `eval/results.md`):

| Test | Result |
|---|---|
| Search: top-3 hit rate, 20 queries in English, Filipino and Taglish | **Hybrid 20/20**; keyword-only 18/20 |
| Page-specific queries landing on the right page | 3/3 |
| Sagot: correct grounded answers | **6/6** |
| Sagot: correct "insufficient evidence" on unanswerable questions | **3/3** |
| Sagot: median answer time | 3.2 s (qwen3:8b was 4.5 s) |

**Checked on the developer's real files** (spot checks, not a benchmark):
- "litrato ng sirang kalsada" returned road-crack photos with no text in them.
- "screenshot ng confusion matrix", "diagram ng system" and "stuffed toy" put the right kind of image first.
- "video ng cloud security" found cloud-security course videos by their keyframes.
- "thesis seminar" found an unread PDF instantly through the Windows index.
- Sagot answered "Magkano ang org shirt sa ACSS minutes?" with ₱335 / ₱350, citing ACSS Minutes.docx.
- Visual-search cutoffs were calibrated on 354 real photos: correct top hits stood 3.3–5.2 standard deviations above the average score.

**Speed while indexing:** search takes 0.6–1.5 s and answers about 13 s, because the indexer shares the CPU and GPU. Without the indexer, searches measured 0.2–0.5 s.

---

## 7. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `MATAH_LLM` | first installed of gemma4:e4b, gemma4:e2b, qwen3:8b… | Force a chat model |
| `MATAH_EMBED` | `embeddinggemma` | Embedding model |
| `MATAH_CLIP` | `xlm-roberta-base-ViT-B-32:laion5b_s13b_b90k` | Visual model (`ViT-B-32:laion2b_s34b_b79k` is a smaller English-only option) |
| `MATAH_WHISPER` | `base` | Speech model (`small` is more accurate but ~3× slower) |
| `MATAH_CAPTION_LIMIT` | `150` | Images captioned per indexing run (0 disables) |
| `MATAH_DB` | `data/matah.db` | Index location |
| `HF_HUB_DISABLE_XET` | `1` (set in run.ps1) | Plain-HTTP model downloads (Xet stalled on this network) |

---

## 8. Run and test

```powershell
# launch (sets up on first run, builds the UI, opens the browser)
powershell -ExecutionPolicy Bypass -File .\run.ps1            # add -Rebuild after UI changes

# backend tests (path guard, verifier, Linis, Kilos NO / YES+Undo, parser)
.venv\Scripts\python -m pytest -q

# evaluation -> eval/results.md
.venv\Scripts\python -m eval.run_eval

# UI checks
npm run dev        # UI with live reload on http://localhost:5173 (backend must be running)
npm run typecheck; npm test; npm run lint
```

Current status: backend **10/10** tests pass; UI **42/42** tests pass, typecheck clean, lint has 0 errors.

---

## 9. Known limitations and next steps

- **First full read takes hours** on a large profile: hundreds of videos and thousands of dataset images. Search and answers work throughout.
- **Visual search runs on CPU.** It's the slowest search source while the indexer runs; a CUDA build of PyTorch would speed it up.
- **Whisper `base` mishears some Taglish.** `MATAH_WHISPER=small` is more accurate but slower.
- **"stuffed toy"** ranks mascot drawings above the actual plush-toy photo; CLIP is weaker on drawings vs. photos.
- **Image captions** (describing phase) run last and are not yet measured.
- **Next:** live folder watching for instant re-index, near-duplicate photo detection, an Android companion app, and packaging as a desktop app (Tauri).

---

## 10. Disclosures

- **Runs locally:** everything at runtime. **Needs internet:** only the one-time model and package downloads.
- **Cloud services at runtime:** none.
- **Test data:** synthetic documents only, marked SAMPLE; MAT-AH never indexes its own test folder.
- **AI-assisted tools:** Claude (planning) and Claude Code (implementation).
