import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { ApiError } from "../../services/apiClient";
import type { SearchResponse } from "../../services/types";
import { deferred, fakeBackend, hit, searchResponse } from "../../test/fakeBackend";

const irisState = () => screen.getByTestId("app-shell").getAttribute("data-iris-state");

function go(q: string) {
  window.location.hash = `#/hanap?q=${encodeURIComponent(q)}`;
}

describe("Hanap search lifecycle and Iris", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("successful search with hits: results render at once, Iris finds then celebrates, then idles", async () => {
    const d = deferred<SearchResponse>();
    const backend = fakeBackend({ search: vi.fn(() => d.promise) });
    go("GCash ₱1,500");
    render(<App backend={backend} startup={false} />);
    expect(irisState()).toBe("searching");
    expect(screen.getByRole("search")).toHaveAttribute("aria-busy", "true");

    await act(async () => d.resolve(searchResponse("GCash ₱1,500", [hit(1, "GCash_receipt.jpg"), hit(2, "Other.jpg")])));
    expect(screen.getByRole("article", { name: /GCash_receipt\.jpg, best match/ })).toBeInTheDocument();
    expect(screen.getByText("Best match")).toBeInTheDocument();
    expect(irisState()).toBe("found");
    await waitFor(() => expect(irisState()).toBe("celebrating"));
    await waitFor(() => expect(irisState()).toBe("idle"), { timeout: 2500 });
    // Results stay usable throughout.
    expect(screen.getByRole("button", { name: "Preview GCash_receipt.jpg" })).toBeEnabled();
  });

  it("empty results show no-results and never celebrate", async () => {
    const backend = fakeBackend({ search: vi.fn(async (q: string) => searchResponse(q, [])) });
    go("₱15,000");
    render(<App backend={backend} startup={false} />);
    expect(await screen.findByRole("heading", { name: "Nothing found yet." })).toBeInTheDocument();
    expect(irisState()).toBe("no-results");
    await new Promise((r) => setTimeout(r, 300));
    expect(irisState()).not.toBe("celebrating");
  });

  it("failed request shows the error state and Iris error", async () => {
    const backend = fakeBackend({ search: vi.fn(async () => { throw new ApiError(500, "boom"); }) });
    go("anything");
    render(<App backend={backend} startup={false} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(irisState()).toBe("error");
  });

  it("a stale response cannot override the newer query", async () => {
    const calls: { q: string; d: ReturnType<typeof deferred<SearchResponse>> }[] = [];
    const backend = fakeBackend({
      search: vi.fn((q: string, signal?: AbortSignal) => {
        const d = deferred<SearchResponse>(signal);
        calls.push({ q, d });
        return d.promise;
      }),
    });
    go("first");
    render(<App backend={backend} startup={false} />);
    await waitFor(() => expect(calls.length).toBe(1));
    act(() => go("second"));
    await waitFor(() => expect(calls.length).toBe(2));
    // Old response arrives late with hits: must be ignored.
    await act(async () => calls[0].d.resolve(searchResponse("first", [hit(9, "OLD.jpg")])));
    expect(screen.queryByText("OLD.jpg")).not.toBeInTheDocument();
    expect(irisState()).toBe("searching");
    await act(async () => calls[1].d.resolve(searchResponse("second", [])));
    expect(await screen.findByRole("heading", { name: "Nothing found yet." })).toBeInTheDocument();
    expect(irisState()).toBe("no-results");
  });

  it("cancelling a search returns Iris to idle without celebrating", async () => {
    let signal: AbortSignal | undefined;
    const backend = fakeBackend({ search: vi.fn((_q: string, s?: AbortSignal) => { signal = s; return deferred<SearchResponse>(s).promise; }) });
    go("slow");
    render(<App backend={backend} startup={false} />);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(signal?.aborted).toBe(true);
    expect(irisState()).toBe("idle");
  });
});

describe("Hanap weaker matches", () => {
  it("folds meaning-only hits far below the best into a details section", async () => {
    const strong = [hit(1, "A.jpg"), hit(2, "B.jpg"), hit(3, "C.jpg")].map((h) => ({ ...h, score: 1, why: ["words"] }));
    const weakHit = { ...hit(4, "Weak.jpg"), score: 0.1, why: ["meaning"] };
    const backend = fakeBackend({ search: vi.fn(async (q: string) => searchResponse(q, [...strong, weakHit])) });
    window.location.hash = "#/hanap?q=x";
    render(<App backend={backend} startup={false} />);
    const summary = await screen.findByText(/1 weaker match, related in meaning only/);
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });
});
