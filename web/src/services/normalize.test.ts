import { describe, expect, it } from "vitest";
import { answerParts, formatBytes, hasThumb, highlightParts, indexPhaseText, kindLabel, locatorLabel, locatorLong, pathCrumbs } from "./normalize";

describe("normalize", () => {
  it("splits answers into text and citations", () => {
    expect(answerParts("Deadline is Oct 24 [1]. Fee ₱500 [2].")).toEqual([
      { text: "Deadline is Oct 24 " }, { cite: 1 }, { text: ". Fee ₱500 " }, { cite: 2 }, { text: "." },
    ]);
  });
  it("highlights case-insensitively", () => {
    const parts = highlightParts("Sent via GCash ₱1,500.00", ["gcash", "1,500"]);
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["GCash", "1,500"]);
  });
  it("formats sizes, locators and crumbs", () => {
    expect(formatBytes(412000)).toBe("402 KB");
    expect(locatorLabel({ page: 2 })).toBe("p. 2");
    expect(locatorLabel({})).toBeNull();
    expect(pathCrumbs("C:\\Users\\JR\\Pictures\\Screenshots\\a.jpg")).toEqual(["Users", "JR", "Pictures", "Screenshots"]);
  });
});


describe("integrated backend fields", () => {
  it("labels video/audio times, sheets and new kinds", () => {
    expect(locatorLabel({ t: 75 })).toBe("1:15");
    expect(locatorLong({ t: 75 })).toBe("at 1:15");
    expect(locatorLong({ sheet: "Sheet1" })).toBe("sheet Sheet1");
    expect(kindLabel("sheet")).toBe("EXCEL");
    expect(hasThumb("video")).toBe(true);
    expect(hasThumb("audio")).toBe(false);
  });
  it("describes indexing phases with the backend's own counts", () => {
    expect(indexPhaseText({ phase: "listing", listed: 1200, done: 0, total: 0, current: "" })).toBe("Listing files… 1,200 found");
    expect(indexPhaseText({ phase: "reading", done: 3, total: 10, current: "a.pdf" })).toBe("Reading files · 3 of 10");
    expect(indexPhaseText({ phase: "seeing", done: 0, total: 0, current: "" })).toBe("Loading the visual model…");
  });
});
