# MAT-AH UI (desktop frontend)

React 19 + Vite 6 + TypeScript. Plain CSS with design tokens, no UI or animation library.
The UI lives at the repo root (`src/`, `public/`, `index.html`, `package.json`, `vite.config.ts`) next to the
Python backend. The FastAPI backend serves the built app from `dist/` at `/` and the API under `/api`
(see `backend/app.py`). Vite, ESLint and Vitest ignore the Python folders (`.venv`, `backend`, `data`…).

## Run it

Requires Node.js 20 or newer. From the repository root (`MAT-AH/`), in PowerShell:

```powershell
npm install
```

**Everything at once (the team's launcher):** from the repo root,
`powershell -ExecutionPolicy Bypass -File .\run.ps1 -Rebuild` builds this UI and serves it with the
backend on <http://127.0.0.1:8765>.

**With the real backend while developing the UI** (backend running via `run.ps1`, port 8765):

```powershell
npm run dev          # http://localhost:5173, proxies /api to 127.0.0.1:8765
```

Different port? `$env:VITE_API_TARGET="http://127.0.0.1:8123"; npm run dev`

**Without the backend** (isolated demonstration data, development only):

```powershell
npm run dev:demo     # or open http://localhost:5173/?demo=1 during `npm run dev`
```

Demo mode shows a DEMO DATA badge everywhere and never touches the filesystem.
Production builds strip the demo layer entirely.

**Build for the backend to serve:**

```powershell
npm run build        # writes dist/, which backend/app.py mounts at /
```

**Checks:** `npm run typecheck` · `npm test` · `npm run lint`

Demo queries to try: `GCash receipt na ₱1,500` (results and celebration), `₱15,000`
(no results), `demo error` (error state). Sagot: ask about the enrollment deadline or tuition.

## Structure

```
src/
  App.tsx, main.tsx            providers, hash routing, demo/real backend selection
  services/                    backend contract (types.ts), apiClient.ts, backend.ts, normalize.ts
  mocks/demoBackend.ts         DEMONSTRATION DATA ONLY, dev mode
  mascot/                      Iris.tsx (SVG), irisMachine.ts (pure state machine),
                               IrisContext.tsx (lifecycle + idle scheduler), IrisCompanion.tsx,
                               IrisCustomization.tsx (lazy), irisPresets.ts, iris.types.ts
  branding/MatahLogo.tsx       wordmark (real glyph outlines), symbol, app icon, lockup
  prefs/                       versioned localStorage prefs (matah.prefs.v1), theme + motion
  hooks/                       useTrackedRequest (abort + stale protection), StatusContext, useRoute
  components/                  layout shell, feedback states, dialogs, file cards, preview drawer
  features/                    home, hanap, sagot, kilos, linis, settings, startup
  styles/                      tokens.css (light + dark), base.css, components.css, animations.css
public/branding, public/mascot SVG/PNG/ICO assets
```

## Backend contract used (verified against backend/*.py, read-only)

| UI | Route | Notes |
|---|---|---|
| Hanap | `GET /api/search?q=&mode=hybrid&limit=20` | GET, not POST. Uses `hits`, `query`, `relaxed`, `mode`. |
| Sagot | `POST /api/ask {q}` | `status`: `grounded`, `insufficient`, `offline`. No streaming, so the UI shows a neutral "Preparing your answer…" and elapsed time, never invented stages. |
| Preview | `GET /api/files/{id}?chunk=`, `/thumb?page=&w=&t=`, `/raw` | PDFs open at the cited page, video and audio start at the matched second, images highlight matching OCR word boxes. Thumbnails exist for PDF, image and video. |
| Open / Reveal | `POST /api/files/{id}/open`, `/reveal` | Windows only (backend uses `os.startfile`, `explorer`). |
| Tala | `POST /api/files/{id}/notes {text}` | In the preview drawer. |
| Folders | `GET/POST/DELETE /api/roots`, `POST /api/roots/computer` | There is no `/api/roots/pick`: `POST /api/roots` with `path: null` opens the native picker. Adding a folder starts indexing. |
| Index | `POST /api/index`, `POST /api/index/stop`, `GET /api/index/status` | Shows the backend's phase (listing, reading, seeing, embedding, describing). Determinate only when `total > 0`. |
| Linis | `GET /api/linis`, then `POST /api/kilos/cleanup {file_ids, folders}` | Exact (SHA-256) duplicates, zero-byte files, empty folders. |
| Kilos | `POST /api/kilos/propose`, `/{id}/approve {selected}`, `/decline`, `/undo`, `GET /api/ops` | `selected` = op indices `i`. |
| Status | `GET /api/status` | Polled every 15 s, 1.5 s while indexing, paused when hidden. |

### Notes for the backend developer (nothing was changed)

- **Visual (look-alike) duplicates** are not in `linis.py`. The UI says so instead of faking it.
- **Sagot progress stages** would need streaming or a status endpoint; until then the UI stays neutral.
- **Cleanup items not in the index** (`id: null` in `/api/linis`) cannot be sent to `/api/kilos/cleanup`
  because it accepts file ids only; the UI marks them "not indexed, skip".
- **Link (phone pairing)** has no backend yet; it is not in this frontend.
- `matah-app.ico` in `public/branding` is ready for Windows packaging if/when the team adds it.

## Integration with the team's first UI

This app replaced the original single-file UI (`App.tsx`, `bits.tsx`, `api.ts`, `index.css`) and
carries over its behaviour: port 8765 proxy, "Search my whole computer", pause indexing, indexing
phase text, auto re-index after adding a folder, video/audio/sheet support, PDF iframe at page,
OCR word-box highlights, folded weaker meaning-only matches, rejected-draft details in Sagot,
Linis folder targeting, last-request timings, and the ESLint setup. Its Atkinson Hyperlegible font
was replaced by the Iris Bloom type system (Space Grotesk, Geist, Geist Mono).

## Iris

States (presentation only): `idle, curious, searching, thinking, found, celebrating, no-results,
planning, waiting-for-approval, success, error, unavailable, resting`.

Every request gets a token from `IrisContext.begin()`. Only the newest token can move Iris, so a
cancelled or stale response can never trigger a celebration. "Ah, kita ko na!" plays only when a
search completes with at least one real hit. Results render immediately; Iris accompanies them.
Errors and pending approvals outrank decorative idle actions. Iris's bubble is `aria-hidden`; every
status is also stated in page text and an `aria-live` region.

Customization (Settings › Customize Iris): 7 colour presets, 6 accessories, 4 idle expressions,
motion level, show/hide. Saved locally under `matah.prefs.v1` together with theme. Nothing personal
is stored there.

## Motion spec

| Animation | Trigger | Duration · easing | Reduced-motion fallback |
|---|---|---|---|
| Logo reveal | Startup, About | 1000 ms · aperture `cubic-bezier(.2,.8,.2,1)` | Static logo |
| Startup | First load per session | 1.2 s, skippable (click, key) | Not shown |
| Iris breathing | Idle | 3.2 s loop, 2% scale · ease-in-out | Static |
| Iris blink | Idle | once per 5.6 s | Static |
| Iris boil | Idle, full motion | 600 ms stepped (3 frames) | Off in subtle/none |
| Iris tilt / wiggle | Idle scheduler, every 14 to 26 s, never while typing | 1.4 s / 0.7 s | Off |
| Iris resting | 90 s without input | slow breathing | Static closed eyes |
| Iris searching | Search or scan in flight | 700 ms squish + eye scan | Static squint |
| Found → celebrating | Search with hits (newest request only) | 160 ms beat + 2 × 520 ms hop, ring, doc mark, bubble | Found face 1.2 s, no hop |
| Thinking / planning | Sagot / Kilos in flight | dots 1.1 s, gathering shapes 600 ms | Static |
| No results / error / success | Request outcome | settle after 2.6 s / 6 s / 1.6 s | Static face |
| Search field focus | Focus | seam 180 ms · aperture | Instant |
| Search busy | Request in flight | seam scan 1.1 s loop | Static seam |
| Result reveal | New results | 280 ms clip from centre line, 40 ms stagger, max 6 | Instant |
| Recognition brackets | Best match | 320 ms · settle, 200 ms delay | Static brackets |
| Citation spotlight | Select citation | 220 ms border, 240 ms connector draw | Instant |
| Kilos gather preview | Proposal shown | 360 ms ghost slide-in | Instant |
| Approval dialog | Review and approve | 280 ms seam open | Instant |
| Drawer | Preview | 280 ms slide · settle | Instant |
| Theme change | Theme toggle | 220 ms colour transition | Instant |
| Customization preview | Preview buttons | as Iris states; local only, no backend calls | Static |

Only transform, opacity and clip-path are animated. Animations pause while the window is hidden.
`data-motion` on `<html>` is `full`, `subtle` or `none`; with "Follow system reduced-motion" on,
Windows' animation setting turns decorative motion off.

## Brand assets (`public/branding`, `public/mascot`)

`wordmark-light.svg`, `wordmark-dark.svg`, `wordmark-mono-ink.svg`, `wordmark-mono-white.svg`,
`symbol-ink.svg`, `symbol-light.svg`, `app-icon.svg`, `app-icon-small.svg` (24 px drawing),
`favicon.svg` (16 px drawing), `favicon.ico`, `app-icon-180/192/512.png`, `matah-app.ico`
(16 to 256 px), `iris-classic.svg`, `iris-classic-dark.svg`.

The wordmark letters are outlines of Space Grotesk Bold (SIL Open Font License). Fonts are
self-hosted through `@fontsource` (Space Grotesk, Geist, Geist Mono, all OFL), so the app works offline.
