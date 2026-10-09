import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_PREFS,
  effectiveMotion,
  loadPrefs,
  savePrefs,
  type MotionPref,
  type Preferences,
} from "./preferences";

interface PrefsValue {
  prefs: Preferences;
  /** Merge a change and persist it. */
  update: (change: Partial<Omit<Preferences, "iris">> & { iris?: Partial<Preferences["iris"]> }) => void;
  resetIris: () => void;
  resolvedTheme: "light" | "dark";
  motion: MotionPref;
  systemReducedMotion: boolean;
}

const Ctx = createContext<PrefsValue | null>(null);

function media(q: string): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(q) : null;
}

function useMedia(q: string): boolean {
  const [m, setM] = useState(() => media(q)?.matches ?? false);
  useEffect(() => {
    const mq = media(q);
    if (!mq) return;
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [q]);
  return m;
}

export function PrefsProvider({ children, initial }: { children: ReactNode; initial?: Preferences }) {
  const [prefs, setPrefs] = useState<Preferences>(() => initial ?? loadPrefs());
  const systemDark = useMedia("(prefers-color-scheme: dark)");
  const systemReducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const resolvedTheme = prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;
  const motion = effectiveMotion(prefs, systemReducedMotion);
  const firstTheme = useRef(true);

  // Apply theme. Animate the colour change only after first paint and only with motion on.
  useEffect(() => {
    const root = document.documentElement;
    // The top-bar toggle runs its own circular reveal; a colour fade on top would blur its snapshot.
    if (!firstTheme.current && motion !== "none" && !root.classList.contains("theme-vt")) {
      root.classList.add("theme-transition");
      const t = window.setTimeout(() => root.classList.remove("theme-transition"), 400);
      root.dataset.theme = resolvedTheme;
      return () => window.clearTimeout(t);
    }
    firstTheme.current = false;
    root.dataset.theme = resolvedTheme;
  }, [resolvedTheme, motion]);

  useEffect(() => {
    document.documentElement.dataset.motion = motion;
  }, [motion]);

  // Pause decorative animation while the window is hidden.
  useEffect(() => {
    const on = () => document.documentElement.classList.toggle("is-hidden", document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const update = useCallback<PrefsValue["update"]>((change) => {
    setPrefs((p) => {
      const next: Preferences = { ...p, ...change, iris: { ...p.iris, ...(change.iris ?? {}) } };
      savePrefs(next);
      return next;
    });
  }, []);

  const resetIris = useCallback(() => {
    setPrefs((p) => {
      const next = { ...p, iris: { ...DEFAULT_PREFS.iris } };
      savePrefs(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ prefs, update, resetIris, resolvedTheme, motion, systemReducedMotion }),
    [prefs, update, resetIris, resolvedTheme, motion, systemReducedMotion],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return v;
}
