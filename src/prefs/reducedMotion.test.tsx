import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { PREFS_KEY } from "./preferences";
import { fakeBackend } from "../test/fakeBackend";

describe("system reduced motion", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  function mockReduce(on: boolean) {
    window.matchMedia = vi.fn((q: string) => ({
      matches: on && q.includes("reduce"), media: q, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  it("turns decorative motion off and skips the startup reveal", () => {
    mockReduce(true);
    window.location.hash = "#/home";
    render(<App backend={fakeBackend()} />);
    expect(document.documentElement.dataset.motion).toBe("none");
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
  });

  it("can be overridden when the user stops following the system", () => {
    mockReduce(true);
    localStorage.setItem(PREFS_KEY, JSON.stringify({ followSystemMotion: false }));
    render(<App backend={fakeBackend()} startup={false} />);
    expect(document.documentElement.dataset.motion).toBe("full");
  });

  it("shows the branded startup once per session when motion is on", () => {
    mockReduce(false);
    render(<App backend={fakeBackend()} />);
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    expect(sessionStorage.getItem("matah.startup.seen")).toBe("1");
  });
});
