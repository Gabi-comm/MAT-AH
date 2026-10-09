import { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Skeleton } from "../../components/feedback/Feedback";
import { Icon } from "../../components/Icon";
import { useStatus } from "../../hooks/StatusContext";
import { hrefFor, type Page } from "../../hooks/useRoute";
import { IrisCompanion } from "../../mascot/IrisCompanion";
import { useBackend } from "../../services/BackendContext";
import { isAbort } from "../../services/apiClient";
import { indexPhaseText, plural } from "../../services/normalize";
import type { RootFolder } from "../../services/types";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Magandang umaga" : h < 18 ? "Magandang hapon" : "Magandang gabi";
}

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
    <AppShell page="home" title="Home" eyebrow="MAT-AH · Hanap. Kita. Sagot. Kilos." showCompanion={false}>
      <section className="hero" aria-labelledby="home-h">
        <div className="hero-head">
          <div className="stack gap-2">
            <span className="muted">{greeting()}.</span>
            <h1 id="home-h">Ano'ng hinahanap mo?</h1>
          </div>
          <IrisCompanion size={84} />
        </div>

        <form className="seam-field lg" onSubmit={submit} role="search">
          <Icon name="search" size={22} />
          <label htmlFor="home-q" className="sr-only">
            {mode === "hanap" ? "Describe a file to find" : "Ask a question about your files"}
          </label>
          <input
            id="home-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === "hanap" ? 'Ilarawan ang file: "screenshot ng GCash receipt na ₱1,500"' : 'Magtanong: "Kailan ang deadline ng enrollment?"'}
            autoComplete="off"
          />
          <div className="segmented" role="radiogroup" aria-label="Mode">
            <button type="button" role="radio" aria-checked={mode === "hanap"} onClick={() => setMode("hanap")}>
              Hanap
            </button>
            <button type="button" role="radio" aria-checked={mode === "sagot"} onClick={() => setMode("sagot")}>
              Sagot
            </button>
          </div>
          <button className="btn btn-primary" type="submit">
            {mode === "hanap" ? "Hanapin" : "Itanong"}
          </button>
          <span className="seam-line" aria-hidden="true" />
        </form>
        <div className="row wrap gap-3" style={{ justifyContent: "space-between", fontSize: 13 }}>
          <span className="subtle">
            {mode === "hanap"
              ? "Hanap finds your real files. Results are never generated."
              : "Sagot answers only from your files, with a source for every claim."}
          </span>
          <span className="mono subtle">Enter to run</span>
        </div>

      </section>

      <section className="grid-auto-wide" aria-label="Workspace status">
        <div className="card stack gap-3">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="card-title">Authorized folders</h2>
            <a href={hrefFor("settings")} style={{ fontSize: 14 }}>
              Manage
            </a>
          </div>
          {roots === null && !rootsErr && <Skeleton h={60} />}
          {rootsErr && <p className="subtle" style={{ fontSize: 14 }}>Folders unavailable until the backend is running.</p>}
          {roots && roots.length === 0 && (
            <div className="stack gap-3">
              <p className="muted" style={{ fontSize: 14 }}>
                Wala pang folder. Choose the folders MAT-AH may read. Nothing outside them is ever opened.
              </p>
              <a className="btn btn-primary" href={hrefFor("settings")} style={{ alignSelf: "flex-start" }}>
                <Icon name="plus" /> Pumili ng folder
              </a>
            </div>
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
              <Icon name="alert" className="err-ic" /> Backend not reachable. Start MAT-AH's server, then refresh.
            </div>
          )}
          {!status && !statusError && <Skeleton h={60} />}
          {status && (
            <>
              <div className="status-line">
                <Icon name={status.ollama ? "check" : "alert"} className={status.ollama ? "ok-ic" : "warn-ic"} />
                {status.ollama ? "Local AI ready" : "Local AI offline: search still works, answers are limited"}
                {status.chat_model && <span className="meta">{status.chat_model}</span>}
              </div>
              <div className="status-line">
                <Icon name={index?.running ? "refresh" : "check"} className={index?.running ? "warn-ic" : "ok-ic"} />
                {index?.running ? indexPhaseText(index) : `${plural(totalFiles, "file")} searchable`}
                <span className="meta">{plural(status.vectors, "vector")}</span>
              </div>
              <div className="status-line">
                <Icon name="lock" />
                No cloud. Files stay on this computer.
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
