import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyState, ErrorState, Notice, Skeleton } from "../../components/feedback/Feedback";
import { Icon } from "../../components/Icon";
import { ResultCard } from "../../components/files/ResultCard";
import { PreviewDrawer, type PreviewTarget } from "../../components/files/PreviewDrawer";
import { useTrackedRequest } from "../../hooks/useTrackedRequest";
import { hrefFor, type Page } from "../../hooks/useRoute";
import { useBackend } from "../../services/BackendContext";
import { kindLabel, plural } from "../../services/normalize";
import type { SearchHit, SearchResponse } from "../../services/types";

export function HanapPage({ q, navigate }: { q: string; navigate: (p: Page, params?: Record<string, string>) => void }) {
  const backend = useBackend();
  const [draft, setDraft] = useState(q);
  const [kind, setKind] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useTrackedRequest<SearchResponse, [string]>(
    "search",
    (signal, query) => backend.search(query, signal),
    (r) => (r.hits.length > 0 ? "hits" : "empty"),
  );
  const { run, cancel, reset } = search;

  useEffect(() => {
    setDraft(q);
    setKind("all");
    setSelected(null);
    if (q.trim()) run(q.trim());
    else reset();
  }, [q, run, reset]);

  useEffect(() => {
    if (!q) inputRef.current?.focus();
  }, [q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    if (t === q) run(t);
    else navigate("hanap", { q: t });
  }

  const data = search.data;
  const loading = search.status === "loading";
  const kinds = useMemo(() => {
    const m = new Map<string, number>();
    data?.hits.forEach((h) => m.set(h.file.kind, (m.get(h.file.kind) ?? 0) + 1));
    return [...m.entries()];
  }, [data]);
  const hits: SearchHit[] = useMemo(() => (data ? data.hits.filter((h) => kind === "all" || h.file.kind === kind) : []), [data, kind]);
  // Meaning-only hits far below the best one stay available but folded away (kept from the team's first UI).
  const top = hits[0]?.score ?? 0;
  const isWeak = (h: SearchHit, i: number) =>
    i >= 3 && !h.why.some((w) => w === "words" || w === "keyword") && h.score < top * 0.45;
  const strong = hits.filter((h, i) => !isWeak(h, i));
  const weak = hits.filter((h, i) => isWeak(h, i));

  const openPreview = (h: SearchHit) => {
    setSelected(h.file.id);
    setPreview({ fileId: h.file.id, name: h.file.name, chunkId: h.chunk_id, locator: h.locator, highlight: h.highlight, excerpt: h.snippet });
  };

  const parsed = data?.query;
  const announce =
    search.status === "loading"
      ? "One moment, searching…"
      : search.status === "done" && data
        ? data.hits.length
          ? `Found it! ${plural(data.hits.length, "result")}.`
          : "No files found."
        : search.status === "error"
          ? "Search failed."
          : "";

  return (
    <AppShell page="hanap" title="Find">
      <form className={`seam-field${loading ? " is-busy" : ""}`} onSubmit={submit} role="search" aria-busy={loading}>
        <Icon name="search" size={20} />
        <label htmlFor="hanap-q" className="sr-only">
          Describe the file
        </label>
        <input
          id="hanap-q"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What are you looking for?"
          autoComplete="off"
        />
        {loading && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>
            Cancel
          </button>
        )}
        <button className="btn btn-primary" type="submit">
          Search
        </button>
        <span className="seam-line" aria-hidden="true" />
      </form>

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {parsed && search.status !== "loading" && (
        <div className="row wrap gap-2" aria-label="How MAT-AH read your search">
          {parsed.kinds.map((k) => (
            <span key={k} className="tag tag-violet">
              {kindLabel(k)}
            </span>
          ))}
          {parsed.date_label && <span className="tag tag-violet">{parsed.date_label}</span>}
          {parsed.amounts.map((a) => (
            <span key={a} className="tag tag-violet">
              ₱{a.toLocaleString("en-US", { minimumFractionDigits: a % 1 ? 2 : 0 })}
            </span>
          ))}
          {parsed.phrases.map((p) => (
            <span key={p} className="tag">"{p}"</span>
          ))}
          {parsed.terms.slice(0, 6).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
          {data && <span className="mono subtle" style={{ fontSize: 12 }}>{data.mode === "hybrid" ? "words + meaning" : "words only"}</span>}
        </div>
      )}

      {data && data.relaxed.length > 0 && !loading && (
        <Notice tone="warn">
          No exact match for {data.relaxed.map((r) => (r === "type" ? "file type" : r)).join(" and ")}, so I widened the search.
        </Notice>
      )}

      {!q && search.status === "idle" && (
        <EmptyState iris="idle" title="Just describe it." body="You don't need the file name. Describe what's inside, what it looks like, or when you saved it." />
      )}

      {search.status === "error" && <ErrorState error={search.error} onRetry={() => run(q)} />}

      {loading && !data && (
        <div className="grid-auto" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card stack gap-2" style={{ padding: 10 }}>
              <Skeleton h={132} />
              <Skeleton h={12} w="80%" />
              <Skeleton h={12} w="50%" />
            </div>
          ))}
        </div>
      )}

      {data && search.status !== "error" && data.hits.length === 0 && !loading && (
        <EmptyState
          title="Nothing found yet."
          body={<>Try a different description? No file in your authorized folders matched "{data.query.raw}".</>}
        >
          <button className="btn btn-line" onClick={() => inputRef.current?.focus()}>
            Change search
          </button>
          <a className="btn btn-line" href={hrefFor("settings")}>
            Add a folder
          </a>
        </EmptyState>
      )}

      {data && data.hits.length > 0 && (
        <section className="stack gap-4" aria-label="Results" style={{ opacity: loading ? 0.55 : 1, transition: "opacity 220ms" }}>
          <div className="row wrap gap-2">
            <button className="chip chip-sm" aria-pressed={kind === "all"} onClick={() => setKind("all")}>
              All · {data.hits.length}
            </button>
            {kinds.map(([k, n]) => (
              <button key={k} className="chip chip-sm" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {kindLabel(k)} · {n}
              </button>
            ))}
            <div className="segmented" role="radiogroup" aria-label="View" style={{ marginLeft: "auto" }}>
              <button role="radio" aria-checked={view === "grid"} aria-label="Grid view" onClick={() => setView("grid")}>
                <Icon name="grid" />
              </button>
              <button role="radio" aria-checked={view === "list"} aria-label="List view" onClick={() => setView("list")}>
                <Icon name="list" />
              </button>
            </div>
          </div>
          <div
            key={`${data.query.raw}-${data.hits.length}-${kind}`}
            className={`reveal-stagger ${view === "grid" ? "grid-auto" : "stack gap-3 results-list"}`}
          >
            {strong.map((h, i) => (
              <ResultCard
                key={h.file.id}
                hit={h}
                best={i === 0 && kind === "all"}
                selected={selected === h.file.id}
                dim={i > 0 && kind === "all"}
                onPreview={openPreview}
              />
            ))}
          </div>
          {weak.length > 0 && (
            <details className="weaker">
              <summary>
                {weak.length} weaker {weak.length === 1 ? "match" : "matches"}, related in meaning only
              </summary>
              <div className={view === "grid" ? "grid-auto" : "stack gap-3 results-list"} style={{ marginTop: 12 }}>
                {weak.map((h) => (
                  <ResultCard key={h.file.id} hit={h} selected={selected === h.file.id} dim onPreview={openPreview} />
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      <PreviewDrawer target={preview} onClose={() => setPreview(null)} />
    </AppShell>
  );
}
