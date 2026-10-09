/*
  The one interface every page talks to. `realBackend` maps 1:1 to the
  routes in backend/app.py. `demoBackend` (src/mocks) is a separate,
  clearly labelled implementation used only when demo mode is switched on;
  real requests never fall back to it.
*/
import { apiUrl, request } from "./apiClient";
import type {
  AskResponse,
  FileDetail,
  IndexProgress,
  LinisProgress,
  LinisReport,
  LlmConfig,
  LlmInfo,
  Proposal,
  RootFolder,
  SearchResponse,
  SystemStatus,
} from "./types";

export interface Backend {
  readonly isDemo: boolean;
  status(signal?: AbortSignal): Promise<SystemStatus>;
  llm(refresh?: boolean, signal?: AbortSignal): Promise<LlmInfo>;
  setLlm(patch: Partial<LlmConfig>): Promise<LlmInfo>;
  /** Starts downloading a recommended model in Ollama; poll llm() for progress. */
  pullLlm(model: string): Promise<LlmInfo>;
  roots(signal?: AbortSignal): Promise<RootFolder[]>;
  /** path omitted: the backend opens the native Windows folder picker. */
  addRoot(path?: string): Promise<{ id: number; path: string; added_at: string } | { cancelled: true }>;
  /** "Search my whole computer": user folder plus non-system drives. */
  addComputer(): Promise<{ added: { id: number; path: string; added_at: string }[] }>;
  removeRoot(id: number): Promise<{ ok: boolean }>;
  startIndex(): Promise<IndexProgress>;
  stopIndex(): Promise<IndexProgress>;
  indexStatus(signal?: AbortSignal): Promise<IndexProgress>;
  search(q: string, signal?: AbortSignal, limit?: number): Promise<SearchResponse>;
  ask(q: string, signal?: AbortSignal): Promise<AskResponse>;
  file(id: number, chunk?: number | null, signal?: AbortSignal): Promise<FileDetail>;
  thumbUrl(id: number, page?: number, w?: number, t?: number): string;
  rawUrl(id: number): string;
  openFile(id: number): Promise<{ ok: boolean }>;
  revealFile(id: number): Promise<{ ok: boolean }>;
  addNote(id: number, text: string): Promise<FileDetail>;
  linis(path?: string, signal?: AbortSignal): Promise<LinisReport>;
  linisProgress(signal?: AbortSignal): Promise<LinisProgress>;
  propose(requestText: string, signal?: AbortSignal): Promise<Proposal>;
  proposeCleanup(fileIds: number[], folders: string[]): Promise<Proposal>;
  approve(pid: number, selected?: number[] | null): Promise<Proposal>;
  decline(pid: number): Promise<Proposal>;
  undo(pid: number): Promise<Proposal>;
  history(signal?: AbortSignal): Promise<Proposal[]>;
}

export const realBackend: Backend = {
  isDemo: false,
  status: (signal) => request("/api/status", { signal }),
  llm: (refresh, signal) => request("/api/llm", { params: { refresh: refresh ? 1 : undefined }, signal }),
  setLlm: (patch) => request("/api/llm", { method: "PUT", body: patch }),
  pullLlm: (model) => request("/api/llm/pull", { method: "POST", body: { model } }),
  roots: (signal) => request("/api/roots", { signal }),
  addRoot: (path) => request("/api/roots", { method: "POST", body: { path: path ?? null } }),
  addComputer: () => request("/api/roots/computer", { method: "POST" }),
  removeRoot: (id) => request(`/api/roots/${id}`, { method: "DELETE" }),
  startIndex: () => request("/api/index", { method: "POST" }),
  stopIndex: () => request("/api/index/stop", { method: "POST" }),
  indexStatus: (signal) => request("/api/index/status", { signal }),
  search: (q, signal, limit = 60) => request("/api/search", { params: { q, mode: "hybrid", limit }, signal }),
  ask: (q, signal) => request("/api/ask", { method: "POST", body: { q }, signal }),
  file: (id, chunk, signal) => request(`/api/files/${id}`, { params: { chunk: chunk ?? undefined }, signal }),
  thumbUrl: (id, page = 1, w = 360, t = 1) => apiUrl(`/api/files/${id}/thumb`, { page, w, t }),
  rawUrl: (id) => apiUrl(`/api/files/${id}/raw`),
  openFile: (id) => request(`/api/files/${id}/open`, { method: "POST" }),
  revealFile: (id) => request(`/api/files/${id}/reveal`, { method: "POST" }),
  addNote: (id, text) => request(`/api/files/${id}/notes`, { method: "POST", body: { text } }),
  linis: (path, signal) => request("/api/linis", { params: { path }, signal }),
  linisProgress: (signal) => request("/api/linis/progress", { signal }),
  propose: (requestText, signal) => request("/api/kilos/propose", { method: "POST", body: { request: requestText }, signal }),
  proposeCleanup: (file_ids, folders) => request("/api/kilos/cleanup", { method: "POST", body: { file_ids, folders } }),
  approve: (pid, selected) =>
    request(`/api/kilos/${pid}/approve`, { method: "POST", body: { selected: selected ?? null } }),
  decline: (pid) => request(`/api/kilos/${pid}/decline`, { method: "POST" }),
  undo: (pid) => request(`/api/kilos/${pid}/undo`, { method: "POST" }),
  history: (signal) => request("/api/ops", { signal }),
};

/**
 * Demo mode is opt-in and development-only:
 *   npm run dev:demo           (Vite mode "demo")
 *   or open http://localhost:5173/?demo=1 while running `npm run dev`
 * Production builds always use the real backend.
 */
export function demoRequested(): boolean {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.MODE === "demo" || import.meta.env.VITE_MATAH_DEMO === "1") return true;
  try {
    return new URLSearchParams(window.location.search).has("demo");
  } catch {
    return false;
  }
}
