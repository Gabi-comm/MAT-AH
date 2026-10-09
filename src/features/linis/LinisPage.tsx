import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyState, ErrorState, InlineIris, Notice, Progress } from "../../components/feedback/Feedback";
import { Icon } from "../../components/Icon";
import { useTrackedRequest } from "../../hooks/useTrackedRequest";
import { useBackend } from "../../services/BackendContext";
import { folderOf, formatBytes, plural } from "../../services/normalize";
import type { LinisReport, LinisRef, Proposal, RootFolder } from "../../services/types";
import { ProposalReview } from "../kilos/ProposalReview";

type Tab = "dupes" | "zero" | "empty";

export function LinisPage() {
  const backend = useBackend();
  const scan = useTrackedRequest<LinisReport, [string | undefined]>("scan", (signal, path) => backend.linis(path, signal), () => "report");
  const { run } = scan;
  const [tab, setTab] = useState<Tab>("dupes");
  const [files, setFiles] = useState<Set<number>>(new Set());
  const [dirs, setDirs] = useState<Set<string>>(new Set());
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [folder, setFolder] = useState("");
  const [roots, setRoots] = useState<RootFolder[]>([]);
  // A folder name resolves inside the first authorized folder that is listed (same rule as the team's first UI).
  const target = () => {
    const t = folder.trim();
    if (!t) return undefined;
    if (/^[a-z]:\\/i.test(t)) return t;
    return roots.length ? `${roots[0].path}\\${t}` : t;
  };
  const rescan = () => {
    setProposal(null);
    run(target());
  };

  useEffect(() => {
    const c = new AbortController();
    backend.roots(c.signal).then(setRoots, () => setRoots([]));
    return () => c.abort();
  }, [backend]);

  useEffect(() => {
    run(undefined);
  }, [run]);

  const r = scan.data;

  // Default selection: every extra copy of an exact duplicate (never the copy being kept).
  useEffect(() => {
    if (!r) return;
    setFiles(new Set(r.duplicates.flatMap((g) => g.extra.map((x) => x.id).filter((x): x is number => x !== null))));
    setDirs(new Set());
  }, [r]);

  const sizeById = useMemo(() => {
    const m = new Map<number, number>();
    r?.duplicates.forEach((g) => g.extra.forEach((x) => x.id !== null && m.set(x.id, g.size)));
    return m;
  }, [r]);
  const selectedBytes = [...files].reduce((a, id) => a + (sizeById.get(id) ?? 0), 0);
  const total = r?.reclaimable_bytes ?? 0;

  const toggleFile = (id: number | null) => {
    if (id === null) return;
    setFiles((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const toggleDir = (p: string) =>
    setDirs((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });

  async function review() {
    setCreating(true);
    setErr(null);
    try {
      setProposal(await backend.proposeCleanup([...files], [...dirs]));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  const row = (x: LinisRef, sub?: string) => (
    <label key={x.path} className={`check-row${x.id !== null && files.has(x.id) ? "" : " is-off"}`}>
      <input type="checkbox" checked={x.id !== null && files.has(x.id)} disabled={x.id === null || !!proposal} onChange={() => toggleFile(x.id)} />
      <span className="stack grow" style={{ gap: 2 }}>
        <span className="truncate" style={{ fontSize: 14, fontWeight: 500 }}>{x.name}</span>
        <span className="mono subtle truncate" style={{ fontSize: 12 }}>{folderOf(x.path)}</span>
      </span>
      <span className="tag">{x.id === null ? "not indexed, skip" : sub ?? "Recycle Bin"}</span>
    </label>
  );

  return (
    <AppShell page="linis" title="Clean up">
      <form className={`seam-field${scan.status === "loading" ? " is-busy" : ""}`} onSubmit={(e) => { e.preventDefault(); rescan(); }} aria-busy={scan.status === "loading"}>
        <Icon name="folder" size={20} />
        <label htmlFor="linis-folder" className="sr-only">Folder to check</label>
        <input id="linis-folder" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Folder to check (blank = all your folders), e.g. Downloads" autoComplete="off" />
        <button className="btn btn-primary" type="submit" disabled={scan.status === "loading"}>Suriin</button>
        <span className="seam-line" aria-hidden="true" />
      </form>
      {scan.status === "loading" && (
        <div className="card stack gap-3" role="status" aria-live="polite">
          <div className="row gap-4">
            <InlineIris state="searching" size={52} />
            <div className="stack gap-1">
              <strong>Checking your folders…</strong>
              <span className="subtle" style={{ fontSize: 14 }}>Comparing file contents to find exact duplicates, empty files and empty folders.</span>
            </div>
          </div>
          <Progress label="Scanning for clutter" />
        </div>
      )}
      {scan.status === "error" && <ErrorState error={scan.error} onRetry={rescan} />}

      {r && scan.status === "done" && (
        <>
          <div className="page-head">
            <h1 style={{ fontSize: "clamp(26px, 2.6vw, 38px)" }}>
              {total > 0 ? `${formatBytes(total)} to review.` : "Your folders are already clean."}
            </h1>
            <button className="btn btn-ghost" onClick={rescan}>
              <Icon name="refresh" /> Scan again
            </button>
          </div>

          <section className="card stack gap-3" aria-label="Storage summary">
            <div className="storage-bar" role="img" aria-label={`${formatBytes(selectedBytes)} selected of ${formatBytes(total)} reclaimable`}>
              <span style={{ width: total ? `${(selectedBytes / total) * 100}%` : 0, background: "var(--accent-primary)" }} />
              <span style={{ width: total ? `${((total - selectedBytes) / total) * 100}%` : 0, background: "var(--c-lavender)" }} />
            </div>
            <div className="legend">
              <span><i style={{ background: "var(--accent-primary)" }} />Selected · <strong className="mono">{formatBytes(selectedBytes)}</strong></span>
              <span><i style={{ background: "var(--c-lavender)" }} />Other duplicate copies</span>
              <span className="subtle">{plural(r.zero_byte.length, "empty file")} · {plural(r.empty_folders.length, "empty folder")}</span>
            </div>
          </section>

          {!proposal && (
            <>
              <div className="tabs" role="tablist" aria-label="Cleanup categories">
                <button className="tab" role="tab" aria-selected={tab === "dupes"} onClick={() => setTab("dupes")}>Exact duplicates <span className="mono">{r.duplicates.length}</span></button>
                <button className="tab" role="tab" aria-selected={tab === "zero"} onClick={() => setTab("zero")}>Zero-byte files <span className="mono">{r.zero_byte.length}</span></button>
                <button className="tab" role="tab" aria-selected={tab === "empty"} onClick={() => setTab("empty")}>Empty folders <span className="mono">{r.empty_folders.length}</span></button>
              </div>

              <div role="tabpanel" className="stack gap-3">
                {tab === "dupes" &&
                  (r.duplicates.length ? (
                    r.duplicates.map((g) => (
                      <div key={g.sha256} className="card stack gap-3 reveal">
                        <div className="row wrap gap-3">
                          <strong style={{ fontSize: 15 }}>{g.keep.name} · {g.extra.length + 1} copies</strong>
                          <span className="row gap-1 subtle" style={{ fontSize: 13 }}><Icon name="check" size={16} className="ok-ic" />Identical content (same SHA-256)</span>
                          <span className="mono" style={{ marginLeft: "auto", fontSize: 13 }}>{formatBytes(g.size * g.extra.length)} reclaimable</span>
                        </div>
                        <div className="check-row" style={{ cursor: "default", borderColor: "var(--success)" }}>
                          <Icon name="lock" className="ok-ic" />
                          <span className="stack grow" style={{ gap: 2 }}>
                            <span className="truncate" style={{ fontSize: 14, fontWeight: 500 }}>{g.keep.name}</span>
                            <span className="mono subtle truncate" style={{ fontSize: 12 }}>{folderOf(g.keep.path)}</span>
                          </span>
                          <span className="tag tag-ok">Keep · oldest copy</span>
                        </div>
                        {g.extra.map((x) => row(x))}
                      </div>
                    ))
                  ) : (
                    <EmptyState iris="success" title="No exact duplicates." />
                  ))}
                {tab === "zero" &&
                  (r.zero_byte.length ? r.zero_byte.map((x) => row(x, "0 B · Recycle Bin")) : <EmptyState iris="success" title="No empty files." />)}
                {tab === "empty" &&
                  (r.empty_folders.length ? (
                    r.empty_folders.map((d) => (
                      <label key={d.path} className={`check-row${dirs.has(d.path) ? "" : " is-off"}`}>
                        <input type="checkbox" checked={dirs.has(d.path)} onChange={() => toggleDir(d.path)} />
                        <span className="stack grow" style={{ gap: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{d.name}</span>
                          <span className="mono subtle truncate" style={{ fontSize: 12 }}>{d.path}</span>
                        </span>
                        <span className="tag">remove folder</span>
                      </label>
                    ))
                  ) : (
                    <EmptyState iris="success" title="No empty folders." />
                  ))}
              </div>

              {err && <Notice tone="err">{err}</Notice>}

              <div className="approval">
                <div className="grow stack" style={{ minWidth: 220 }}>
                  <strong>{files.size + dirs.size} items selected</strong>
                  <span className="muted" style={{ fontSize: 14 }}>Next you'll see the exact list and confirm. Files go to the Recycle Bin.</span>
                </div>
                <button className="btn btn-primary" onClick={review} disabled={creating || files.size + dirs.size === 0}>
                  {creating ? "Preparing…" : "Review cleanup"}
                </button>
              </div>
            </>
          )}

          {proposal && (
            <>
              <ProposalReview key={proposal.id} proposal={proposal} onChange={setProposal} />
              {proposal.status !== "pending" && (
                <button className="btn btn-line" style={{ alignSelf: "flex-start" }} onClick={rescan}>
                  Scan again
                </button>
              )}
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
