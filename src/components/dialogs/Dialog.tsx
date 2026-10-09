/*
  Accessible modal surface used for approvals (dialog) and file preview
  (drawer). Esc closes, focus is trapped inside and restored on close, the
  page behind is inert to the pointer via the scrim.
*/
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  variant?: "dialog" | "drawer";
  /** alertdialog for approval moments. */
  role?: "dialog" | "alertdialog";
  /** Element to focus first (defaults to the first focusable). */
  initialFocus?: React.RefObject<HTMLElement | null>;
  headerExtra?: ReactNode;
  describedBy?: string;
}

export function Dialog({ open, onClose, title, children, variant = "dialog", role = "dialog", initialFocus, headerExtra, describedBy }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = initialFocus?.current ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [open, initialFocus]);

  if (!open) return null;
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className={variant} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={describedBy}>
        {variant === "drawer" ? (
          <>
            <div className="drawer-head">
              <h2 id={titleId} className="grow truncate" style={{ fontSize: 18, fontFamily: "var(--font-ui)" }}>
                {title}
              </h2>
              {headerExtra}
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="drawer-body">{children}</div>
          </>
        ) : (
          <>
            <h2 id={titleId} style={{ fontSize: 22 }}>
              {title}
            </h2>
            {children}
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
