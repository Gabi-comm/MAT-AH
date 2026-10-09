import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { fakeBackend } from "../../test/fakeBackend";

describe("first-run consent", () => {
  it("asks before reading when no folders are authorized, then adds the computer and starts indexing", async () => {
    const progress = { running: true, total: 0, done: 0, current: "", errors: [], started: 1, finished: 0, embedded: 0, embed_skipped: false, phase: "listing" as const, listed: 0 };
    const backend = fakeBackend({
      roots: vi.fn(async () => []),
      addComputer: vi.fn(async () => ({ added: [{ id: 1, path: "C:\\Users\\T", added_at: "x" }] })),
      startIndex: vi.fn(async () => progress),
    });
    window.location.hash = "#/home";
    render(<App backend={backend} startup={false} />);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Nothing is uploaded");
    expect(backend.addComputer).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ok, I allow" })).toHaveFocus());
    await userEvent.click(screen.getByRole("button", { name: "Ok, I allow" }));
    expect(backend.addComputer).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(backend.startIndex).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("is not shown when folders already exist, and can be postponed", async () => {
    const backend = fakeBackend();
    render(<App backend={backend} startup={false} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const empty = fakeBackend({ roots: vi.fn(async () => []) });
    render(<App backend={empty} startup={false} />);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(empty.addComputer).not.toHaveBeenCalled();
  });
});
