import { createContext, useContext, type ReactNode } from "react";
import { realBackend, type Backend } from "./backend";

const Ctx = createContext<Backend>(realBackend);

export function BackendProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  return <Ctx.Provider value={backend}>{children}</Ctx.Provider>;
}

export function useBackend(): Backend {
  return useContext(Ctx);
}
