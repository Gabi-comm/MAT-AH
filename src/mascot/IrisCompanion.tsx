/*
  Iris as she appears in the workspace header. Her speech bubble is
  decorative (aria-hidden): every status she reacts to is also stated in
  text by the page itself, so nothing depends on seeing her.
*/
import { usePrefs } from "../prefs/PrefsContext";
import { Iris } from "./Iris";
import { useIris } from "./IrisContext";
import type { IrisState } from "./iris.types";

const LINES: Partial<Record<IrisState, string>> = {
  searching: "Sandali, hinahanap ko…",
  thinking: "Preparing your answer…",
  found: "Ah, kita ko na!",
  celebrating: "Ah, kita ko na!",
  "no-results": "Wala pa akong nakita.",
  planning: "Pinaplano ko…",
  "waiting-for-approval": "Ikaw ang bahala.",
  success: "Ayos na!",
  error: "May hindi gumana.",
  unavailable: "Offline ang local AI.",
};

export function IrisCompanion({ size = 56, showBubble = true }: { size?: number; showBubble?: boolean }) {
  const { prefs, resolvedTheme, motion } = usePrefs();
  const { state, idleAct } = useIris();
  if (!prefs.iris.visible) return null;
  const line = showBubble ? LINES[state] : undefined;
  const found = state === "found" || state === "celebrating";
  return (
    <div className="companion" data-testid="iris-companion" data-iris-state={state}>
      {line && (
        <span key={state} className={`bubble${found ? " found" : ""}`} aria-hidden="true">
          {line}
        </span>
      )}
      <Iris
        state={state}
        size={size}
        preset={prefs.iris.preset}
        accessory={prefs.iris.accessory}
        expression={prefs.iris.expression}
        theme={resolvedTheme}
        idleAct={idleAct}
        boil={motion === "full"}
      />
    </div>
  );
}
