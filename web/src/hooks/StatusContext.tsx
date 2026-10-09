/*
  Backend status shared by the rail, Home and Settings. Polls /api/status
  slowly (15 s), faster while indexing, and pauses while the window is hidden.
*/
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useBackend } from "../services/BackendContext";
import { isAbort } from "../services/apiClient";
import type { IndexProgress, SystemStatus } from "../services/types";

interface StatusValue {
  status: SystemStatus | null;
  index: IndexProgress | null;
  error: Error | null;
  refresh: () => void;
  startIndex: () => Promise<void>;
}

const Ctx = createContext<StatusValue | null>(null);

export function StatusProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [index, setIndex] = useState<IndexProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const indexing = !!(index?.running || status?.indexing);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.hidden) return;
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      try {
        const [s, ix] = await Promise.all([backend.status(c.signal), backend.indexStatus(c.signal)]);
        if (!alive) return;
        setStatus(s);
        setIndex(ix);
        setError(null);
      } catch (e) {
        if (!alive || isAbort(e)) return;
        setError(e as Error);
      }
    };
    load();
    const id = window.setInterval(load, indexing ? 1500 : 15000);
    return () => {
      alive = false;
      window.clearInterval(id);
      ctrl.current?.abort();
    };
  }, [backend, indexing, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const startIndex = useCallback(async () => {
    const p = await backend.startIndex();
    setIndex(p);
    setTick((t) => t + 1);
  }, [backend]);

  return <Ctx.Provider value={{ status, index, error, refresh, startIndex }}>{children}</Ctx.Provider>;
}

export function useStatus(): StatusValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStatus must be used inside <StatusProvider>");
  return v;
}
