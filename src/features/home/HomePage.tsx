import { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Skeleton } from "../../components/feedback/Feedback";
import { Icon, type IconName } from "../../components/Icon";
import { useStatus } from "../../hooks/StatusContext";
import { hrefFor, type Page } from "../../hooks/useRoute";
import { IrisCompanion } from "../../mascot/IrisCompanion";
import { useBackend } from "../../services/BackendContext";
import { isAbort } from "../../services/apiClient";
import { indexPhaseText, plural } from "../../services/normalize";
import type { RootFolder } from "../../services/types";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const QUICK: { page: Page; title: string; line: string; icon: IconName }[] = [
  { page: "hanap", title: "Find", line: "Find a file by what you remember", icon: "search" },
  { page: "sagot", title: "Ask", line: "Answers with sources", icon: "ask" },
  { page: "kilos", title: "Organize", line: "Organize into folders", icon: "organize" },
  { page: "linis", title: "Clean up", line: "Clear duplicates", icon: "clean" },
];

export function HomePage({ navigate }: { navigate: (p: Page, params?: Record<string, string>) => void }) {
  const backend = useBackend();
  const { status, error: statusError, index } = useStatus();
  const [mode, setMode] = useState<"hanap" | "sagot">("hanap");
  const [q, setQ] = useState("");
  const [roots, setRoots] = useState<RootFolder[] | null>(null);
  const [rootsErr, setRootsErr] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    backend
      .roots(c.signal)
      .then(setRoots)
      .catch((e) => !isAbort(e) && setRootsErr(true));
    return () => c.abort();
  }, [backend]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    navigate(mode, { q: q.trim() });
  }

  const totalFiles = status ? Object.values(status.files).reduce((a, b) => a + b, 0) : 0;

  return (
    <AppShell page="home" title="Home">
      <section className="hero" aria-labelledby="home-h">
        <div className="hero-orb">
          <IrisCompanion size={76} />
        </div>
        <div className="stack gap-2">
          <span className="greet">{greeting()}</span>
          <h1 id="home-h">What are you looking for?</h1>
        </div>

        <form className="seam-field lg" onSubmit={submit} role="search">
          <Icon name="search" size={20} />
          <label htmlFor="home-q" className="sr-only">
            {mode === "hanap" ? "Describe a file to find" : "Ask a question about your files"}
          </label>
          <input
            id="home-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === "hanap" ? '"GCash receipt for ₱1,500"' : '"When is the enrollment deadline?"'}
            autoComplete="off"
          />
          <div className="segmented" role="radiogroup" aria-label="Mode">
            <button type="button" role="radio" aria-checked={mode === "hanap"} onClick={() => setMode("hanap")}>
              Find
            </button>
            <button type="button" role="radio" aria-checked={mode === "sagot"} onClick={() => setMode("sagot")}>
              Ask
            </button>
          </div>
          <button className="btn btn-primary" type="submit">
            {mode === "hanap" ? "Search" : "Ask"}
          </button>
          <span className="seam-line" aria-hidden="true" />
        </form>
      </section>

      <nav className="quick-grid reveal-stagger" aria-label="Sections">
        {QUICK.map((x) => (
          <a key={x.page} className="glass quick" href={hrefFor(x.page)}>
            <span className="quick-ic" aria-hidden="true">
              <Icon name={x.icon} />
            </span>
            <strong>{x.title}</strong>
            <span>{x.line}</span>
          </a>
        ))}
      </nav>

      <section className="grid-auto-wide" aria-label="Workspace status">
        <div className="card stack gap-3">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="card-title">Folders</h2>
            <a href={hrefFor("settings")} style={{ fontSize: 13 }}>
              Manage
            </a>
          </div>
          {roots === null && !rootsErr && <Skeleton h={60} />}
          {rootsErr && <p className="subtle" style={{ fontSize: 14 }}>Unavailable until the backend is running.</p>}
          {roots && roots.length === 0 && (
            <a className="btn btn-primary" href={hrefFor("settings")} style={{ alignSelf: "flex-start" }}>
              <Icon name="plus" /> Choose a folder
            </a>
          )}
          {roots && roots.length > 0 && (
            <ul className="list-plain">
              {roots.map((r) => (
                <li key={r.id} className="row gap-3" style={{ justifyContent: "space-between", fontSize: 14 }}>
                  <span className="truncate" title={r.path}>
                    {r.name}
                  </span>
                  <span className="mono subtle" style={{ fontSize: 12 }}>
                    {plural(r.files, "file")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card stack gap-2">
          <h2 className="card-title">System</h2>
          {statusError && (
            <div className="status-line">
              <Icon name="alert" className="err-ic" /> Backend not reachable
            </div>
          )}
          {!status && !statusError && <Skeleton h={60} />}
          {status && (
            <>
              <div className="status-line">
                <Icon name={status.ollama ? "check" : "alert"} className={status.ollama ? "ok-ic" : "warn-ic"} />
                {status.ollama ? "Local AI ready" : "Local AI offline"}
                {status.chat_model && <span className="meta">{status.chat_model}</span>}
              </div>
              <div className="status-line">
                <Icon name={index?.running ? "refresh" : "check"} className={index?.running ? "warn-ic" : "ok-ic"} />
                {index?.running ? indexPhaseText(index) : `${plural(totalFiles, "file")} searchable`}
                <span className="meta">{plural(status.vectors, "vector")}</span>
              </div>
              <div className="status-line">
                <Icon name="lock" />
                Files stay on this computer
                <span className="meta">{status.online ? "online" : "offline"}</span>
              </div>
              {(() => {
                const steps = ["parse", "retrieve", "generate", "verify"].filter((k) => typeof status.last[k] === "number");
                if (!steps.length) return null;
                const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
                return (
                  <div className="status-line" title="Last request, measured on this computer">
                    <Icon name="refresh" />
                    Last request
                    <span className="meta">{steps.map((k) => `${k} ${ms(status.last[k] as number)}`).join(" · ")}</span>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}
