import { describe, expect, it } from "vitest";
import { demoBackend } from "./demoBackend";

describe("demo backend (isolated demonstration data)", () => {
  it("marks itself and every file as demo data", async () => {
    expect(demoBackend.isDemo).toBe(true);
    const r = await demoBackend.search("GCash receipt na ₱1,500");
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.file.__demo === true)).toBe(true);
    expect(r.hits[0].file.name).toMatch(/GCash/);
  });
  it("returns no results for an amount no file contains", async () => {
    expect((await demoBackend.search("₱15,000")).hits).toHaveLength(0);
  });
  it("honours AbortSignal", async () => {
    const c = new AbortController();
    const p = demoBackend.search("GCash", c.signal);
    c.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});
