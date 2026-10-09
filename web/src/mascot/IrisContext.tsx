/*
  Global Iris controller. Pages report real request lifecycle events
  (begin / finish / cancel); this provider turns them into presentation
  states with the pure reducer, runs the short settle timers, and schedules
  rare idle micro-actions. It never calls the backend.
*/
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { usePrefs } from "../prefs/PrefsContext";
import { FOUND_BEAT_MS, INITIAL, irisReducer, SETTLE_AFTER, type IrisEvent, type Outcome, type RequestKind } from "./irisMachine";
import type { IrisState } from "./iris.types";

interface IrisApi {
  state: IrisState;
  idleAct: "tilt" | "wiggle" | null;
  /** Start a tracked request. Returns its token. */
  begin: (kind: RequestKind) => number;
  finish: (token: number, outcome: Outcome) => void;
  cancel: (token: number) => void;
  send: (e: IrisEvent) => void;
}

const Ctx = createContext<IrisApi | null>(null);

const REST_AFTER_MS = 90_000;
const MICRO_MIN_MS = 14_000;
const MICRO_MAX_MS = 26_000;
const TYPING_QUIET_MS = 2_500;

export function IrisProvider({ children }: { children: ReactNode }) {
  const { motion } = usePrefs();
  const [m, dispatch] = useReducer(irisReducer, INITIAL);
  const [idleAct, setIdleAct] = useState<"tilt" | "wiggle" | null>(null);
  const tokenRef = useRef(0);
  const lastActivity = useRef(Date.now());
  const lastKey = useRef(0);

  const begin = useCallback((kind: RequestKind) => {
    const token = ++tokenRef.current;
    dispatch({ type: "request", kind, token });
    return token;
  }, []);
  const finish = useCallback((token: number, outcome: Outcome) => dispatch({ type: "result", token, outcome }), []);
  const cancel = useCallback((token: number) => dispatch({ type: "cancel", token }), []);

  // found -> celebrating -> idle. With decorative motion off, skip the celebration beat.
  useEffect(() => {
    if (m.state === "found") {
      const t = window.setTimeout(
        () => dispatch(motion === "none" ? { type: "settle" } : { type: "advance" }),
        motion === "none" ? 1200 : FOUND_BEAT_MS,
      );
      return () => window.clearTimeout(t);
    }
    const ms = SETTLE_AFTER[m.state];
    if (ms) {
      const t = window.setTimeout(() => dispatch({ type: "settle" }), ms);
      return () => window.clearTimeout(t);
    }
  }, [m.state, m.token, motion]);

  // Activity tracking: wake from rest, and stay still while the user types.
  useEffect(() => {
    const onAny = () => {
      lastActivity.current = Date.now();
      dispatch({ type: "wake" });
    };
    const onKey = () => {
      lastKey.current = Date.now();
      onAny();
    };
    window.addEventListener("pointermove", onAny, { passive: true });
    window.addEventListener("pointerdown", onAny, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onAny);
      window.removeEventListener("pointerdown", onAny);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Rare idle micro-actions and resting. One timer at a time; nothing while hidden.
  useEffect(() => {
    if (m.state !== "idle" || motion === "none") {
      setIdleAct(null);
      return;
    }
    let timer = 0;
    let clear = 0;
    const schedule = () => {
      const wait = MICRO_MIN_MS + Math.random() * (MICRO_MAX_MS - MICRO_MIN_MS);
      timer = window.setTimeout(() => {
        const now = Date.now();
        if (now - lastActivity.current > REST_AFTER_MS) {
          dispatch({ type: "rest" });
          return;
        }
        if (!document.hidden && now - lastKey.current > TYPING_QUIET_MS && motion === "full") {
          const act = Math.random() < 0.7 ? "tilt" : "wiggle";
          setIdleAct(act);
          clear = window.setTimeout(() => setIdleAct(null), act === "tilt" ? 1500 : 800);
        }
        schedule();
      }, wait);
    };
    schedule();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clear);
    };
  }, [m.state, motion]);

  const value = useMemo<IrisApi>(
    () => ({ state: m.state, idleAct, begin, finish, cancel, send: dispatch }),
    [m.state, idleAct, begin, finish, cancel],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIris(): IrisApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useIris must be used inside <IrisProvider>");
  return v;
}
