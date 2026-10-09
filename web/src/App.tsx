import { useCallback, useEffect, useRef, useState } from 'react'
import {
  api,
  type Answer,
  type IndexProgress,
  type LinisReport,
  type Proposal,
  type Root,
  type SearchResult,
  type Status,
} from './api'
import { ConsentModal, Highlight, Rail, ResultRow, StatusStrip, Viewer, fmtBytes, kindLabel, relFolder, where, type ViewTarget } from './bits'

type Mode = 'hanap' | 'sagot' | 'linis' | 'kilos'

const MODES: { id: Mode; label: string; hint: string; placeholder: string }[] = [
  {
    id: 'hanap',
    label: 'Hanap',
    hint: 'Find a file by what was in it',
    placeholder: 'Describe the file, e.g. yung screenshot ng enrollment requirements',
  },
  {
    id: 'sagot',
    label: 'Sagot',
    hint: 'Ask a question, get an answer with its source',
    placeholder: 'Ask your files, e.g. Ano yung deadline ng enrollment?',
  },
  {
    id: 'linis',
    label: 'Linis',
    hint: 'Find duplicates, empty files and empty folders',
    placeholder: 'Folder to check (blank = all your folders), e.g. Downloads_demo',
  },
  {
    id: 'kilos',
    label: 'Kilos',
    hint: 'Organize files — nothing moves until you say yes',
    placeholder: 'What should be organized? e.g. Organize my enrollment documents',
  },
]

export default function App() {
  const [mode, setMode] = useState<Mode>('hanap')
  const [queries, setQueries] = useState<Record<Mode, string>>({ hanap: '', sagot: '', linis: '', kilos: '' })
  const q = queries[mode]
  const setQ = (v: string) => setQueries((all) => ({ ...all, [mode]: v }))
  const [roots, setRoots] = useState<Root[]>([])
  const [rootsLoaded, setRootsLoaded] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [progress, setProgress] = useState<IndexProgress | null>(null)
  const [view, setView] = useState<ViewTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState<SearchResult | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [linis, setLinis] = useState<LinisReport | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const [r, s, p] = await Promise.allSettled([api.roots(), api.status(), api.indexStatus()])
    if (r.status === 'fulfilled') {
      setRoots(r.value)
      setRootsLoaded(true)
    }
    if (s.status === 'fulfilled') setStatus(s.value)
    if (p.status === 'fulfilled') setProgress(p.value)
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, progress?.running ? 800 : 4000)
    return () => clearInterval(t)
  }, [refresh, progress?.running])

  const meta = MODES.find((m) => m.id === mode)!

  const run = async (text = q) => {
    if (mode !== 'linis' && !text.trim()) return
    setBusy(true)
    setErr(null)
    try {
      if (mode === 'hanap') setSearch(await api.search(text))
      if (mode === 'sagot') setAnswer(await api.ask(text))
      if (mode === 'linis') {
        const target = text.trim() ? resolveFolder(text.trim(), roots) : undefined
        setLinis(await api.linis(target))
      }
      if (mode === 'kilos') setProposal(await api.propose(text))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setErr(null)
    inputRef.current?.focus()
  }

  return (
    <div className={`app ${view ? 'has-viewer' : ''}`}>
      <Rail roots={roots} progress={progress} status={status} onChange={refresh} />

      <main>
        <StatusStrip s={status} />
        <nav className="modes" aria-label="What do you want to do?">
          {MODES.map((m) => (
            <button key={m.id} className={m.id === mode ? 'on' : ''} aria-pressed={m.id === mode} onClick={() => switchMode(m.id)}>
              <b>{m.label}</b>
              <span>{m.hint}</span>
            </button>
          ))}
        </nav>

        <form
          className="omnibox"
          onSubmit={(e) => {
            e.preventDefault()
            run()
          }}
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={meta.placeholder}
            aria-label={meta.hint}
            autoFocus
          />
          <button className="btn go" disabled={busy}>
            {busy ? <span className="spin" aria-label="Working" /> : mode === 'sagot' ? 'Ask' : mode === 'linis' ? 'Check' : mode === 'kilos' ? 'Propose' : 'Find'}
          </button>
        </form>
        {err && <p className="error banner">{err}</p>}

        <section className="results" aria-live="polite">
          {mode === 'hanap' && search && <HanapView res={search} roots={roots} onView={setView} />}
          {mode === 'sagot' && answer && <SagotView a={answer} roots={roots} onView={setView} />}
          {mode === 'linis' && linis && (
            <LinisView
              rep={linis}
              roots={roots}
              onPropose={async (ids, folders) => {
                try {
                  const p = await api.cleanup(ids, folders)
                  setProposal(p)
                  setMode('kilos')
                } catch (e) {
                  setErr((e as Error).message)
                }
              }}
            />
          )}
          {mode === 'kilos' && proposal && <KilosView p={proposal} roots={roots} onChange={setProposal} onDone={refresh} />}
          {mode === 'kilos' && !proposal && <KilosHistory roots={roots} onPick={setProposal} />}
        </section>
      </main>

      {view && <Viewer target={view} roots={roots} onClose={() => setView(null)} />}
      {rootsLoaded && roots.length === 0 && <ConsentModal onAllowed={refresh} />}
    </div>
  )
}

