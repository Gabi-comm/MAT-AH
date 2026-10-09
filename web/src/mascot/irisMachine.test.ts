import { describe, expect, it } from "vitest";
import { INITIAL, irisReducer, type IrisEvent, type IrisMachineState } from "./irisMachine";

const run = (events: IrisEvent[], s: IrisMachineState = INITIAL) => events.reduce(irisReducer, s);

describe("Iris state machine", () => {
  it("search with hits: searching -> found -> celebrating -> idle", () => {
    let s = run([{ type: "request", kind: "search", token: 1 }]);
    expect(s.state).toBe("searching");
    s = irisReducer(s, { type: "result", token: 1, outcome: "hits" });
    expect(s.state).toBe("found");
    s = irisReducer(s, { type: "advance" });
    expect(s.state).toBe("celebrating");
    s = irisReducer(s, { type: "settle" });
    expect(s.state).toBe("idle");
  });

  it("empty results never celebrate", () => {
    const s = run([{ type: "request", kind: "search", token: 1 }, { type: "result", token: 1, outcome: "empty" }, { type: "advance" }]);
    expect(s.state).toBe("no-results");
  });

  it("failed request shows error", () => {
    const s = run([{ type: "request", kind: "search", token: 1 }, { type: "result", token: 1, outcome: "error" }]);
    expect(s.state).toBe("error");
  });

  it("ignores a stale response from an older request", () => {
    const s = run([
      { type: "request", kind: "search", token: 1 },
      { type: "request", kind: "search", token: 2 },
      { type: "result", token: 1, outcome: "hits" },
    ]);
    expect(s.state).toBe("searching");
    expect(irisReducer(s, { type: "result", token: 2, outcome: "empty" }).state).toBe("no-results");
  });

  it("a cancelled request cannot celebrate later", () => {
    const s = run([{ type: "request", kind: "search", token: 1 }, { type: "cancel", token: 1 }, { type: "result", token: 1, outcome: "hits" }]);
    expect(s.state).toBe("idle");
  });

  it("decorative events never override errors or approvals", () => {
    const err = run([{ type: "request", kind: "ask", token: 1 }, { type: "result", token: 1, outcome: "error" }]);
    expect(run([{ type: "curious" }, { type: "rest" }], err).state).toBe("error");
    const wait = run([{ type: "request", kind: "propose", token: 1 }, { type: "result", token: 1, outcome: "proposal" }]);
    expect(wait.state).toBe("waiting-for-approval");
    expect(run([{ type: "settle" }, { type: "curious" }, { type: "rest" }], wait).state).toBe("waiting-for-approval");
    expect(irisReducer(wait, { type: "approval-cleared" }).state).toBe("idle");
  });

  it("thinking -> success for grounded answers, no-results for insufficient", () => {
    expect(run([{ type: "request", kind: "ask", token: 3 }, { type: "result", token: 3, outcome: "grounded" }]).state).toBe("success");
    expect(run([{ type: "request", kind: "ask", token: 3 }, { type: "result", token: 3, outcome: "insufficient" }]).state).toBe("no-results");
  });

  it("rests only from idle and wakes on activity", () => {
    const r = run([{ type: "rest" }]);
    expect(r.state).toBe("resting");
    expect(irisReducer(r, { type: "wake" }).state).toBe("idle");
  });
});
