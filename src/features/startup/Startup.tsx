/*
  Branded startup: the aurora glows up, the hyphen opens and the letters
  unmask, the tagline and Iris rise, then it dissolves into the workspace.
  About 3.4 s, once per session, skippable (with a short fade), never shown
  with motion off.
*/
import { useEffect, useState } from "react";
import { MatahWordmark } from "../../branding/MatahLogo";
import { Iris } from "../../mascot/Iris";
import { usePrefs } from "../../prefs/PrefsContext";

const KEY = "matah.startup.seen";
const DURATION = 3400; // keep in step with .startup's exit in components.css
const SKIP_FADE = 320;

function seen(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function Startup() {
  const { motion, prefs } = usePrefs();
  const [show, setShow] = useState(() => motion !== "none" && !seen());
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setShow(false), DURATION);
    const skip = () => setLeaving(true);
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", skip);
    };
  }, [show]);

  // Skipping fades out quickly instead of cutting.
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setShow(false), SKIP_FADE);
    return () => window.clearTimeout(t);
  }, [leaving]);

  if (!show) return null;
  return (
    <div className={`startup${leaving ? " is-leaving" : ""}`} role="presentation" onClick={() => setLeaving(true)}>
      <span className="startup-glow" aria-hidden="true" />
      <button className="startup-skip" onClick={() => setLeaving(true)}>
        Skip
      </button>
      <MatahWordmark height={96} animate className="startup-wordmark" style={{ color: "#F6F3EF", maxWidth: "86vw", height: "auto" }} />
      <div className="startup-tag">
        <p className="startup-line">Remember what it was, not where you saved it.</p>
        {prefs.iris.visible && (
          <span className="startup-iris">
            <Iris preset={prefs.iris.preset} accessory={prefs.iris.accessory} size={56} theme="dark" state="idle" />
          </span>
        )}
      </div>
    </div>
  );
}
