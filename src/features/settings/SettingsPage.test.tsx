import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../App";
import { PREFS_KEY } from "../../prefs/preferences";
import { fakeBackend } from "../../test/fakeBackend";

const stored = () => JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");

describe("Settings: Iris customization", () => {
  beforeEach(() => {
    window.location.hash = "#/settings";
    delete document.documentElement.dataset.theme;
  });

  it("has no Appearance section; the top-bar toggle still switches and saves the theme", async () => {
    render(<App backend={fakeBackend()} startup={false} />);
    expect(screen.queryByRole("heading", { name: "Appearance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Theme" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(stored().theme).toBe("light");
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

describe("Settings: local LLM", () => {
  beforeEach(() => {
    window.location.hash = "#/settings";
  });

  it("saves only changed settings and warns about a non-local address", async () => {
    const backend = fakeBackend();
    render(<App backend={backend} startup={false} />);
    const section = (await screen.findByLabelText("Answer model")).closest("section")!;
    const save = within(section).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await userEvent.selectOptions(within(section).getByLabelText("Answer model"), "big:8b");
    await userEvent.selectOptions(within(section).getByLabelText("Context window"), "16384");
    await userEvent.click(save);
    expect(backend.setLlm).toHaveBeenCalledWith(expect.objectContaining({ chat_model: "big:8b", num_ctx: 16384 }));
    await waitFor(() => expect(save).toBeDisabled());

    const host = within(section).getByLabelText("Ollama address");
    await userEvent.clear(host);
    await userEvent.type(host, "http://192.168.1.5:11434");
    expect(within(section).getByText(/not on this computer/)).toBeInTheDocument();
  });

  it("groups models on this laptop and recommended ones, and downloads a recommended pick before saving", async () => {
    const backend = fakeBackend();
    render(<App backend={backend} startup={false} />);
    const picker = await screen.findByLabelText("Answer model");
    const section = picker.closest("section")!;
    const groups = within(picker).getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("label"))).toEqual(["On this laptop", "Recommended to download"]);
    expect(within(groups[0]).getByRole("option", { name: /big:8b · 5.2 GB/ })).toBeInTheDocument();
    expect(within(groups[1]).getByRole("option", { name: /Rec 4B · 2.5 GB download/ })).toBeInTheDocument();

    await userEvent.selectOptions(picker, "rec:4b");
    expect(within(section).getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.click(within(section).getByRole("button", { name: /Download/ }));
    expect(backend.pullLlm).toHaveBeenCalledWith("rec:4b");
  });
});
