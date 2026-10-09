/*
  Customize Iris. Cosmetic only: colours, one accessory, an idle expression.
  Changes preview live and are saved locally when the user presses Save.
  Preview buttons animate locally and never call the backend.
*/
import { useEffect, useRef, useState } from "react";
import { usePrefs } from "../prefs/PrefsContext";
import { DEFAULT_PREFS, type Preferences } from "../prefs/preferences";
import { Iris } from "./Iris";
import { ACCESSORY_LABELS, EXPRESSION_LABELS, IRIS_PRESETS } from "./irisPresets";
import type { IrisAccessory, IrisExpression, IrisState } from "./iris.types";

type Draft = Preferences["iris"];
type PreviewKey = "idle" | "found" | "thinking";

export default function IrisCustomization({ onDone }: { onDone?: () => void }) {
  const { prefs, update, resolvedTheme, motion } = usePrefs();
  const [draft, setDraft] = useState<Draft>(prefs.iris);
  const [preview, setPreview] = useState<IrisState>("idle");
  const timers = useRef<number[]>([]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(prefs.iris);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function play(k: PreviewKey) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (k === "found") {
      setPreview("found");
      if (motion !== "none") timers.current.push(window.setTimeout(() => setPreview("celebrating"), 160));
      timers.current.push(window.setTimeout(() => setPreview("idle"), 1250));
    } else if (k === "thinking") {
      setPreview("thinking");
      timers.current.push(window.setTimeout(() => setPreview("idle"), 3000));
    } else setPreview("idle");
  }

  const set = (c: Partial<Draft>) => setDraft((d) => ({ ...d, ...c }));
  const irisProps = { preset: draft.preset, accessory: draft.accessory, expression: draft.expression, state: preview, boil: motion === "full" } as const;

  return (
    <section className="stack gap-5" aria-label="Customize Iris">
      <div className="grid-auto-wide" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}>
        <div className="preview-box" aria-label="Preview on light">
          <div className="preview-floor" aria-hidden="true" />
          <Iris {...irisProps} size={120} theme="light" label={`Iris preview, ${IRIS_PRESETS.find((p) => p.id === draft.preset)?.name}, light theme`} />
        </div>
        <div className="preview-box on-dark" aria-label="Preview on dark">
          <div className="preview-floor" style={{ borderColor: "#463c66" }} aria-hidden="true" />
          <Iris {...irisProps} size={120} theme="dark" />
        </div>
      </div>
      <div className="row wrap gap-2" role="group" aria-label="Preview animation">
        <span className="subtle" style={{ fontSize: 13 }}>Preview:</span>
        <button className="chip chip-sm" aria-pressed={preview === "idle"} onClick={() => play("idle")}>Idle</button>
        <button className="chip chip-sm" aria-pressed={preview === "found" || preview === "celebrating"} onClick={() => play("found")}>Ah, kita ko na!</button>
        <button className="chip chip-sm" aria-pressed={preview === "thinking"} onClick={() => play("thinking")}>Thinking</button>
      </div>

      <fieldset className="stack gap-3">
        <legend className="card-title" style={{ marginBottom: 10 }}>Kulay · colour</legend>
        <div className="swatches" role="radiogroup" aria-label="Iris colour">
          {IRIS_PRESETS.map((p) => (
            <button key={p.id} className="swatch" role="radio" aria-checked={draft.preset === p.id} onClick={() => set({ preset: p.id })}>
              <Iris preset={p.id} size={40} theme={resolvedTheme} state="idle" />
              {p.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="stack gap-3">
        <legend className="card-title" style={{ marginBottom: 10 }}>Accessory</legend>
        <div className="swatches" role="radiogroup" aria-label="Iris accessory">
          {(Object.keys(ACCESSORY_LABELS) as IrisAccessory[]).map((a) => (
            <button key={a} className="swatch" role="radio" aria-checked={draft.accessory === a} onClick={() => set({ accessory: a })}>
              <Iris preset={draft.preset} accessory={a} size={40} theme={resolvedTheme} state="idle" />
              {ACCESSORY_LABELS[a]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="stack gap-3">
        <legend className="card-title" style={{ marginBottom: 10 }}>Expression when idle</legend>
        <div className="swatches" role="radiogroup" aria-label="Iris expression">
          {(Object.keys(EXPRESSION_LABELS) as IrisExpression[]).map((x) => (
            <button key={x} className="swatch" role="radio" aria-checked={draft.expression === x} onClick={() => set({ expression: x })}>
              <Iris preset={draft.preset} accessory={draft.accessory} expression={x} size={40} theme={resolvedTheme} state="idle" />
              {EXPRESSION_LABELS[x]}
            </button>
          ))}
        </div>
        <p className="subtle" style={{ fontSize: 13 }}>Expressions change how Iris looks at rest. Her reactions to searches stay the same.</p>
      </fieldset>

      <div className="row wrap gap-3">
        <button className="btn btn-primary" onClick={() => { update({ iris: draft }); onDone?.(); }} disabled={!dirty}>
          Save Iris
        </button>
        <button className="btn btn-line" onClick={() => setDraft({ ...DEFAULT_PREFS.iris, visible: draft.visible })}>
          Reset to default
        </button>
        {dirty && (
          <button className="btn btn-ghost" onClick={() => setDraft(prefs.iris)}>
            Discard changes
          </button>
        )}
        <span className="subtle" role="status" style={{ fontSize: 13 }}>
          {dirty ? "Unsaved changes" : "Saved on this computer"}
        </span>
      </div>
    </section>
  );
}
