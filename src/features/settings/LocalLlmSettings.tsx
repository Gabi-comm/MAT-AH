import { useCallback, useEffect, useRef, useState } from "react";
import { Notice, Progress, Skeleton, useToast } from "../../components/feedback/Feedback";
import { Icon } from "../../components/Icon";
import { useStatus } from "../../hooks/StatusContext";
import { useBackend } from "../../services/BackendContext";
import { isAbort } from "../../services/apiClient";
import { plural } from "../../services/normalize";
import type { LlmConfig, LlmInfo, RecommendedModel } from "../../services/types";

const CONTEXTS = [2048, 4096, 8192, 16384, 32768, 65536, 131072];
const KEEP_ALIVE: { id: string; label: string }[] = [
  { id: "0", label: "Unload after each answer" },
  { id: "5m", label: "5 minutes" },
  { id: "30m", label: "30 minutes" },
  { id: "1h", label: "1 hour" },
  { id: "4h", label: "4 hours" },
  { id: "-1", label: "Always" },
];

function isLoopback(host: string): boolean {
  try {
    const h = new URL(host).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
  } catch {
    return true; // not a URL yet: the backend explains the format on save
  }
}

function same(a: LlmConfig, b: LlmConfig): boolean {
  return (Object.keys(a) as (keyof LlmConfig)[]).every((k) => a[k] === b[k]);
}

/** Ollama treats "name" and "name:latest" as the same model. */
function hasModel(names: Set<string>, m: string): boolean {
  return names.has(m) || (!m.includes(":") && names.has(`${m}:latest`));
}

const gb = (n: number | null) => (n === null ? "" : `${n.toFixed(1)} GB`);

function recLabel(r: RecommendedModel): string {
  const size = r.size_gb === null ? "" : ` · ${gb(r.size_gb)} download`;
  return `${r.label}${size}${r.fits ? "" : ` · needs ${r.min_ram_gb} GB memory`}`;
}

