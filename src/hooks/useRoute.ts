/*
  Minimal hash router (#/hanap?q=...). No dependency, works when FastAPI
  serves dist/ as static files, and keeps browser Back/Forward working.
*/
import { useCallback, useEffect, useState } from "react";

export type Page = "home" | "hanap" | "sagot" | "kilos" | "linis" | "settings";
const PAGES: Page[] = ["home", "hanap", "sagot", "kilos", "linis", "settings"];

export interface Route {
  page: Page;
  params: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  const [path, qs = ""] = h.split("?");
  const page = (PAGES.includes(path as Page) ? path : "home") as Page;
  return { page, params: new URLSearchParams(qs) };
}

export function hrefFor(page: Page, params?: Record<string, string>): string {
  const qs = params ? new URLSearchParams(params).toString() : "";
  return `#/${page}${qs ? `?${qs}` : ""}`;
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const navigate = useCallback((page: Page, params?: Record<string, string>) => {
    const next = hrefFor(page, params);
    if (window.location.hash === next) setRoute(parseHash(next));
    else window.location.hash = next;
  }, []);
  return { ...route, navigate };
}
