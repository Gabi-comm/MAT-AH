/*
  Branded startup (board 06, "Startup variant"): the hyphen opens and the
  letters unmask, Iris peeks, then the workspace is already there underneath.
  About 1.2 s, once per session, skippable, never shown with motion off.
*/
import { useEffect, useState } from "react";
import { MatahWordmark } from "../../branding/MatahLogo";
import { Iris } from "../../mascot/Iris";
import { usePrefs } from "../../prefs/PrefsContext";

const KEY = "matah.startup.seen";

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

  useEffect(() => {
    if (!show) return;
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setShow(false), 1420);
    const skip = () => setShow(false);
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", skip);
    };
  }, [show]);

  if (!show) return null;
  return (
    <div className="startup" role="presentation" onClick={() => setShow(false)}>
      <button className="startup-skip" onClick={() => setShow(false)}>
        Skip
      </button>
      <MatahWordmark height={96} animate style={{ color: "#F6F3EF", maxWidth: "86vw", height: "auto" }} />
      <div className="row gap-4" style={{ alignItems: "flex-end" }}>
        <p className="startup-line">Found it!</p>
        {prefs.iris.visible && (
          <span style={{ animation: "rise 1100ms var(--ease-settle) both" }}>
            <Iris preset={prefs.iris.preset} accessory={prefs.iris.accessory} size={56} theme="dark" state="idle" />
          </span>
        )}
      </div>
    </div>
  );
}
