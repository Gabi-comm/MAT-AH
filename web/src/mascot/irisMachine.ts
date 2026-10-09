/*
  Iris presentation state machine. Pure and synchronous so it is easy to
  test. Requests carry a token; a result is only accepted when its token
  matches the latest request, so stale or cancelled responses can never make
  Iris celebrate.

    idle -> searching -> found -> celebrating -> idle
    idle -> searching -> no-results -> idle
    idle -> thinking -> success | no-results -> idle
    idle -> planning -> waiting-for-approval -> success | idle
    any busy -> error -> idle
*/
import type { IrisState } from "./iris.types";

export type RequestKind = "search" | "ask" | "propose" | "scan" | "operation";

export type Outcome =
  | "hits" // search returned real matches
  | "empty" // search returned nothing
  | "grounded" // Sagot answer verified against sources
  | "insufficient" // Sagot could not ground an answer
  | "proposal" // Kilos/Linis proposal waiting for approval
  | "done" // an approved operation finished
  | "report" // a scan finished; nothing to celebrate
  | "error"
  | "unavailable"; // local model not running

export interface IrisMachineState {
  state: IrisState;
  token: number | null;
  kind: RequestKind | null;
}

export type IrisEvent =
  | { type: "request"; kind: RequestKind; token: number }
  | { type: "result"; token: number; outcome: Outcome }
  | { type: "cancel"; token: number }
  | { type: "advance" }
  | { type: "settle" }
  | { type: "approval-cleared" }
  | { type: "curious" }
  | { type: "rest" }
  | { type: "wake" }
  | { type: "reset" };

export const INITIAL: IrisMachineState = { state: "idle", token: null, kind: null };

const BUSY: Record<RequestKind, IrisState> = {
  search: "searching",
  ask: "thinking",
  propose: "planning",
  scan: "searching",
  operation: "thinking",
};

const OUTCOME: Record<Outcome, IrisState> = {
  hits: "found",
  empty: "no-results",
  grounded: "success",
  insufficient: "no-results",
  proposal: "waiting-for-approval",
  done: "success",
  report: "idle",
  error: "error",
  unavailable: "unavailable",
};

/** States that return to idle by themselves, and after how long (ms). */
export const SETTLE_AFTER: Partial<Record<IrisState, number>> = {
  celebrating: 1040,
  "no-results": 2600,
  success: 1600,
  error: 6000,
  curious: 1400,
};

/** "found" is the attention beat before the celebration. */
export const FOUND_BEAT_MS = 160;

const BUSY_STATES = new Set<IrisState>(["searching", "thinking", "planning"]);

export function isBusy(s: IrisState): boolean {
  return BUSY_STATES.has(s);
}

export function irisReducer(s: IrisMachineState, e: IrisEvent): IrisMachineState {
  switch (e.type) {
    case "request":
      return { state: BUSY[e.kind], token: e.token, kind: e.kind };

    case "result": {
      if (e.token !== s.token || !isBusy(s.state)) return s; // stale or already settled
      return { state: OUTCOME[e.outcome], token: s.token, kind: s.kind };
    }

    case "cancel":
      if (e.token !== s.token || !isBusy(s.state)) return s;
      return { ...INITIAL };

    case "advance":
      return s.state === "found" ? { ...s, state: "celebrating" } : s;

    case "settle":
      return s.state in SETTLE_AFTER || s.state === "found" ? { ...INITIAL } : s;

    case "approval-cleared":
      return s.state === "waiting-for-approval" ? { ...INITIAL } : s;

    // Decorative events never override work, approval, or errors.
    case "curious":
      return s.state === "idle" ? { ...s, state: "curious" } : s;
    case "rest":
      return s.state === "idle" ? { ...s, state: "resting" } : s;
    case "wake":
      return s.state === "resting" ? { ...s, state: "idle" } : s;

    case "reset":
      return { ...INITIAL };
  }
}
