import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { usePrefs } from "../../prefs/PrefsContext";
import { Iris } from "../../mascot/Iris";
import type { IrisState } from "../../mascot/iris.types";
import { ApiError } from "../../services/apiClient";
import { Icon } from "../Icon";

export function Skeleton({ h = 16, w = "100%", r }: { h?: number | string; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

/** Determinate when total > 0, otherwise indeterminate. Never invents a percentage. */
export function Progress({ done, total, label }: { done?: number; total?: number; label: string }) {
  const determinate = typeof done === "number" && typeof total === "number" && total > 0;
  const pct = determinate ? Math.min(100, Math.round((done! / total!) * 100)) : undefined;
  return (
    <div
      className={`progress${determinate ? "" : " indeterminate"}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={pct}
    >
      <span style={determinate ? { width: `${pct}%` } : undefined} />
    </div>
  );
}

/** Small Iris for inline states. Uses the viewer's Iris customization. */
export function InlineIris({ state, size = 72 }: { state: IrisState; size?: number }) {
  const { prefs, resolvedTheme } = usePrefs();
  if (!prefs.iris.visible) return null;
  return (
    <Iris
      state={state}
      size={size}
      preset={prefs.iris.preset}
      accessory={prefs.iris.accessory}
      expression={prefs.iris.expression}
      theme={resolvedTheme}
    />
  );
}

export function EmptyState({
  title,
  body,
  iris = "no-results",
  children,
}: {
  title: string;
  body?: ReactNode;
  iris?: IrisState;
  children?: ReactNode;
}) {
  return (
    <div className="empty reveal">
      <InlineIris state={iris} />
      <h2 style={{ fontSize: 24 }}>{title}</h2>
      {body && <p>{body}</p>}
      {children && <div className="row wrap gap-3" style={{ justifyContent: "center" }}>{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "May hindi gumana. Subukan ulit natin." }: { error: Error | null; onRetry?: () => void; title?: string }) {
  const status = error instanceof ApiError ? error.status : undefined;
  const friendly =
    status === 0
      ? "Hindi maabot ang MAT-AH backend sa computer na ito. Start it, then try again."
      : status === 403
        ? "That file is outside your authorized folders."
        : status === 410
          ? "Wala na ang file sa dating lugar. Re-index from Settings."
          : status && status >= 500
            ? "The backend hit a problem while working on this."
            : error?.message;
  return (
    <div className="empty reveal" role="alert">
      <InlineIris state="error" />
      <h2 style={{ fontSize: 22 }}>{title}</h2>
      {friendly && <p>{friendly}</p>}
      {onRetry && (
        <button className="btn btn-line" onClick={onRetry}>
          <Icon name="refresh" /> Subukan ulit
        </button>
      )}
      {error && (
        <details className="tech">
          <summary>Technical details</summary>
          <pre>{`${status !== undefined ? `HTTP ${status}: ` : ""}${error.message}`}</pre>
        </details>
      )}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "err" | "ok"; children: ReactNode }) {
  const icon = tone === "ok" ? "check" : tone === "err" ? "alert" : "info";
  const cls = tone === "info" ? "notice" : `notice ${tone}`;
  return (
    <div className={cls}>
      <Icon name={icon} className={tone === "ok" ? "ok-ic" : tone === "err" ? "err-ic" : "warn-ic"} />
      <div>{children}</div>
    </div>
  );
}

/* ---------- Toasts ---------- */

interface Toast {
  id: number;
  text: string;
  tone: "ok" | "err";
}

type PushToast = (text: string, tone?: "ok" | "err") => void;
const ToastCtx = createContext<PushToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback<PushToast>((text, tone = "ok") => {
    const id = ++n.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <Icon name={t.tone === "ok" ? "check" : "alert"} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
