import { useCallback, useEffect, useState } from "react";
import { Notice, Skeleton, useToast } from "../../components/feedback/Feedback";
import { Icon } from "../../components/Icon";
import { useStatus } from "../../hooks/StatusContext";
import { useBackend } from "../../services/BackendContext";
import { isAbort } from "../../services/apiClient";
import { plural } from "../../services/normalize";
import type { LlmConfig, LlmInfo } from "../../services/types";

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

/** Options for a model picker; keeps a saved model listed even if it was uninstalled. */
function modelOptions(installed: string[], current: string): string[] {
  return current && !installed.includes(current) ? [current, ...installed] : installed;
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
  const pinnedMissing = [draft.chat_model, draft.vision_model].filter((m) => m && !info.installed.includes(m));

  return (
    <section className="card stack gap-4" aria-labelledby="llm-h">
      <div className="setting-row">
        <h2 id="llm-h" className="card-title">Local LLM</h2>
        <span className={`llm-dot${info.up ? " is-up" : ""}`} role="status">
          {info.up ? "Ollama connected" : "Ollama not reachable"}
        </span>
      </div>

      <form
        className="stack gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save(draft, "Local LLM settings saved.");
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

        <div className="llm-fields">
          <div className="field">
            <label htmlFor="llm-chat">Answer model</label>
            <select id="llm-chat" className="input" value={draft.chat_model} onChange={(e) => set("chat_model", e.target.value)}>
              <option value="">Automatic{info.config.chat_model === "" && info.chat_model ? ` (${info.chat_model})` : ""}</option>
              {modelOptions(info.installed, draft.chat_model).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="llm-vision">Image model</label>
            <select id="llm-vision" className="input" value={draft.vision_model} onChange={(e) => set("vision_model", e.target.value)}>
              <option value="">Automatic{info.config.vision_model === "" && info.vision_model ? ` (${info.vision_model})` : ""}</option>
              {modelOptions(info.installed, draft.vision_model).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
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

        {pinnedMissing.length > 0 && (
          <Notice tone="warn">
            Not installed in Ollama: {pinnedMissing.join(", ")}. Run <code>ollama pull {pinnedMissing[0]}</code> or pick another model.
          </Notice>
        )}
        {info.up && info.installed.length === 0 && (
          <Notice tone="warn">No local models installed. Run <code>ollama pull {info.auto_order[0] ?? "gemma4:e4b"}</code>.</Notice>
        )}

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
          <button className="btn btn-primary" type="submit" disabled={!dirty || busy}>
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
