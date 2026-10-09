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
type PreviewKey = "idle" | "searching" | "found" | "thinking";

const PREVIEWS: { id: PreviewKey; label: string }[] = [
  { id: "idle", label: "Idle" },
  { id: "searching", label: "Searching" },
  { id: "found", label: "Found" },
  { id: "thinking", label: "Thinking" },
];

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
      timers.current.push(window.setTimeout(() => setPreview("idle"), 2000));
    } else if (k === "searching") {
      setPreview("searching");
      timers.current.push(window.setTimeout(() => setPreview("idle"), 4000));
    } else if (k === "thinking") {
      setPreview("thinking");
      timers.current.push(window.setTimeout(() => setPreview("idle"), 3000));
    } else setPreview("idle");
  }

  const set = (c: Partial<Draft>) => setDraft((d) => ({ ...d, ...c }));
  const active = (k: PreviewKey) => (k === "found" ? preview === "found" || preview === "celebrating" : preview === k);
  const name = IRIS_PRESETS.find((p) => p.id === draft.preset)?.name;

  return (
    <section className="iris-customize" aria-label="Customize Iris">
      <div className="iris-customize-preview stack gap-3">
      <div className="preview-box">
        <div className="preview-floor" aria-hidden="true" />
        <Iris
          preset={draft.preset}
          accessory={draft.accessory}
          expression={draft.expression}
          state={preview}
          boil={motion === "full"}
          size={110}
          theme="dark"
          label={`Iris preview, ${name}`}
        />
      </div>
      <div className="row wrap gap-2" role="group" aria-label="Preview animation">
        {PREVIEWS.map((p) => (
          <button key={p.id} className="chip chip-sm" aria-pressed={active(p.id)} onClick={() => play(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      </div>

      <div className="iris-customize-options stack gap-5">
      <fieldset className="stack gap-3">
        <legend className="card-title" style={{ marginBottom: 10 }}>Colour</legend>
        <div className="swatches" role="radiogroup" aria-label="Iris colour">
          {IRIS_PRESETS.map((p) => (
            <button key={p.id} className="swatch" role="radio" aria-checked={draft.preset === p.id} onClick={() => set({ preset: p.id })}>
              <Iris preset={p.id} size={38} theme={resolvedTheme} state="idle" />
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
              <Iris preset={draft.preset} accessory={a} size={38} theme={resolvedTheme} state="idle" />
              {ACCESSORY_LABELS[a]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="stack gap-3">
        <legend className="card-title" style={{ marginBottom: 10 }}>Idle expression</legend>
        <div className="swatches" role="radiogroup" aria-label="Iris expression">
          {(Object.keys(EXPRESSION_LABELS) as IrisExpression[]).map((x) => (
            <button key={x} className="swatch" role="radio" aria-checked={draft.expression === x} onClick={() => set({ expression: x })}>
              <Iris preset={draft.preset} accessory={draft.accessory} expression={x} size={38} theme={resolvedTheme} state="idle" />
              {EXPRESSION_LABELS[x]}
            </button>
          ))}
        </div>
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
            Discard
          </button>
        )}
        {dirty && <span className="subtle" role="status" style={{ fontSize: 13 }}>Unsaved changes</span>}
      </div>
      </div>
    </section>
  );
}
