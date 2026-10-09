import { useEffect, useRef, useState } from 'react'
import { api, rawUrl, thumbUrl, type FileRef, type Hit, type IndexProgress, type Locator, type Root, type Status } from './api'

/* ---------- small helpers ---------- */

const KIND_LABEL: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  pptx: 'Slides',
  text: 'Text',
  image: 'Image',
  other: 'File',
}
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k

export function fmtDate(f: FileRef) {
  const d = f.taken_at ? new Date(f.taken_at) : new Date(f.mtime * 1000)
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}

export function relFolder(path: string, roots: Root[]) {
  const norm = path.replace(/\//g, '\\')
  const root = roots.find((r) => norm.toLowerCase().startsWith(r.path.toLowerCase()))
  const dir = norm.slice(0, norm.lastIndexOf('\\'))
  if (!root) return dir.split('\\')
  const rest = dir.slice(root.path.length).split('\\').filter(Boolean)
  return [root.name, ...rest]
}

export function where(loc: Locator) {
  if (loc.page) return `page ${loc.page}`
  if (loc.slide) return `slide ${loc.slide}`
  return null
}

/** Lowercase and strip accents one character at a time so indexes still line up with the original text. */
const fold = (s: string) => Array.from(s, (c) => (c.normalize('NFD')[0] ?? c).toLowerCase()).join('')

/** Wrap matched words in <mark> — the highlighter is the app's signature. */
export function Highlight({ text, needles }: { text: string; needles: string[] }) {
  const words = needles.filter((n) => n.length >= 2).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!words.length) return <>{text}</>
  const re = new RegExp(`(${words.join('|')})`, 'gi')
  const folded = fold(text)
  if (folded.length !== text.length) return <>{text}</>
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of folded.matchAll(re)) {
    const i = m.index ?? 0
    out.push(text.slice(last, i), <mark key={i}>{text.slice(i, i + m[0].length)}</mark>)
    last = i + m[0].length
  }
  out.push(text.slice(last))
  return <>{out}</>
}

/* ---------- status strip: the visible proof that everything is local ---------- */

