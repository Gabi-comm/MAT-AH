import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, effectiveMotion, loadPrefs, PREFS_KEY, sanitize, savePrefs } from "./preferences";

describe("preferences", () => {
  it("falls back to defaults for corrupt or unknown values", () => {
    expect(sanitize(null)).toEqual(DEFAULT_PREFS);
    const p = sanitize({ theme: "neon", motion: 3, iris: { preset: "robot", accessory: "glasses" } });
    expect(p.theme).toBe("dark");
    expect(p.motion).toBe("full");
    expect(p.iris.preset).toBe("classic");
    expect(p.iris.accessory).toBe("glasses");
  });

  it("round-trips through a namespaced, versioned key", () => {
    savePrefs({ ...DEFAULT_PREFS, theme: "dark", iris: { ...DEFAULT_PREFS.iris, preset: "ube" } });
    expect(Object.keys(localStorage)).toEqual([PREFS_KEY]);
    const back = loadPrefs();
    expect(back.theme).toBe("dark");
    expect(back.iris.preset).toBe("ube");
  });

  it("stores only cosmetic fields", () => {
    savePrefs({ ...DEFAULT_PREFS, ...({ secret: "token", lastSearch: "my file" } as object) } as typeof DEFAULT_PREFS);
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY)!);
    expect(raw).not.toHaveProperty("secret");
    expect(raw).not.toHaveProperty("lastSearch");
  });

  it("system reduced motion wins when followed", () => {
    expect(effectiveMotion({ motion: "full", followSystemMotion: true }, true)).toBe("none");
    expect(effectiveMotion({ motion: "full", followSystemMotion: false }, true)).toBe("full");
    expect(effectiveMotion({ motion: "subtle", followSystemMotion: true }, false)).toBe("subtle");
  });
});
