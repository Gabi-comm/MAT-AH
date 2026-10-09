import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { MatahAppIcon, MatahWordmark } from "../../branding/MatahLogo";
import { AppShell } from "../../components/layout/AppShell";
import { Notice, Progress, Skeleton, useToast } from "../../components/feedback/Feedback";
import { Icon } from "../../components/Icon";
import { useStatus } from "../../hooks/StatusContext";
import { usePrefs } from "../../prefs/PrefsContext";
import type { MotionPref, ThemePref } from "../../prefs/preferences";
import { useBackend } from "../../services/BackendContext";
import { isAbort } from "../../services/apiClient";
import { indexPhaseText, plural } from "../../services/normalize";
import type { RootFolder } from "../../services/types";

const IrisCustomization = lazy(() => import("../../mascot/IrisCustomization"));

const THEMES: { id: ThemePref; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];
const MOTIONS: { id: MotionPref; label: string; hint: string }[] = [
  { id: "full", label: "Full", hint: "Iris idles, hops and celebrates" },
  { id: "subtle", label: "Subtle", hint: "Single, quiet reactions only" },
  { id: "none", label: "No decorative motion", hint: "Status changes appear instantly" },
];

function Folders() {
  const backend = useBackend();
  const toast = useToast();
  const { index, startIndex, refresh } = useStatus();
  const [roots, setRoots] = useState<RootFolder[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [path, setPath] = useState("");

  const load = useCallback((signal?: AbortSignal) => {
    backend
      .roots(signal)
      .then((r) => {
        setRoots(r);
        setErr(null);
      })
      .catch((e) => !isAbort(e) && setErr((e as Error).message));
  }, [backend]);

  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    return () => c.abort();
  }, [load]);

  // Refresh counts when an indexing run finishes.
  useEffect(() => {
    if (index && !index.running) load();
  }, [index?.running, index, load]);

  async function add(usePicker: boolean) {
    setBusy(true);
    try {
      const res = await backend.addRoot(usePicker ? undefined : path.trim());
      if ("cancelled" in res) toast("Walang napiling folder.");
      else {
        toast(`Idinagdag: ${res.path}. Sinisimulan ang indexing.`);
        setPath("");
        await startIndex();
      }
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: RootFolder) {
    if (!window.confirm(`Stop using "${r.name}"? Its index entries are removed. Your files are not touched.`)) return;
    try {
      await backend.removeRoot(r.id);
      toast(`Inalis sa MAT-AH: ${r.name}`);
      load();
      refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  async function wholeComputer() {
    if (!window.confirm("Add your whole user folder and other non-system drives? Indexing a whole computer can take a long time.")) return;
    setBusy(true);
    try {
      const res = await backend.addComputer();
      toast(`${plural(res.added.length, "folder")} added. Sinisimulan ang indexing.`);
      await startIndex();
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    try {
      await backend.stopIndex();
      refresh();
      toast("Indexing will pause after the current file.");
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  async function reindex() {
    try {
      await startIndex();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  const running = !!index?.running;
  return (
    <section className="card stack gap-4" aria-labelledby="folders-h">
      <h2 id="folders-h" className="card-title">Authorized folders</h2>
      <p className="muted" style={{ fontSize: 14 }}>MAT-AH reads only inside these folders. Removing one deletes its index entries, never your files.</p>
      {roots === null && !err && <Skeleton h={56} />}
      {err && <Notice tone="err">Folders unavailable: {err}</Notice>}
      {roots && roots.length === 0 && <p className="subtle" style={{ fontSize: 14 }}>No folders yet.</p>}
      {roots && roots.length > 0 && (
        <ul className="list-plain">
          {roots.map((r) => (
            <li key={r.id} className="check-row" style={{ cursor: "default" }}>
              <Icon name="folder" />
              <span className="stack grow" style={{ gap: 2 }}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{r.name}</span>
                <span className="mono subtle truncate" style={{ fontSize: 12 }}>{r.path}</span>
              </span>
              <span className="mono subtle" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{plural(r.files, "file")}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(r)} aria-label={`Remove ${r.name}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row wrap gap-2">
        <button className="btn btn-primary" onClick={() => add(true)} disabled={busy}>
          <Icon name="plus" /> Choose folder…
        </button>
        <button className="btn btn-line" onClick={wholeComputer} disabled={busy || running}>
          Search my whole computer
        </button>
        <form className="row gap-2 grow" onSubmit={(e) => { e.preventDefault(); if (path.trim()) add(false); }}>
          <label htmlFor="root-path" className="sr-only">Folder path</label>
          <input id="root-path" className="grow" value={path} onChange={(e) => setPath(e.target.value)} placeholder="or paste a path: C:\Users\you\Documents" style={{ minHeight: 44, padding: "0 12px", borderRadius: 10, border: "1.5px solid var(--border-input)", background: "var(--surface-elevated)" }} />
          <button className="btn btn-line" type="submit" disabled={busy || !path.trim()}>Add</button>
        </form>
      </div>
      <div className="stack gap-2" aria-live="polite">
        <div className="row wrap gap-3" style={{ justifyContent: "space-between" }}>
          <strong style={{ fontSize: 14 }}>
            {running ? indexPhaseText(index!) : index?.finished ? (index.phase === "idle" ? "Indexing paused" : "Index up to date") : "Not indexed yet"}
          </strong>
          <div className="row gap-2">
            {running && (
              <button className="btn btn-ghost btn-sm" onClick={pause}>
                Pause indexing
              </button>
            )}
            <button className="btn btn-line btn-sm" onClick={reindex} disabled={running || !roots?.length}>
              <Icon name="refresh" size={16} /> {running ? "Indexing…" : "Check for new files"}
            </button>
          </div>
        </div>
        {running && (
          <>
            <Progress done={index!.phase === "listing" ? undefined : index!.done} total={index!.phase === "listing" ? undefined : index!.total} label="Indexing progress" />
            <span className="subtle truncate" style={{ fontSize: 13 }}>{index!.current}</span>
          </>
        )}
        {index && !running && index.errors.length > 0 && (
          <details className="tech">
            <summary>{plural(index.errors.length, "file")} could not be read</summary>
            <pre>{index.errors.slice(0, 30).join("\n")}</pre>
          </details>
        )}
        {index?.embed_skipped && <span className="subtle" style={{ fontSize: 13 }}>Meaning search skipped: the local embedding model was not running. Keyword search still works.</span>}
      </div>
    </section>
  );
}

export function SettingsPage({ section }: { section?: string }) {
  const { prefs, update, systemReducedMotion, motion } = usePrefs();
  const { status } = useStatus();
  const [customizing, setCustomizing] = useState(section === "iris");
  const [logoKey, setLogoKey] = useState(0);

  return (
    <AppShell page="settings" title="Settings" eyebrow="Appearance, Iris and folders">
      <div className="settings-grid">
        <section className="card stack gap-4" aria-labelledby="appearance-h">
          <h2 id="appearance-h" className="card-title">Appearance</h2>
          <fieldset className="stack gap-2">
            <legend className="label" style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Theme</legend>
            <div className="segmented" role="radiogroup" aria-label="Theme" style={{ alignSelf: "flex-start" }}>
              {THEMES.map((t) => (
                <button key={t.id} role="radio" aria-checked={prefs.theme === t.id} onClick={() => update({ theme: t.id })}>
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="stack gap-2">
            <legend style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Animation</legend>
            {MOTIONS.map((m) => (
              <label key={m.id} className="check-row">
                <input type="radio" name="motion" checked={prefs.motion === m.id} onChange={() => update({ motion: m.id })} />
                <span className="stack" style={{ gap: 0 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{m.label}</span>
                  <span className="subtle" style={{ fontSize: 13 }}>{m.hint}</span>
                </span>
              </label>
            ))}
            <label className="check-row">
              <input type="checkbox" checked={prefs.followSystemMotion} onChange={(e) => update({ followSystemMotion: e.target.checked })} />
              <span className="stack" style={{ gap: 0 }}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>Follow system reduced-motion preference</span>
                <span className="subtle" style={{ fontSize: 13 }}>
                  Windows animation effects are {systemReducedMotion ? "off, so decorative motion is off" : "on"}. Now using: {motion}.
                </span>
              </span>
            </label>
          </fieldset>
        </section>

        <section className="card stack gap-4" aria-labelledby="iris-h">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 id="iris-h" className="card-title">Iris</h2>
            <label className="row gap-2" style={{ fontSize: 14, minHeight: 44 }}>
              <input type="checkbox" checked={prefs.iris.visible} onChange={(e) => update({ iris: { visible: e.target.checked } })} style={{ width: 18, height: 18, accentColor: "var(--accent-primary)" }} />
              Show Iris
            </label>
          </div>
          {!customizing && (
            <>
              <p className="muted" style={{ fontSize: 14 }}>Iris reacts to your searches, answers and approvals. Every status she shows is also written in text.</p>
              <button className="btn btn-line" style={{ alignSelf: "flex-start" }} onClick={() => setCustomizing(true)}>
                <Icon name="palette" /> Customize Iris
              </button>
            </>
          )}
          {customizing && (
            <Suspense fallback={<Skeleton h={240} />}>
              <IrisCustomization onDone={() => setCustomizing(false)} />
            </Suspense>
          )}
        </section>

        <Folders />

        <section className="card stack gap-3" aria-labelledby="ai-h">
          <h2 id="ai-h" className="card-title">Local AI</h2>
          <p className="muted" style={{ fontSize: 14 }}>Models and indexing are managed by the MAT-AH backend on this computer. This page only shows their status.</p>
          {!status && <Skeleton h={80} />}
          {status && (
            <dl className="kv">
              <div><dt>Ollama</dt><dd>{status.ollama ? "Running" : "Not running"}</dd></div>
              <div><dt>Answer model</dt><dd className="mono" style={{ fontSize: 13 }}>{status.chat_model ?? "None"}</dd></div>
              <div><dt>Embedding model</dt><dd className="mono" style={{ fontSize: 13 }}>{status.embed_model ?? "None"}</dd></div>
              <div><dt>OCR</dt><dd>{status.ocr}</dd></div>
              <div><dt>Vectors</dt><dd className="mono">{status.vectors.toLocaleString("en-US")}</dd></div>
              <div><dt>Internet</dt><dd>{status.online ? "Connected, not used" : "Offline"}</dd></div>
            </dl>
          )}
          {status && status.cloud_models.length > 0 && (
            <Notice tone="warn">Cloud models are installed in Ollama ({status.cloud_models.join(", ")}). MAT-AH's privacy promise assumes local models.</Notice>
          )}
        </section>

        <section className="card stack gap-3" aria-labelledby="about-h">
          <h2 id="about-h" className="card-title">About</h2>
          <div className="row gap-4" style={{ minHeight: 64 }}>
            <MatahAppIcon size={56} />
            <MatahWordmark key={logoKey} height={34} animate />
          </div>
          <p className="muted" style={{ fontSize: 14 }}>"Ah, kita ko na!" · Hanap. Kita. Sagot. Kilos.</p>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setLogoKey((k) => k + 1)}>
            Replay logo
          </button>
        </section>
      </div>
    </AppShell>
  );
}