/** A model picker: Automatic, then models on this laptop, then recommended ones to download. */
function ModelSelect({ id, label, value, autoLabel, use, info, onChange }: {
  id: string;
  label: string;
  value: string;
  autoLabel: string;
  use: "answer" | "image";
  info: LlmInfo;
  onChange: (v: string) => void;
}) {
  const local = info.downloaded.filter((d) => !d.embed);
  const names = new Set(local.map((d) => d.name));
  const toGet = info.recommended.filter((r) => r.uses.includes(use) && !r.installed);
  const orphan = value && !hasModel(names, value) && !toGet.some((r) => r.name === value);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{autoLabel}</option>
        <optgroup label="On this laptop">
          {orphan && <option value={value}>{value} (not found)</option>}
          {local.map((d) => (
            <option key={d.name} value={d.name}>{d.size_gb === null ? d.name : `${d.name} · ${gb(d.size_gb)}`}</option>
          ))}
          {local.length === 0 && !orphan && <option disabled>No models downloaded yet</option>}
        </optgroup>
        {toGet.length > 0 && (
          <optgroup label="Recommended to download">
            {toGet.map((r) => (
              <option key={r.name} value={r.name}>{recLabel(r)}</option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}

/** One model that still needs downloading: what it is, a Download button, and live progress. */
function DownloadRow({ rec, info, onPull }: { rec: RecommendedModel; info: LlmInfo; onPull: (m: string) => void }) {
  const p = info.pulls[rec.name];
  const busy = p?.state === "downloading";
  return (
    <div className="model-get">
      <div className="model-get-head">
        <div className="model-get-text">
          <strong>{rec.label} <span className="mono subtle">{rec.name}</span></strong>
          <span className="subtle">
            {rec.note}
            {rec.size_gb !== null && ` ${gb(rec.size_gb)} download.`}
            {!rec.fits && ` Needs about ${rec.min_ram_gb} GB of memory; this laptop has ${info.ram_gb} GB.`}
          </span>
        </div>
        <button type="button" className="btn btn-line" disabled={busy || !info.up} onClick={() => onPull(rec.name)}>
          <Icon name="download" size={16} /> {busy ? "Downloading…" : p?.state === "error" ? "Try again" : "Download"}
        </button>
      </div>
      {busy && (
        <div className="stack gap-1">
          <Progress done={p.completed} total={p.total} label={`Downloading ${rec.name}`} />
          <span className="subtle mono" style={{ fontSize: 12 }}>
            {p.total > 0 ? `${gb(p.completed / 1e9)} of ${gb(p.total / 1e9)}` : p.status}
          </span>
        </div>
      )}
      {p?.state === "error" && <Notice tone="err">Download failed: {p.error}</Notice>}
      {!info.up && <span className="subtle" style={{ fontSize: 13 }}>Start Ollama to download.</span>}
    </div>
  );
}

export function LocalLlmSettings() {
  const backend = useBackend();
  const toast = useToast();
  const { refresh: refreshStatus } = useStatus();
  const [info, setInfo] = useState<LlmInfo | null>(null);
  const [draft, setDraft] = useState<LlmConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const announced = useRef(new Set<string>());

  // While a download runs, poll for progress. Only the server's view updates; unsaved edits stay.
  const downloading = info ? Object.values(info.pulls).some((p) => p.state === "downloading") : false;
  useEffect(() => {
    if (!downloading) return;
    const t = window.setInterval(() => {
      backend.llm(false).then(setInfo).catch(() => {});
    }, 1000);
    return () => window.clearInterval(t);
  }, [downloading, backend]);

  // Say once when a download finishes, and refresh the list so it shows as downloaded.
  useEffect(() => {
    if (!info) return;
    for (const [m, p] of Object.entries(info.pulls)) {
      if (p.state === "done" && !announced.current.has(m)) {
        announced.current.add(m);
        toast(`${m} downloaded.`);
        backend.llm(true).then(setInfo).catch(() => {});
        refreshStatus();
      }
    }
  }, [info, backend, toast, refreshStatus]);

  async function pull(model: string) {
    announced.current.delete(model);
    try {
      setInfo(await backend.pullLlm(model));
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  const apply = useCallback((i: LlmInfo) => {
    setInfo(i);
    setDraft({ ...i.config });
    setErr(null);
  }, []);

  useEffect(() => {
    const c = new AbortController();
    backend.llm(false, c.signal).then(apply).catch((e) => !isAbort(e) && setErr((e as Error).message));
    return () => c.abort();
  }, [backend, apply]);

  async function save(patch: Partial<LlmConfig>, message: string) {
    setBusy(true);
    try {
      apply(await backend.setLlm(patch));
      toast(message);
      refreshStatus();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      // Save an edited address first so the test checks what's typed.
      const i = draft && info && draft.host !== info.config.host ? await backend.setLlm({ host: draft.host }) : await backend.llm(true);
      setInfo(i);
      setDraft((d) => (d ? { ...d, host: i.config.host } : d));
      toast(i.up ? `Connected. ${plural(i.installed.length, "local model")} found.` : `Can't reach Ollama at ${i.config.host}.`, i.up ? undefined : "err");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setTesting(false);
    }
  }

  const set = <K extends keyof LlmConfig>(k: K, v: LlmConfig[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  if (err && !info) {
    return (
      <section className="card stack gap-3" aria-labelledby="llm-h">
        <h2 id="llm-h" className="card-title">Local LLM</h2>
        <Notice tone="err">Local LLM settings unavailable: {err}</Notice>
      </section>
    );
  }
  if (!info || !draft) {
    return (
      <section className="card stack gap-3" aria-labelledby="llm-h">
        <h2 id="llm-h" className="card-title">Local LLM</h2>
        <Skeleton h={220} />
      </section>
    );
  }

  const dirty = !same(draft, info.config);
  const have = new Set(info.downloaded.map((d) => d.name));
  const missing = [...new Set([draft.chat_model, draft.vision_model])].filter((m) => m && !hasModel(have, m));
  const toDownload = info.recommended.filter((r) => missing.includes(r.name));
  const unknownMissing = missing.filter((m) => !toDownload.some((r) => r.name === m));
  const embedRec = info.embed_installed ? undefined : info.recommended.find((r) => r.uses.includes("embed") && !r.installed);
  const localCount = info.downloaded.filter((d) => !d.embed).length;

  return (
    <section className="card stack gap-4" aria-labelledby="llm-h">
      <div className="row wrap gap-3" style={{ justifyContent: "space-between" }}>
        <h2 id="llm-h" className="card-title">Local LLM</h2>
        <span className={`llm-dot${info.up ? " is-up" : ""}`} role="status">
          {info.up ? "Ollama connected" : "Ollama not reachable"}
        </span>
      </div>

      <form
        className="stack gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && toDownload.length === 0) save(draft, "Local LLM settings saved.");
        }}
      >
        <div className="field">
          <label htmlFor="llm-host">Ollama address</label>
          <div className="row gap-2">
            <input id="llm-host" className="input grow mono" value={draft.host} onChange={(e) => set("host", e.target.value)} spellCheck={false} autoComplete="off" />
            <button type="button" className="btn btn-line" onClick={test} disabled={testing || busy}>
              <Icon name="refresh" size={16} /> {testing ? "Testing…" : "Test"}
            </button>
          </div>
          {!isLoopback(draft.host) && (
            <Notice tone="warn">This address is not on this computer. File contents you ask about will be sent to it.</Notice>
          )}
        </div>

        <p className="subtle" style={{ fontSize: 13, margin: 0 }}>
          {plural(localCount, "model")} on this laptop{info.ram_gb !== null && ` · ${info.ram_gb} GB memory`}
          {!info.up && localCount > 0 && " · start Ollama to use them"}
        </p>

        <div className="llm-fields">
          <ModelSelect
            id="llm-chat"
            label="Answer model"
            use="answer"
            info={info}
            value={draft.chat_model}
            autoLabel={`Automatic${info.config.chat_model === "" && info.chat_model ? ` (${info.chat_model})` : ""}`}
            onChange={(v) => set("chat_model", v)}
          />
          <ModelSelect
            id="llm-vision"
            label="Image model"
            use="image"
            info={info}
            value={draft.vision_model}
            autoLabel={`Automatic${info.config.vision_model === "" && info.vision_model ? ` (${info.vision_model})` : ""}`}
            onChange={(v) => set("vision_model", v)}
          />
          <div className="field">
            <label htmlFor="llm-ctx">Context window</label>
            <select id="llm-ctx" className="input" value={draft.num_ctx} onChange={(e) => set("num_ctx", Number(e.target.value))}>
              {CONTEXTS.map((n) => (
                <option key={n} value={n}>{`${n / 1024}K tokens`}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="llm-keep">Keep model loaded</label>
            <select id="llm-keep" className="input" value={draft.keep_alive} onChange={(e) => set("keep_alive", e.target.value)}>
              {!KEEP_ALIVE.some((k) => k.id === draft.keep_alive) && <option value={draft.keep_alive}>{draft.keep_alive}</option>}
              {KEEP_ALIVE.map((k) => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </select>
          </div>
        </div>

        {toDownload.map((r) => (
          <DownloadRow key={r.name} rec={r} info={info} onPull={pull} />
        ))}
        {unknownMissing.length > 0 && (
          <Notice tone="warn">
            Not on this laptop: {unknownMissing.join(", ")}. Run <code>ollama pull {unknownMissing[0]}</code> or pick another model.
          </Notice>
        )}
        {embedRec && <DownloadRow rec={embedRec} info={info} onPull={pull} />}

        <dl className="kv">
          <div>
            <dt>Embedding model</dt>
            <dd className="mono" style={{ fontSize: 13 }}>{info.embed_model}{info.embed_installed ? "" : " (not installed)"}</dd>
          </div>
        </dl>
        <p className="subtle" style={{ fontSize: 13, margin: 0 }}>
          Larger context windows read more of each file but use more memory. Automatic picks the first installed of {info.auto_order.join(", ")}.
        </p>

        <div className="row wrap gap-2">
          <button className="btn btn-primary" type="submit" disabled={!dirty || busy || toDownload.length > 0} title={toDownload.length > 0 ? "Download the chosen model first" : undefined}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={!dirty || busy} onClick={() => setDraft({ ...info.config })}>
            Discard changes
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy || same(info.config, info.defaults)} onClick={() => save(info.defaults, "Local LLM settings reset to defaults.")}>
            Reset to defaults
          </button>
        </div>
      </form>
    </section>
  );
}
