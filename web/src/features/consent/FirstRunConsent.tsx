/*
  First run: ask before reading anything (ported from the team's ConsentModal,
  commit 8a4d6e4). Shown when the backend reports no authorized folders.
  "Ok, I allow" adds the user folder and other non-system drives
  (POST /api/roots/computer) and starts indexing. Choosing specific folders
  in Settings stays available.
*/
import { useCallback, useEffect, useRef, useState } from "react";
import { MatahSymbol } from "../../branding/MatahLogo";
import { Dialog } from "../../components/dialogs/Dialog";
import { InlineIris, Notice } from "../../components/feedback/Feedback";
import { useStatus } from "../../hooks/StatusContext";
import { hrefFor } from "../../hooks/useRoute";
import { useBackend } from "../../services/BackendContext";
import { isAbort } from "../../services/apiClient";

const DISMISS_KEY = "matah.consent.later";

function dismissedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function FirstRunConsent() {
  const backend = useBackend();
  const { startIndex, refresh } = useStatus();
  const [needed, setNeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const allowRef = useRef<HTMLButtonElement>(null);

  const check = useCallback(
    (signal?: AbortSignal) =>
      backend
        .roots(signal)
        .then((r) => setNeeded(r.length === 0 && !dismissedThisSession()))
        .catch((e) => {
          if (!isAbort(e)) setNeeded(false); // backend unreachable: other screens explain that
        }),
    [backend],
  );

  useEffect(() => {
    const c = new AbortController();
    check(c.signal);
    return () => c.abort();
  }, [check]);

  async function allow() {
    setBusy(true);
    setErr(null);
    try {
      await backend.addComputer();
      await startIndex();
      refresh();
      setNeeded(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function later() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setNeeded(false);
  }

  return (
    <Dialog open={needed} onClose={later} title="Babasahin ko ang mga file mo para mahanap mo sila mamaya." initialFocus={allowRef} describedBy="consent-body">
      <div className="row gap-4" style={{ alignItems: "flex-end" }}>
        <MatahSymbol size={44} />
        <InlineIris state="curious" size={56} />
      </div>
      <p id="consent-body" className="muted">
        MAT-AH will go through the files in your user folder: documents, PDFs, slides, spreadsheets, the words in your screenshots and photos,
        and what is seen and said in your videos. Then you can ask for any of them in your own words, in English, Filipino or Taglish.
      </p>
      <ul className="stack gap-2" style={{ margin: 0, paddingLeft: 20, fontSize: 15 }}>
        <li>Everything stays on this computer. Nothing is uploaded, and it works with Wi-Fi off.</li>
        <li>It skips system folders, app data and code dependencies.</li>
        <li>It only reads. Nothing is moved or deleted unless you say yes in Kilos.</li>
        <li>You can pause reading at any time in Settings.</li>
      </ul>
      {err && <Notice tone="err">{err}</Notice>}
      <div className="row wrap gap-3" style={{ justifyContent: "flex-end" }}>
        <a className="btn btn-ghost" href={hrefFor("settings")} onClick={later}>
          Choose folders instead
        </a>
        <button ref={allowRef} className="btn btn-primary" onClick={allow} disabled={busy}>
          {busy ? "Sinisimulan…" : "Ok, I allow"}
        </button>
      </div>
    </Dialog>
  );
}
