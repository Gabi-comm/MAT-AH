import { lazy, Suspense, useCallback, useEffect, useState } from "react";
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
const MOTIONS: { id: MotionPref; label: string }[] = [
  { id: "full", label: "Full" },
  { id: "subtle", label: "Subtle" },
  { id: "none", label: "Off" },
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
      if ("cancelled" in res) toast("No folder selected.");
      else {
        toast(`Added ${res.path}. Indexing started.`);
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
      toast(`Removed ${r.name}`);
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
      toast(`${plural(res.added.length, "folder")} added. Indexing started.`);
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
      <h2 id="folders-h" className="card-title">Folders</h2>
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
          Whole computer
        </button>
      </div>
      <form className="row gap-2" onSubmit={(e) => { e.preventDefault(); if (path.trim()) add(false); }}>
        <label htmlFor="root-path" className="sr-only">Folder path</label>
        <input id="root-path" className="input grow" value={path} onChange={(e) => setPath(e.target.value)} placeholder="Or paste a folder path" />
        <button className="btn btn-line" type="submit" disabled={busy || !path.trim()}>Add</button>
      </form>
      <div className="stack gap-2" aria-live="polite">
        <div className="row wrap gap-3" style={{ justifyContent: "space-between" }}>
          <strong style={{ fontSize: 14, fontWeight: 500 }}>
            {running ? indexPhaseText(index!) : index?.finished ? (index.phase === "idle" ? "Indexing paused" : "Index up to date") : "Not indexed yet"}
          </strong>
          <div className="row gap-2">
            {running && (
              <button className="btn btn-ghost btn-sm" onClick={pause}>
                Pause
              </button>
            )}
            <button className="btn btn-line btn-sm" onClick={reindex} disabled={running || !roots?.length}>
              <Icon name="refresh" size={16} /> {running ? "Indexing…" : "Rescan"}
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
        {index?.embed_skipped && <span className="subtle" style={{ fontSize: 13 }}>Embedding model offline: keyword search only.</span>}
      </div>
    </section>
  );
}

export function SettingsPage({ section }: { section?: string }) {
  const { prefs, update } = usePrefs();
  const { status } = useStatus();
  const [customizing, setCustomizing] = useState(section === "iris");

  return (
    <AppShell page="settings" title="Settings">
      <div className="settings-grid">
        <section className="card stack gap-3" aria-labelledby="appearance-h">
          <h2 id="appearance-h" className="card-title">Appearance</h2>
          <div className="setting-row">
            <span>Theme</span>
            <div className="segmented" role="radiogroup" aria-label="Theme">
              {THEMES.map((t) => (
                <button key={t.id} role="radio" aria-checked={prefs.theme === t.id} onClick={() => update({ theme: t.id })}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="setting-row">
            <span>Animation</span>
            <div className="segmented" role="radiogroup" aria-label="Animation">
              {MOTIONS.map((m) => (
                <button key={m.id} role="radio" aria-checked={prefs.motion === m.id} onClick={() => update({ motion: m.id })}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={prefs.followSystemMotion} onChange={(e) => update({ followSystemMotion: e.target.checked })} />
            Follow system reduced motion
          </label>
        </section>

        <section className="card stack gap-3" aria-labelledby="iris-h">
          <div className="setting-row">
            <h2 id="iris-h" className="card-title">Iris</h2>
            <label className="switch">
              <input type="checkbox" checked={prefs.iris.visible} onChange={(e) => update({ iris: { visible: e.target.checked } })} />
              Show Iris
            </label>
          </div>
          {!customizing && (
            <button className="btn btn-line" style={{ alignSelf: "flex-start" }} onClick={() => setCustomizing(true)}>
              <Icon name="palette" /> Customize Iris
            </button>
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
            <Notice tone="warn">Cloud models detected in Ollama ({status.cloud_models.join(", ")}). Use local models to keep files private.</Notice>
          )}
        </section>
      </div>
    </AppShell>
  );
}
