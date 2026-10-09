import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import type { AskResponse } from "../../services/types";
import { fakeBackend, file } from "../../test/fakeBackend";

const base = { timings: {}, model: "m", search_mode: "hybrid" };
const src = (n: number, name: string, snippet: string) => ({ n, file: file(n, name, "pdf"), locator: { page: 2 }, chunk_id: n, snippet, highlight: [] });

describe("Sagot", () => {
  beforeEach(() => {
    window.location.hash = `#/sagot?q=${encodeURIComponent("Kailan ang deadline?")}`;
  });

  it("renders a grounded answer with clickable citations that spotlight evidence", async () => {
    const res: AskResponse = { ...base, question: "q", status: "grounded", answer: "Ang deadline ay October 24, 2026 [1]. Late fee ₱500.00 [2].", cited: [1, 2],
      sources: [src(1, "Announcement.pdf", "last day is October 24, 2026"), src(2, "Announcement.pdf", "fee of ₱500.00")] };
    render(<App backend={fakeBackend({ ask: vi.fn(async () => res) })} startup={false} />);
    expect(await screen.findByRole("article", { name: "Answer" })).toHaveTextContent("October 24, 2026");
    const c2 = screen.getByRole("button", { name: "Show source 2" });
    await userEvent.click(c2);
    expect(c2).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { pressed: true, name: /\[2\].*fee of ₱500/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open source at page 2" })).toBeInTheDocument();
  });

  it("insufficient evidence shows no generated answer", async () => {
    const res: AskResponse = { ...base, question: "q", status: "insufficient", answer: null, message: "Kulang ang ebidensya.", sources: [src(1, "Near.pdf", "close")] };
    render(<App backend={fakeBackend({ ask: vi.fn(async () => res) })} startup={false} />);
    expect(await screen.findByText("Kulang ang ebidensya.", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Answer" })).not.toBeInTheDocument();
    expect(screen.getByText(/Closest sources/)).toBeInTheDocument();
  });

  it("offline model is stated plainly", async () => {
    const res: AskResponse = { ...base, question: "q", status: "offline", answer: null, message: "Local AI is not running.", sources: [] };
    render(<App backend={fakeBackend({ ask: vi.fn(async () => res) })} startup={false} />);
    expect(await screen.findByText("Offline ang local AI.", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByTestId("iris-companion")).toHaveAttribute("data-iris-state", "unavailable");
  });
});