function resolveFolder(text: string, roots: Root[]) {
  if (/^[a-z]:\\/i.test(text)) return text
  // a folder name inside the first root that has it
  return roots.length ? `${roots[0].path}\\${text}` : text
}

/* ---------------- Hanap ---------------- */

function HanapView({ res, roots, onView }: { res: SearchResult; roots: Root[]; onView: (v: ViewTarget) => void }) {
  const p = res.query
  // Meaning-only hits far below the best one are kept, but folded away.
  const top = res.hits[0]?.score ?? 0
  const isWeak = (h: SearchResult['hits'][number], i: number) => i >= 3 && !h.why.includes('keyword') && h.score < top * 0.45
  const strong = res.hits.filter((h, i) => !isWeak(h, i))
  const weak = res.hits.filter((h, i) => isWeak(h, i))
  const pills: string[] = [
    ...p.kinds.map((k) => `type: ${kindLabel(k)}`),
    ...(p.date_label ? [`date: ${p.date_label}`] : []),
    ...p.amounts.map((a) => `amount: ₱${a.toLocaleString('en-PH')}`),
    ...p.phrases.map((ph) => `“${ph}”`),
  ]
  return (
    <>
      <div className="understood">
        <span>
          {res.hits.length} {res.hits.length === 1 ? 'file' : 'files'}
        </span>
        {pills.map((x) => (
          <span key={x} className="pill">
            {x}
          </span>
        ))}
        {p.terms.length > 0 && <span className="terms">words: {p.terms.join(', ')}</span>}
        <span className={`pill mode ${res.mode}`}>{res.mode === 'hybrid' ? 'keyword + meaning' : 'keyword only'}</span>
        {res.relaxed.length > 0 && <span className="relaxed">No file matched the {res.relaxed.join(' and ')} filter, so it was loosened.</span>}
      </div>
      {res.hits.length === 0 ? (
        <p className="none">No file matched. Try other words for what was in it, or check that its folder is in the list on the left.</p>
      ) : (
        <>
          <ol className="rows">
            {strong.map((h, i) => (
              <ResultRow key={h.file.id} hit={h} rank={i} roots={roots} onView={(x) => onView(x)} />
            ))}
          </ol>
          {weak.length > 0 && (
            <details className="weaker">
              <summary>
                {weak.length} weaker {weak.length === 1 ? 'match' : 'matches'}, related in meaning only
              </summary>
              <ol className="rows">
                {weak.map((h, i) => (
                  <ResultRow key={h.file.id} hit={h} rank={i} roots={roots} onView={(x) => onView(x)} />
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </>
  )
}

/* ---------------- Sagot ---------------- */

function SagotView({ a, roots, onView }: { a: Answer; roots: Root[]; onView: (v: ViewTarget) => void }) {
  const open = (n: number) => {
    const s = a.sources.find((x) => x.n === n)
    if (s) onView(s)
  }
  return (
    <div className="sagot">
      {a.status === 'grounded' && a.answer ? (
        <blockquote className="answer">
          {a.answer.split(/(\[\d+\])/).map((part, i) => {
            const m = part.match(/^\[(\d+)\]$/)
            if (!m) return <span key={i}>{part}</span>
            const s = a.sources.find((x) => x.n === Number(m[1]))
            return (
              <button key={i} className="cite" onClick={() => open(Number(m[1]))} title={s ? `${s.file.name}${where(s.locator) ? `, ${where(s.locator)}` : ''}` : ''}>
                {m[1]}
                {s && where(s.locator) && <small>{where(s.locator)}</small>}
              </button>
            )
          })}
          <footer>Checked: every number and date above appears in the cited file.</footer>
        </blockquote>
      ) : (
        <div className={`answer insufficient ${a.status}`}>
          <h3>{a.status === 'offline' ? 'Local AI is off' : 'Kulang ang ebidensya — insufficient evidence'}</h3>
          <p>
            {a.status === 'offline'
              ? 'Start Ollama to get answers. These are the files that best match your question.'
              : 'Your files don’t clearly say this, so MAT-AH won’t guess. These are the closest files.'}
          </p>
          {a.rejected && (
            <details>
              <summary>Why the draft answer was rejected</summary>
              <p className="rejected">{a.rejected}</p>
              <ul>
                {a.problems?.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <h4 className="srchead">Sources</h4>
      <ol className="sources">
        {a.sources.map((s) => (
          <li key={s.n} className={a.cited?.includes(s.n) ? 'cited' : ''}>
            <button onClick={() => onView(s)}>
              <span className="n">{s.n}</span>
              <span className="sname">
                {s.file.name}
                {where(s.locator) && <em>{where(s.locator)}</em>}
              </span>
              <span className="crumbs">
                {relFolder(s.file.path, roots).map((c, i) => (
                  <span key={i}>{c}</span>
                ))}
              </span>
              <span className="snippet">
                <Highlight text={s.snippet} needles={s.highlight} />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ---------------- Linis ---------------- */

function LinisView({ rep, roots, onPropose }: { rep: LinisReport; roots: Root[]; onPropose: (ids: number[], folders: string[]) => void }) {
  const initial = new Set<string>([
    ...rep.duplicates.flatMap((g) => g.extra.map((e) => e.path)),
    ...rep.zero_byte.map((z) => z.path),
    ...rep.empty_folders.map((f) => f.path),
  ])
  const [sel, setSel] = useState(initial)
  const toggle = (p: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(p)) n.delete(p)
      else n.add(p)
      return n
    })
  const allFiles = [...rep.duplicates.flatMap((g) => g.extra), ...rep.zero_byte]
  const ids = allFiles.filter((f) => sel.has(f.path) && f.id).map((f) => f.id!)
  const folders = rep.empty_folders.filter((f) => sel.has(f.path)).map((f) => f.path)
  const total = rep.duplicates.length + rep.zero_byte.length + rep.empty_folders.length
  if (total === 0) return <p className="none">Clean. No duplicates, empty files or empty folders here.</p>
  const Box = ({ path }: { path: string }) => <input type="checkbox" checked={sel.has(path)} onChange={() => toggle(path)} aria-label={`Select ${path}`} />
  return (
    <div className="linis">
      <p className="lede">
        Found {rep.duplicates.length} sets of exact duplicates ({fmtBytes(rep.reclaimable_bytes)} to free), {rep.zero_byte.length} empty files and{' '}
        {rep.empty_folders.length} empty folders. This is only a report — nothing changes until you approve it in Kilos.
      </p>
      {rep.duplicates.length > 0 && (
        <section>
          <h3>Exact duplicates</h3>
          {rep.duplicates.map((g) => (
            <div className="dup" key={g.sha256}>
              <div className="keep">
                <span className="tag keep">keep</span> {g.keep.name} <small>{relFolder(g.keep.path, roots).join(' › ')}</small>
              </div>
              {g.extra.map((e) => (
                <label key={e.path}>
                  <Box path={e.path} /> {e.name} <small>{fmtBytes(g.size)}, same content</small>
                </label>
              ))}
            </div>
          ))}
        </section>
      )}
      {rep.zero_byte.length > 0 && (
        <section>
          <h3>Empty files (0 bytes)</h3>
          {rep.zero_byte.map((z) => (
            <label key={z.path}>
              <Box path={z.path} /> {z.name} <small>{relFolder(z.path, roots).join(' › ')}</small>
            </label>
          ))}
        </section>
      )}
      {rep.empty_folders.length > 0 && (
        <section>
          <h3>Empty folders</h3>
          {rep.empty_folders.map((f) => (
            <label key={f.path}>
              <Box path={f.path} /> {f.name} <small>{relFolder(f.path + '\\x', roots).join(' › ')}</small>
            </label>
          ))}
        </section>
      )}
      <button className="btn" disabled={!ids.length && !folders.length} onClick={() => onPropose(ids, folders)}>
        Send {ids.length + folders.length} to Kilos for approval
      </button>
    </div>
  )
}

/* ---------------- Kilos ---------------- */

function KilosView({ p, roots, onChange, onDone }: { p: Proposal; roots: Root[]; onChange: (p: Proposal | null) => void; onDone: () => void }) {
  const actionable = p.plan.ops.filter((o) => o.op !== 'mkdir')
  const [sel, setSel] = useState<Set<number>>(new Set(actionable.map((o) => o.i)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => setSel(new Set(p.plan.ops.filter((o) => o.op !== 'mkdir').map((o) => o.i))), [p.id])
  const doit = async (fn: () => Promise<Proposal>) => {
    setBusy(true)
    setErr(null)
    try {
      onChange(await fn())
      onDone()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const short = (path?: string) => (path ? relFolder(path + '\\x', roots).join(' › ') : '')
  const base = (path?: string) => (path ? path.split('\\').pop() : '')
  const verb = { move: 'Move', trash: 'Recycle Bin', rmdir: 'Remove empty folder', mkdir: 'New folder' }
  const failed = p.log.filter((l) => l.status === 'failed' || l.error)
  return (
    <div className="kilos">
      <header className={`kstate ${p.status}`}>
        <div>
          <h3>{p.request}</h3>
          <p>
            {p.plan.reason}
            {p.plan.folder && (
              <>
                {' '}
                New folder: <b>{short(p.plan.folder)}</b>
              </>
            )}
          </p>
          <small>
            Planned by {p.plan.planner === 'rules' ? 'search rules' : p.plan.planner === 'linis' ? 'Linis' : p.plan.planner}
            {p.plan.rejected_ids?.length ? `; ${p.plan.rejected_ids.length} unknown file ids were rejected by the validator` : ''}
          </small>
        </div>
        <span className="stamp">{{ pending: 'Waiting for you', approved: 'Done', declined: 'Declined — nothing changed', undone: 'Undone' }[p.status]}</span>
      </header>

      <table className="plan">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr">Include</span>
            </th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
          </tr>
        </thead>
        <tbody>
          {actionable.map((o) => (
            <tr key={o.i} className={sel.has(o.i) ? '' : 'skip'}>
              <td>
                <input
                  type="checkbox"
                  disabled={p.status !== 'pending'}
                  checked={sel.has(o.i)}
                  aria-label={`Include ${base(o.src)}`}
                  onChange={() =>
                    setSel((s) => {
                      const n = new Set(s)
                      if (n.has(o.i)) n.delete(o.i)
                      else n.add(o.i)
                      return n
                    })
                  }
                />
              </td>
              <td>
                <b>{base(o.src)}</b>
                <small>{short(o.src?.slice(0, o.src.lastIndexOf('\\')))}</small>
              </td>
              <td>
                {o.op === 'move' ? (
                  <>
                    <b>{base(o.dst)}</b>
                    {o.renamed && <span className="tag">renamed, name was taken</span>}
                    <small>{short(o.dst?.slice(0, o.dst.lastIndexOf('\\')))}</small>
                  </>
                ) : (
                  <span className="tag danger">{verb[o.op]}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {p.status === 'pending' && (
        <div className="yesno">
          <p>Do you approve these {sel.size} changes?</p>
          <button className="btn no" disabled={busy} onClick={() => doit(() => api.decline(p.id))}>
            No, leave my files
          </button>
          <button className="btn yes" disabled={busy || sel.size === 0} onClick={() => doit(() => api.approve(p.id, [...sel]))}>
            Yes, do it
          </button>
          {p.plan.ops.some((o) => o.op === 'trash') && <small>Deleted files go to the Recycle Bin; restore them from there.</small>}
        </div>
      )}
      {p.status === 'approved' && (
        <div className="yesno">
          <p>Done. Every step is logged below.</p>
          <button className="btn ghost" disabled={busy} onClick={() => doit(() => api.undo(p.id))}>
            Undo all
          </button>
          <button className="btn ghost" onClick={() => onChange(null)}>
            New request
          </button>
        </div>
      )}
      {(p.status === 'declined' || p.status === 'undone') && (
        <div className="yesno">
          <p>{p.status === 'declined' ? 'Nothing was moved.' : 'Every file is back where it was.'}</p>
          <button className="btn ghost" onClick={() => onChange(null)}>
            New request
          </button>
        </div>
      )}
      {err && <p className="error">{err}</p>}
      {failed.length > 0 && (
        <ul className="errors">
          {failed.map((l) => (
            <li key={l.id}>
              {l.op} {base(l.src ?? l.dst ?? '')}: {l.error}
            </li>
          ))}
        </ul>
      )}
      {p.log.length > 0 && (
        <details className="oplog" open>
          <summary>Operation log</summary>
          <ol>
            {p.log.map((l) => (
              <li key={l.id} className={l.status}>
                <time>{l.done_at.slice(11)}</time> {l.op} <b>{base(l.src ?? '') || base(l.dst ?? '')}</b>
                {l.dst && l.op === 'move' && <> to {short(l.dst.slice(0, l.dst.lastIndexOf('\\')))}</>} <em>{l.status}</em>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

function KilosHistory({ roots, onPick }: { roots: Root[]; onPick: (p: Proposal) => void }) {
  const [h, setH] = useState<Proposal[]>([])
  useEffect(() => {
    api.history().then(setH, () => setH([]))
  }, [])
  if (!roots.length) return null
  if (!h.length)
    return <p className="none">Tell Kilos what to organize. It shows you a before-and-after plan first; nothing moves until you press Yes.</p>
  return (
    <div className="history">
      <h4 className="srchead">Earlier requests</h4>
      <ul>
        {h.map((p) => (
          <li key={p.id}>
            <button onClick={() => onPick(p)}>
              <span>{p.request}</span>
              <small>
                {p.status}, {p.plan.ops.filter((o) => o.op !== 'mkdir').length} items
              </small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
