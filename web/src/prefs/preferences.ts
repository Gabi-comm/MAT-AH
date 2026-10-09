/*
  Cosmetic, per-device preferences. Stored in localStorage under a
  namespaced, versioned key. Only appearance settings live here: never file
  contents, search history, paths, tokens or anything personal.
*/
import type { IrisAccessory, IrisExpression, IrisPresetId } from "../mascot/iris.types";

export type ThemePref = "light" | "dark" | "system";
export type MotionPref = "full" | "subtle" | "none";

export interface Preferences {
  version: 1;
  theme: ThemePref;
  motion: MotionPref;
  /** When true, the OS "reduce motion" setting turns decorative motion off. */
  followSystemMotion: boolean;
  iris: {
    preset: IrisPresetId;
    accessory: IrisAccessory;
    expression: IrisExpression;
    /** Show Iris in the workspace at all. Status text never depends on her. */
    visible: boolean;
  };
}

export const PREFS_KEY = "matah.prefs.v1";

export const DEFAULT_PREFS: Preferences = {
  version: 1,
  theme: "dark",
  motion: "full",
  followSystemMotion: true,
  iris: { preset: "classic", accessory: "none", expression: "classic", visible: true },
};

const THEMES: ThemePref[] = ["light", "dark", "system"];
const MOTIONS: MotionPref[] = ["full", "subtle", "none"];
const PRESETS: IrisPresetId[] = ["classic", "ube", "mint", "midnight", "peach", "sunshine", "rose"];
const ACCESSORIES: IrisAccessory[] = ["none", "glasses", "headphones", "gradcap", "beanie", "bowtie", "headband", "detective"];
const EXPRESSIONS: IrisExpression[] = ["classic", "cheerful", "curious", "calm"];

function pick<T>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/** Accepts anything (corrupt storage, older shapes) and returns valid prefs. */
export function sanitize(raw: unknown): Preferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const iris = (r.iris && typeof r.iris === "object" ? r.iris : {}) as Record<string, unknown>;
  return {
    version: 1,
    theme: pick(r.theme, THEMES, DEFAULT_PREFS.theme),
    motion: pick(r.motion, MOTIONS, DEFAULT_PREFS.motion),
    followSystemMotion: typeof r.followSystemMotion === "boolean" ? r.followSystemMotion : DEFAULT_PREFS.followSystemMotion,
    iris: {
      preset: pick(iris.preset, PRESETS, DEFAULT_PREFS.iris.preset),
      accessory: pick(iris.accessory, ACCESSORIES, DEFAULT_PREFS.iris.accessory),
      expression: pick(iris.expression, EXPRESSIONS, DEFAULT_PREFS.iris.expression),
      visible: typeof iris.visible === "boolean" ? iris.visible : DEFAULT_PREFS.iris.visible,
    },
  };
}

export function loadPrefs(): Preferences {
  try {
    const s = window.localStorage.getItem(PREFS_KEY);
    return s ? sanitize(JSON.parse(s)) : structuredClone(DEFAULT_PREFS);
  } catch {
    return structuredClone(DEFAULT_PREFS);
  }
}

export function savePrefs(p: Preferences): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(sanitize(p)));
  } catch {
    /* storage unavailable (private window): preferences last for this session only */
  }
}

/** The motion level actually applied, after the OS reduced-motion setting. */
export function effectiveMotion(p: Pick<Preferences, "motion" | "followSystemMotion">, systemReduced: boolean): MotionPref {
  if (p.followSystemMotion && systemReduced) return "none";
  return p.motion;
}
