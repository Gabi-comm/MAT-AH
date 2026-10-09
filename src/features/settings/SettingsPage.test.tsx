import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../App";
import { PREFS_KEY } from "../../prefs/preferences";
import { fakeBackend } from "../../test/fakeBackend";

const stored = () => JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");

describe("Settings: theme, motion and Iris customization", () => {
  beforeEach(() => {
    window.location.hash = "#/settings";
    delete document.documentElement.dataset.theme;
  });

  it("switches theme and persists it", async () => {
    render(<App backend={fakeBackend()} startup={false} />);
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    await userEvent.click(within(group).getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(stored().theme).toBe("dark");
    await userEvent.click(within(group).getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(stored().theme).toBe("light");
  });

  it("restores the saved theme on next launch", () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: "dark" }));
    render(<App backend={fakeBackend()} startup={false} />);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("has no Animation or Show Iris controls, and an old saved 'off' is ignored", () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ motion: "none", iris: { visible: false } }));
    render(<App backend={fakeBackend()} startup={false} />);
    expect(screen.queryByRole("radiogroup", { name: "Animation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Show Iris" })).not.toBeInTheDocument();
    expect(document.documentElement.dataset.motion).toBe("full");
  });

  it("customizes Iris, saves locally, and resets to the approved default", async () => {
    render(<App backend={fakeBackend()} startup={false} />);
    await userEvent.click(screen.getByRole("button", { name: /Customize Iris/ }));
    const colours = await screen.findByRole("radiogroup", { name: "Iris colour" });
    await userEvent.click(within(colours).getByRole("radio", { name: /Ube Iris/ }));
    await userEvent.click(within(screen.getByRole("radiogroup", { name: "Iris accessory" })).getByRole("radio", { name: /Headphones/ }));
    // Live preview updates before saving; storage does not.
    expect(screen.getByRole("img", { name: /Iris preview, Ube Iris/ })).toBeInTheDocument();
    expect(stored().iris).toBeUndefined();
    await userEvent.click(screen.getByRole("button", { name: "Save Iris" }));
    expect(stored().iris).toMatchObject({ preset: "ube", accessory: "headphones" });

    await userEvent.click(screen.getByRole("button", { name: /Customize Iris/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Reset to default" }));
    await userEvent.click(screen.getByRole("button", { name: "Save Iris" }));
    expect(stored().iris).toMatchObject({ preset: "classic", accessory: "none", expression: "classic" });
  });

  it("preview buttons animate locally without calling the backend", async () => {
    const backend = fakeBackend();
    render(<App backend={backend} startup={false} />);
    await userEvent.click(screen.getByRole("button", { name: /Customize Iris/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Found" }));
    expect(backend.search).not.toHaveBeenCalled();
    expect(backend.ask).not.toHaveBeenCalled();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    await waitFor(() => expect(document.querySelector('.preview-box svg.iris')?.getAttribute("data-state")).toMatch(/found|celebrating/));
  });
});
