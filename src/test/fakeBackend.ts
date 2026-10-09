import { vi } from "vitest";
import type { Backend } from "../services/backend";
import type { FileRef, LlmConfig, LlmInfo, Proposal, SearchHit, SearchResponse } from "../services/types";

const LLM_DEFAULTS: LlmConfig = { host: "http://127.0.0.1:11434", chat_model: "", vision_model: "", num_ctx: 8192, keep_alive: "1h" };

export function llmInfo(config: Partial<LlmConfig> = {}): LlmInfo {
  const c = { ...LLM_DEFAULTS, ...config };
  return { config: c, defaults: LLM_DEFAULTS, auto_order: ["m"], up: true, installed: ["m", "big:8b"],
    chat_model: c.chat_model || "m", vision_model: c.vision_model || null, embed_model: "e", embed_installed: true };
}

export function file(id: number, name: string, kind = "image"): FileRef {
  return { id, name, path: `C:\\Users\\T\\Pictures\\${name}`, ext: ".jpg", kind, size: 1000, mtime: 1_760_000_000, taken_at: null };
}

export function hit(id: number, name: string): SearchHit {
  return { file: file(id, name), chunk_id: id, locator: {}, snippet: `snippet for ${name} ₱1,500.00`, score: 1 / id, why: ["keyword"], highlight: ["1,500"] };
}

export function searchResponse(q: string, hits: SearchHit[]): SearchResponse {
  return { query: { raw: q, kinds: [], date: null, date_label: null, amounts: [], phrases: [], terms: [], llm: false }, hits, timings: {}, relaxed: [], mode: "keyword", llm_model: null };
}

export function proposal(status: Proposal["status"] = "pending"): Proposal {
  return {
    id: 7, request: "Ipunin", status, created_at: "2026-10-10T10:00:00",
    plan: { kind: "organize", folder: "C:\\Docs\\Enrollment", reason: "Matches", planner: "rules", rejected_ids: [],
      ops: [{ i: 0, op: "mkdir", dst: "C:\\Docs\\Enrollment" }, { i: 1, op: "move", file_id: 1, src: "C:\\Docs\\a.pdf", dst: "C:\\Docs\\Enrollment\\a.pdf" }, { i: 2, op: "move", file_id: 2, src: "C:\\Docs\\b.pdf", dst: "C:\\Docs\\Enrollment\\b.pdf" }] },
    log: [],
  };
}

export function fakeBackend(over: Partial<Backend> = {}): Backend {
  const never = () => new Promise<never>(() => {});
  const base: Backend = {
    isDemo: false,
    status: vi.fn(async () => ({ online: false, ollama: true, chat_model: "m", embed_model: "e", loaded: [], cloud_models: [], ocr: "x", vectors: 0, files: { image: 2 }, last: {}, indexing: false })),
    llm: vi.fn(async () => llmInfo()),
    setLlm: vi.fn(async (patch) => llmInfo(patch)),
    roots: vi.fn(async () => [{ id: 1, path: "C:\\Users\\T", added_at: "2026-10-10", files: 2, name: "T" }]),
    addRoot: vi.fn(async () => ({ cancelled: true as const })),
    addComputer: vi.fn(async () => ({ added: [] })),
    removeRoot: vi.fn(async () => ({ ok: true })),
    stopIndex: vi.fn(never),
    startIndex: vi.fn(never),
    indexStatus: vi.fn(async () => ({ running: false, total: 0, done: 0, current: "", errors: [], started: 0, finished: 1, embedded: 0, embed_skipped: false })),
    search: vi.fn(never),
    ask: vi.fn(never),
    file: vi.fn(never),
    thumbUrl: () => "",
    rawUrl: () => "",
    openFile: vi.fn(async () => ({ ok: true })),
    revealFile: vi.fn(async () => ({ ok: true })),
    addNote: vi.fn(never),
    linis: vi.fn(never),
    propose: vi.fn(never),
    proposeCleanup: vi.fn(never),
    approve: vi.fn(never),
    decline: vi.fn(never),
    undo: vi.fn(never),
    history: vi.fn(async () => []),
  };
  return { ...base, ...over };
}

/** A promise you resolve or reject from the test. Honors AbortSignal like fetch. */
export function deferred<T>(signal?: AbortSignal) {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
    signal?.addEventListener("abort", () => rej(new DOMException("Aborted", "AbortError")));
  });
  return { promise, resolve, reject };
}