export function StatusStrip({ s }: { s: Status | null }) {
  if (!s) return <div className="status" />
  const t = s.last
  const steps = ['parse', 'retrieve', 'generate', 'verify'].filter((k) => typeof t[k] === 'number')
  return (
    <div className="status" role="status">
      <span className={`net ${s.online ? 'on' : 'off'}`}>
        <i aria-hidden /> {s.online ? 'Online — not used' : 'Offline'}
      </span>
      <span className={s.ollama ? 'ok' : 'warn'}>
        {s.ollama ? (
          <>
            Local AI: <b>{s.chat_model ?? 'no chat model'}</b>
            {s.embed_model && <> + <b>{s.embed_model}</b></>}
          </>
        ) : (
          'Local AI off — keyword mode'
        )}
      </span>
      {steps.length > 0 && (
        <span className="timings" title="Last request, measured on this laptop">
          {steps.map((k) => (
            <span key={k}>
              {k} <b>{fmtMs(t[k] as number)}</b>
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`)

/* ---------- left rail: what MAT-AH may read ---------- */

export function Rail({
  roots,
  progress,
  status,
  onChange,
}: {
  roots: Root[]
  progress: IndexProgress | null
  status: Status | null
  onChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const add = async () => {
    setBusy(true)
    setErr(null)
    try {
      const r = await api.addRoot()
      if (!('cancelled' in r)) await api.reindex()
      onChange()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const running = progress?.running
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const counts = status?.files ?? {}
  return (
    <aside className="rail">
      <div className="brand">
        <span className="logo" aria-hidden>
          <span />
        </span>
        <div>
          <h1>MAT-AH</h1>
          <p>Remember what it was, not where you saved it.</p>
        </div>
      </div>

      <section>
        <h2>Folders MAT-AH can read</h2>
        {roots.length === 0 && <p className="hint">Nothing yet. Add a folder to start; MAT-AH reads only what you pick.</p>}
        <ul className="roots">
          {roots.map((r) => (
            <li key={r.id} title={r.path}>
              <span className="tab" aria-hidden />
              <span className="rname">{r.name}</span>
              <span className="count">{r.files}</span>
              <button
                className="x"
                aria-label={`Stop indexing ${r.name}`}
                onClick={async () => {
                  await api.removeRoot(r.id)
                  onChange()
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="rail-actions">
          <button className="btn" onClick={add} disabled={busy}>
            {busy ? 'Choose in the dialog…' : 'Add folder'}
          </button>
          <button
            className="btn ghost"
            disabled={running || roots.length === 0}
            onClick={async () => {
              await api.reindex()
              onChange()
            }}
          >
            Re-index
          </button>
        </div>
        {err && <p className="error">{err}</p>}
        {running && (
          <div className="progress" aria-label="Indexing progress">
            <div style={{ transform: `scaleX(${pct / 100})` }} />
            <small>
              Reading {progress!.current || '…'} ({progress!.done}/{progress!.total})
            </small>
          </div>
        )}
        {!running && progress?.embed_skipped && progress.finished > 0 && (
          <p className="hint">Indexed for keywords only — start Ollama and re-index to add meaning search.</p>
        )}
      </section>

      {Object.keys(counts).length > 0 && (
        <section>
          <h2>In the index</h2>
          <ul className="counts">
            {Object.entries(counts).map(([k, n]) => (
              <li key={k}>
                <span>{kindLabel(k)}</span>
                <b>{n}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="privacy">Everything stays on this laptop. The server listens on 127.0.0.1 only.</p>
    </aside>
  )
}

/* ---------- result row ---------- */

export function FileActions({ file, loc, onView }: { file: FileRef; loc: Locator; onView: () => void }) {
  const [msg, setMsg] = useState<string | null>(null)
  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn()
      setMsg(done)
    } catch (e) {
      setMsg((e as Error).message)
    }
    setTimeout(() => setMsg(null), 2200)
  }
  const pageLabel = where(loc)
  return (
    <div className="actions">
      <button className="btn small" onClick={onView}>
        {pageLabel ? `View ${pageLabel}` : 'View'}
      </button>
      <button className="btn small ghost" onClick={() => act(() => api.open(file.id), 'Opened')}>
        Open
      </button>
      <button className="btn small ghost" onClick={() => act(() => api.reveal(file.id), 'Shown in File Explorer')}>
        Show in folder
      </button>
      {msg && <span className="toast">{msg}</span>}
    </div>
  )
}

export function ResultRow({ hit, roots, onView, rank }: { hit: Hit; roots: Root[]; onView: (h: Hit) => void; rank: number }) {
  const f = hit.file
  const crumbs = relFolder(f.path, roots)
  const page = hit.locator.page ?? 1
  const hasThumb = f.kind === 'image' || f.kind === 'pdf'
  return (
    <li className="row" style={{ animationDelay: `${Math.min(rank, 8) * 25}ms` }}>
      <button className="thumb" onClick={() => onView(hit)} aria-label={`View ${f.name}`}>
        {hasThumb ? <img src={thumbUrl(f.id, page)} alt="" loading="lazy" /> : <span className={`ext k-${f.kind}`}>{f.ext.replace('.', '')}</span>}
      </button>
      <div className="body">
        <div className="title">
          <h3>{f.name}</h3>
          {where(hit.locator) && <span className="loc">{where(hit.locator)}</span>}
        </div>
        <p className="crumbs" title={f.path}>
          {crumbs.map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </p>
        {hit.snippet && (
          <p className="snippet">
            <Highlight text={hit.snippet} needles={hit.highlight} />
          </p>
        )}
        <div className="meta">
          <span>{kindLabel(f.kind)}</span>
          <span>{fmtDate(f)}</span>
          <span>{fmtBytes(f.size)}</span>
          <span className="why">matched by {hit.why.join(' + ')}</span>
        </div>
        <FileActions file={f} loc={hit.locator} onView={() => onView(hit)} />
      </div>
    </li>
  )
}

/* ---------- viewer drawer: lands on the exact page or the highlighted words ---------- */

export interface ViewTarget {
  file: FileRef
  locator: Locator
  chunk_id: number | null
  highlight: string[]
}

export function Viewer({ target, roots, onClose }: { target: ViewTarget; roots: Root[]; onClose: () => void }) {
  const f = target.file
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof api.file>> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    setMeta(null)
    setErr(null)
    api.file(f.id, target.chunk_id).then(setMeta, (e) => setErr(e.message))
    closeRef.current?.focus()
  }, [f.id, target.chunk_id])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const page = target.locator.page
  return (
    <aside className="viewer" aria-label={`Viewing ${f.name}`}>
      <header>
        <div>
          <h2>{f.name}</h2>
          <p className="crumbs">
            {relFolder(f.path, roots).map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </p>
        </div>
        <button ref={closeRef} className="x big" onClick={onClose} aria-label="Close viewer">
          ×
        </button>
      </header>
      <FileActions file={f} loc={target.locator} onView={() => api.open(f.id)} />
      {meta && <Notes fileId={f.id} notes={meta.notes} onSaved={setMeta} />}
      <div className="stage">
        {err && <p className="error">{err}</p>}
        {f.kind === 'pdf' && <iframe key={`${f.id}-${page}`} title={f.name} src={`${rawUrl(f.id)}#page=${page ?? 1}&view=FitH&navpanes=0`} />}
        {f.kind === 'image' && meta && <OcrImage id={f.id} loc={meta.locator} needles={target.highlight} />}
        {f.kind !== 'pdf' && f.kind !== 'image' && meta && (
          <pre className="textview">
            {where(target.locator) && <span className="loc">{where(target.locator)}</span>}
            <Highlight text={meta.text} needles={target.highlight} />
          </pre>
        )}
      </div>
    </aside>
  )
}

/** Tala: a note's words make this file findable. */
function Notes({
  fileId,
  notes,
  onSaved,
}: {
  fileId: number
  notes: { id: number; text: string }[]
  onSaved: (m: Awaited<ReturnType<typeof api.file>>) => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="notes"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!text.trim()) return
        setBusy(true)
        try {
          onSaved((await api.addNote(fileId, text)) as Awaited<ReturnType<typeof api.file>>)
          setText('')
        } finally {
          setBusy(false)
        }
      }}
    >
      {notes.length > 0 && (
        <ul>
          {notes.map((n) => (
            <li key={n.id}>{n.text}</li>
          ))}
        </ul>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note so you can find this later, e.g. pinasa ko kay Ma'am Reyes"
        aria-label="Add a note to this file"
      />
      <button className="btn small ghost" disabled={busy || !text.trim()}>
        Save note
      </button>
    </form>
  )
}

function OcrImage({ id, loc, needles }: { id: number; loc: Locator; needles: string[] }) {
  const [w, h] = loc.size ?? [0, 0]
  const hits = (loc.boxes ?? []).filter((b) => needles.some((n) => n.length >= 2 && fold(b.text).includes(n)))
  return (
    <div>
      <div className="ocr">
      <img src={rawUrl(id)} alt="" />
      {w > 0 && (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
          {hits.map((b, i) => (
            <rect key={i} x={b.box[0] - 6} y={b.box[1] - 4} width={b.box[2] - b.box[0] + 12} height={b.box[3] - b.box[1] + 8} rx="6" />
          ))}
        </svg>
      )}
      </div>
      {hits.length > 0 && <p className="ocr-note">Highlighted: words MAT-AH read in this image that match your search.</p>}
    </div>
  )
}
