/*
  Request lifecycle with cancellation and stale-response protection, wired
  to Iris. Only the newest request may update state or tell Iris anything;
  a superseded or cancelled request is aborted and its result ignored.
*/
import { useCallback, useEffect, useRef, useState } from "react";
import { isAbort } from "../services/apiClient";
import { useIris } from "../mascot/IrisContext";
import type { Outcome, RequestKind } from "../mascot/irisMachine";

export type ReqStatus = "idle" | "loading" | "done" | "error";

export interface Tracked<T, A extends unknown[]> {
  status: ReqStatus;
  data: T | null;
  error: Error | null;
  run: (...args: A) => Promise<T | null>;
  cancel: () => void;
  reset: () => void;
}

export function useTrackedRequest<T, A extends unknown[]>(
  kind: RequestKind,
  fn: (signal: AbortSignal, ...args: A) => Promise<T>,
  outcomeOf: (data: T) => Outcome,
): Tracked<T, A> {
  const { begin, finish, cancel: irisCancel } = useIris(); // stable callbacks
  const [status, setStatus] = useState<ReqStatus>("idle");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const seq = useRef(0);
  const ctrl = useRef<AbortController | null>(null);
  const token = useRef<number | null>(null);
  const fnRef = useRef(fn);
  const outRef = useRef(outcomeOf);
  fnRef.current = fn;
  outRef.current = outcomeOf;

  const cancel = useCallback(() => {
    seq.current++;
    ctrl.current?.abort();
    ctrl.current = null;
    if (token.current !== null) irisCancel(token.current);
    token.current = null;
    setStatus((s) => (s === "loading" ? "idle" : s));
  }, [irisCancel]);

  const run = useCallback(
    async (...args: A): Promise<T | null> => {
      ctrl.current?.abort();
      const my = ++seq.current;
      const c = new AbortController();
      ctrl.current = c;
      const t = begin(kind);
      token.current = t;
      setStatus("loading");
      setError(null);
      try {
        const res = await fnRef.current(c.signal, ...args);
        if (my !== seq.current) return null; // stale: a newer request owns the UI
        setData(res);
        setStatus("done");
        finish(t, outRef.current(res));
        return res;
      } catch (e) {
        if (isAbort(e) || my !== seq.current) return null;
        setError(e as Error);
        setStatus("error");
        finish(t, "error");
        return null;
      } finally {
        if (my === seq.current) {
          ctrl.current = null;
          token.current = null;
        }
      }
    },
    [begin, finish, kind],
  );

  const reset = useCallback(() => {
    cancel();
    setData(null);
    setError(null);
    setStatus("idle");
  }, [cancel]);

  useEffect(() => () => ctrl.current?.abort(), []);

  return { status, data, error, run, cancel, reset };
}
