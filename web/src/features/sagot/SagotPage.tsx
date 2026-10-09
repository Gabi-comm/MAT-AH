import { useEffect, useRef, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyState, ErrorState, InlineIris, Notice, Skeleton } from "../../components/feedback/Feedback";
import { Icon } from "../../components/Icon";
import { Highlighted } from "../../components/files/ResultCard";
import { PreviewDrawer, type PreviewTarget } from "../../components/files/PreviewDrawer";
import { useTrackedRequest } from "../../hooks/useTrackedRequest";
import { type Page } from "../../hooks/useRoute";
import { useBackend } from "../../services/BackendContext";
import { answerParts, locatorLong, pathCrumbs } from "../../services/normalize";
import type { AskResponse, AskSource } from "../../services/types";

/** Emphasise amounts and dates that are already in the verified answer text. */
const EMPH = /(₱\s?[\d,]+(?:\.\d+)?|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b)/g;

function Emphasised({ text }: { text: string }) {
  const parts = text.split(EMPH);
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))}</>;
}

function useElapsed(active: boolean): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!active) return;
    setS(0);
    const t0 = Date.now();
    const id = window.setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return s;
}

export function SagotPage({ q, navigate }: { q: string; navigate: (p: Page, params?: Record<string, string>) => void }) {
  const backend = useBackend();
  const [draft, setDraft] = useState(q);
  const [spot, setSpot] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ask = useTrackedRequest<AskResponse, [string]>(
    "ask",
    (signal, question) => backend.ask(question, signal),
    (r) => (r.status === "grounded" ? "grounded" : r.status === "offline" ? "unavailable" : "insufficient"),
  );
  const { run, reset } = ask;
  const loading = ask.status === "loading";
  const elapsed = useElapsed(loading);

  useEffect(() => {
    setDraft(q);
    setSpot(null);
    if (q.trim()) run(q.trim());
    else reset();
  }, [q, run, reset]);

  useEffect(() => {
    const d = ask.data;
    if (d?.status === "grounded") setSpot(d.cited?.[0] ?? d.sources[0]?.n ?? null);
  }, [ask.data]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    if (t === q) run(t);
    else navigate("sagot", { q: t });
  }

  const d = ask.data;
  const sources = d?.sources ?? [];
  const citedSet = new Set(d?.cited ?? []);
  const shown = d?.status === "grounded" ? sources.filter((s) => citedSet.size === 0 || citedSet.has(s.n)) : sources;

  const openSource = (s: AskSource) =>
    setPreview({ fileId: s.file.id, name: s.file.name, chunkId: s.chunk_id, locator: s.locator, highlight: s.highlight, excerpt: s.snippet });

  return (
    <AppShell page="sagot" title="Sagot" eyebrow="Answers from your files, with sources">
      <div className="split">
        <section className="primary stack gap-5" aria-label="Question and answer">
          <form className={`seam-field${loading ? " is-busy" : ""}`} onSubmit={submit} aria-busy={loading}>
            <Icon name="ask" size={20} />
            <label htmlFor="sagot-q" className="sr-only">
              Ask a question about your files
            </label>
            <input id="sagot-q" ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Magtanong tungkol sa files mo…" autoComplete="off" />
            <button className="btn btn-primary" type="submit" aria-label="Ask">
              <Icon name="send" />
            </button>
            <span className="seam-line" aria-hidden="true" />
          </form>

          {!q && ask.status === "idle" && (
            <EmptyState iris="idle" title="Itanong mo, sasagutin ko mula sa files mo." body="Every answer links to the exact page it came from. If your files don't say, I'll tell you." />
          )}

          {q && (
            <div className="stack gap-2">
              <span className="eyebrow">Tanong mo</span>
              <h1 style={{ fontSize: "clamp(24px, 2.4vw, 34px)" }}>{q}</h1>
            </div>
          )}

          <div aria-live="polite" className="stack gap-4">
            {loading && (
              <div className="card row gap-4" role="status">
                <InlineIris state="thinking" size={52} />
                <div className="stack gap-1">
                  <strong>Preparing your answer…</strong>
                  <span className="subtle" style={{ fontSize: 14 }}>
                    Running on this computer{elapsed >= 2 ? ` · ${elapsed}s` : ""}. Local models can take a moment.
                  </span>
                </div>
              </div>
            )}

            {ask.status === "error" && <ErrorState error={ask.error} onRetry={() => run(q)} />}

            {d && !loading && d.status === "grounded" && d.answer && (
              <article className="card pad-lg answer reveal" aria-label="Answer">
                <div className="row wrap gap-3">
                  <span className="eyebrow">Sagot · generated from your files</span>
                  <span className="tag tag-ok" style={{ marginLeft: "auto" }}>
                    <Icon name="check" size={14} /> Grounded · {d.cited?.length ?? 0} {d.cited?.length === 1 ? "source" : "sources"}
                  </span>
                </div>
                <p className="answer-text">
                  {answerParts(d.answer).map((p, i) =>
                    p.cite !== undefined ? (
                      <button
                        key={i}
                        className="cite"
                        aria-pressed={spot === p.cite}
                        aria-label={`Show source ${p.cite}`}
                        title={(() => {
                          const src = d.sources.find((x) => x.n === p.cite);
                          return src ? `${src.file.name}, ${locatorLong(src.locator)}` : undefined;
                        })()}
                        onClick={() => setSpot(p.cite!)}
                      >
                        [{p.cite}]
                      </button>
                    ) : (
                      <Emphasised key={i} text={p.text!} />
                    ),
                  )}
                </p>
                <span className="mono subtle" style={{ fontSize: 12 }}>
                  {d.model ?? "local model"} · {d.search_mode} retrieval
                  {typeof d.timings.generate === "number" ? ` · ${(d.timings.generate / 1000).toFixed(1)}s` : ""}
                </span>
              </article>
            )}

            {d && !loading && d.status !== "grounded" && (
              <div className="card stack gap-3 reveal">
                <div className="row gap-4">
                  <InlineIris state={d.status === "offline" ? "unavailable" : "no-results"} size={56} />
                  <div className="stack gap-1">
                    <strong>{d.status === "offline" ? "Offline ang local AI." : "Kulang ang ebidensya."}</strong>
                    <span className="muted" style={{ fontSize: 15 }}>{d.message}</span>
                  </div>
                </div>
                {d.status === "offline" && (
                  <Notice tone="warn">No answer was generated. Start the local model (Ollama) to use Sagot. The closest sources are still listed.</Notice>
                )}
                {d.status === "insufficient" && (
                  <Notice tone="info">MAT-AH will not guess. Check the closest sources, or add the folder where the right file might be.</Notice>
                )}
                {d.rejected && (
                  <details className="tech">
                    <summary>Why the draft answer was rejected</summary>
                    <pre>{d.rejected}</pre>
                    {d.problems && d.problems.length > 0 && (
                      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                        {d.problems.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    )}
                  </details>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="aside stack gap-3" aria-label="Evidence">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="eyebrow">{d?.status === "grounded" ? "Evidence" : "Closest sources"} {shown.length ? `· ${shown.length}` : ""}</span>
            {d?.status === "grounded" && <span className="subtle" style={{ fontSize: 13 }}>Select a citation to spotlight it</span>}
          </div>
          {loading && (
            <>
              <Skeleton h={130} r={14} />
              <Skeleton h={130} r={14} />
            </>
          )}
          {!loading && d && shown.length === 0 && <p className="subtle" style={{ fontSize: 14 }}>No sources were found for this question.</p>}
          {!loading &&
            shown.map((s) => {
              const on = spot === s.n;
              return (
                <div key={s.n} className="stack">
                  {on && d?.status === "grounded" && (
                    <div className="connector" aria-hidden="true">
                      <b />
                      <i />
                      from [{s.n}]
                    </div>
                  )}
                  <button className={`evidence${on ? " is-spot" : ""}`} aria-pressed={on} onClick={() => setSpot(s.n)}>
                    <span className="row gap-2" style={{ width: "100%" }}>
                      <span className="tag mono tag-violet">[{s.n}]</span>
                      <strong className="truncate grow" style={{ fontSize: 14 }}>
                        {s.file.name}
                      </strong>
                      {s.file.__demo && <span className="tag tag-warn">DEMO</span>}
                    </span>
                    <span className="mono subtle" style={{ fontSize: 12 }}>
                      {pathCrumbs(s.file.path, 2).join(" › ")} · {locatorLong(s.locator)}
                    </span>
                    <span className="quote">
                      <Highlighted text={s.snippet} needles={s.highlight} />
                    </span>
                  </button>
                  {on && (
                    <button className="link-btn" style={{ alignSelf: "flex-start", marginTop: 8 }} onClick={() => openSource(s)}>
                      Open source at {locatorLong(s.locator)}
                    </button>
                  )}
                </div>
              );
            })}
          <p className="subtle" style={{ fontSize: 12.5, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            Sagot only states what these files say. Numbers and dates are checked against the cited passages before an answer is shown.
          </p>
        </aside>
      </div>
      <PreviewDrawer target={preview} onClose={() => setPreview(null)} />
    </AppShell>
  );
}
