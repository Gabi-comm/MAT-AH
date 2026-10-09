/*
  DEMONSTRATION DATA ONLY.
  An isolated, in-memory stand-in for the backend so the UI can be previewed
  without FastAPI. It never touches the filesystem and never runs when demo
  mode is off. Every file record carries `__demo: true` and the UI shows a
  DEMO badge while this layer is active.

  Handy demo queries:
    "GCash receipt for ₱1,500"     results
    "₱15,000"                        no results
    "demo error"                     simulated backend error
*/
import { ApiError } from "../services/apiClient";
import type { Backend } from "../services/backend";
import type {
  AskResponse,
  FileDetail,
  FileRef,
  IndexProgress,
  LinisReport,
  LlmConfig,
  LlmInfo,
  Proposal,
  RootFolder,
  SearchHit,
  SearchResponse,
  SystemStatus,
} from "../services/types";

const ROOT = "C:\\Users\\Demo\\Documents\\MAT-AH Demo";

function f(id: number, rel: string, kind: string, size: number, daysAgo: number): FileRef {
  const name = rel.split("\\").pop()!;
  return {
    id,
    path: `${ROOT}\\${rel}`,
    name,
    ext: name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "",
    kind,
    size,
    mtime: Math.floor(Date.now() / 1000) - daysAgo * 86400,
    taken_at: null,
    __demo: true,
  };
}

const FILES: FileRef[] = [
  f(1, "Screenshots\\Screenshot_20260814-193012_GCash.jpg", "image", 412_000, 57),
  f(2, "School\\Enrollment_Announcement.pdf", "pdf", 214_000, 70),
  f(3, "School\\Tuition_Receipt_1stSem.pdf", "pdf", 96_000, 120),
  f(4, "Screenshots\\Screenshot_20260702-081455_GCash.jpg", "image", 388_000, 100),
  f(5, "Downloads\\Form138_Grades_2025.pdf", "pdf", 182_000, 80),
  f(6, "Downloads\\PSA_Birth_Certificate_scan.pdf", "pdf", 640_000, 82),
  f(7, "Pictures\\ID_Photo_2x2.jpg", "image", 120_000, 84),
  f(8, "Downloads\\Good_Moral_Certificate.pdf", "pdf", 150_000, 79),
  f(9, "Pictures\\IMG_20260702_165511.jpg", "image", 3_100_000, 100),
  f(10, "School\\Thesis_Final_v3.pdf", "pdf", 18_000_000, 130),
];

const TEXT: Record<number, string> = {
  1: "Sent via GCash\n₱1,500.00\nto M****** S.\nAmount 1,500.00\nTotal 1,500.00\nRef No. 9012 345 678\nAug 14, 2026 7:29 PM",
  2: "ENROLLMENT ANNOUNCEMENT\nSchedule of Enrollment\nOnline enrollment opens on October 1, 2026 for all year levels.\nThe last day of enrollment is October 24, 2026. Late enrollment will incur a fee of ₱500.00.\nRequirements: Form 138, PSA Birth Certificate, two 2x2 ID photos, Certificate of Good Moral Character.",
  3: "OFFICIAL RECEIPT\nCashier\nTuition and miscellaneous fees, 1st Semester\nAmount paid: ₱18,450.00\nDate: 01/20/2026",
  4: "GCash Cash In ₱1,500.00\nRef No. 7710 112 004\nJul 2, 2026 8:14 AM",
  5: "Form 138 Report Card. Final grades, Academic Year 2024-2025.",
  6: "Certificate of Live Birth. Philippine Statistics Authority.",
  7: "Photo: 2x2 ID portrait on a white background.",
  8: "Certificate of Good Moral Character issued by the Guidance Office.",
  9: "Photo: a red motorcycle parked outside a sari-sari store.",
  10: "Thesis Final Version 3. Chapter 1 Introduction.",
};

const LOC: Record<number, { page?: number }> = { 2: { page: 2 }, 3: { page: 1 }, 5: { page: 1 }, 10: { page: 1 } };

function wait<T>(ms: number, value: () => T, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(() => {
      try {
        resolve(value());
      } catch (e) {
        reject(e);
      }
    }, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[₱,]/g, "");

function snippetOf(id: number, needles: string[]): string {
  const t = TEXT[id].replace(/\s+/g, " ");
  const low = fold(t);
  const pos = needles.map((n) => low.indexOf(fold(n))).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, pos - 40);
  return (start > 0 ? "…" : "") + t.slice(start, start + 200);
}

const STOP = new Set(["hanapin", "mo", "yung", "ng", "na", "sa", "ang", "mga", "ko", "the", "a", "screenshot", "picture", "may"]);

function demoSearch(q: string): SearchResponse {
  const words = fold(q).split(/[^a-z0-9.]+/).filter((w) => w.length > 1 && !STOP.has(w));
  const amounts = (q.match(/₱?\s?\d[\d,]*(?:\.\d+)?/g) ?? []).map((a) => Number(a.replace(/[₱,\s]/g, ""))).filter(Boolean);
  const kinds = /screenshot|picture|photo|litrato/i.test(q) ? ["image"] : /pdf/i.test(q) ? ["pdf"] : [];
  const hits: SearchHit[] = [];
  for (const file of FILES) {
    const hay = fold(`${file.name} ${TEXT[file.id]}`);
    let score = 0;
    const why = new Set<string>();
    for (const w of words) if (hay.includes(w)) { score += 1; why.add("keyword"); }
    if (amounts.length) {
      const hasAmt = amounts.some((a) => hay.includes(String(Math.trunc(a))));
      if (!hasAmt) score = 0;
      else score *= 1.5;
    }
    if (/motor|red/.test(fold(q)) && file.id === 9) { score += 2; why.add("meaning"); }
    if (score > 0) {
      hits.push({
        file,
        chunk_id: file.id * 10,
        locator: LOC[file.id] ?? {},
        snippet: snippetOf(file.id, [...words, ...amounts.map(String)]),
        score: Math.round(score * 1000) / 1000,
        why: [...why],
        highlight: [...words, ...amounts.map((a) => a.toLocaleString("en-US"))],
      });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  let filtered = hits;
  const relaxed: string[] = [];
  if (kinds.length) {
    const k = hits.filter((h) => kinds.includes(h.file.kind));
    if (k.length) filtered = k;
    else relaxed.push("type");
  }
  return {
    query: { raw: q, kinds, date: null, date_label: null, amounts, phrases: [], terms: words, llm: false },
    hits: filtered,
    timings: { parse: 2, retrieve: 31 },
    relaxed,
    mode: "hybrid",
    llm_model: null,
  };
}

let proposals: Proposal[] = [];
let nextPid = 1;
let notes: Record<number, { id: number; text: string; created_at: string }[]> = {};
let indexing: IndexProgress = {
  running: false, total: 10, done: 10, current: "", errors: [], started: 0, finished: Date.now() / 1000, embedded: 10, embed_skipped: false,
};

function store(requestText: string, plan: Proposal["plan"]): Proposal {
  plan.ops.forEach((o, i) => (o.i = i));
  const p: Proposal = { id: nextPid++, request: requestText, status: "pending", created_at: new Date().toISOString(), plan, log: [] };
  proposals = [p, ...proposals];
  return structuredClone(p);
}

const LLM_DEFAULTS: LlmConfig = { host: "http://127.0.0.1:11434", chat_model: "", vision_model: "", num_ctx: 8192, keep_alive: "1h" };
let llmConfig: LlmConfig = { ...LLM_DEFAULTS };

function llmInfo(): LlmInfo {
  const installed = ["demo-model", "demo-vision", "demo-embed"];
  return {
    config: { ...llmConfig }, defaults: { ...LLM_DEFAULTS }, auto_order: ["demo-model"], up: true, installed,
    chat_model: llmConfig.chat_model || "demo-model", vision_model: llmConfig.vision_model || "demo-vision",
    embed_model: "demo-embed", embed_installed: true,
    downloaded: installed.map((name) => ({ name, size_gb: 2, embed: name.includes("embed") })),
    recommended: [{ name: "demo-small", label: "Demo Small", uses: ["answer"], size_gb: 1.4, min_ram_gb: 4, note: "Demo only.", installed: false, fits: true }],
    ram_gb: 16, pulls: {},
  };
}

function getP(pid: number): Proposal {
  const p = proposals.find((x) => x.id === pid);
  if (!p) throw new ApiError(404, "Unknown proposal");
  return p;
}

export const demoBackend: Backend = {
  isDemo: true,
  status: (signal) =>
    wait(120, (): SystemStatus => ({
      online: false, ollama: true, chat_model: "demo-model", embed_model: "demo-embed", loaded: ["demo-model"],
      cloud_models: [], ocr: "RapidOCR (ONNX)", vectors: 42, files: { pdf: 6, image: 4 }, last: {}, indexing: indexing.running,
    }), signal),
  llm: (_refresh, signal) => wait(120, llmInfo, signal),
  setLlm: (patch) => wait(200, () => {
    llmConfig = { ...llmConfig, ...patch };
    return llmInfo();
  }),
  pullLlm: () => wait(200, () => {
    throw new ApiError(400, "Downloads are off in demo mode.");
  }),
  roots: (signal) =>
    wait(100, (): RootFolder[] => [{ id: 1, path: ROOT, added_at: "2026-10-01T09:00:00", files: FILES.length, name: "MAT-AH Demo" }], signal),
  addRoot: () => wait(300, () => ({ cancelled: true as const })),
  addComputer: () => wait(300, () => ({ added: [] })),
  removeRoot: () => wait(200, () => ({ ok: true })),
  startIndex: () =>
    wait(150, () => {
      indexing = { ...indexing, running: true, stop: false, phase: "reading", done: 0, total: FILES.length, started: Date.now() / 1000, current: FILES[0].name };
      const tick = setInterval(() => {
        const done = Math.min(FILES.length, indexing.done + 1);
        indexing = { ...indexing, done, current: FILES[done - 1]?.name ?? "" };
        if (done >= FILES.length || indexing.stop) {
          clearInterval(tick);
          indexing = { ...indexing, running: false, phase: indexing.stop ? "idle" : "done", current: "", finished: Date.now() / 1000 };
        }
      }, 450);
      return { ...indexing };
    }),
  stopIndex: () => wait(100, () => {
    indexing = { ...indexing, stop: true };
    return { ...indexing };
  }),
  indexStatus: (signal) => wait(80, () => ({ ...indexing }), signal),
  search: (q, signal) =>
    wait(650, () => {
      if (/demo error/i.test(q)) throw new ApiError(500, "Simulated backend error (demo).");
      return demoSearch(q);
    }, signal),
  ask: (q, signal) =>
    wait(1400, (): AskResponse => {
      const s = demoSearch(q);
      const pick = (id: number, n: number) => {
        const h = s.hits.find((x) => x.file.id === id) ?? { file: FILES[id - 1], chunk_id: id * 10, locator: LOC[id] ?? {}, snippet: snippetOf(id, []), highlight: [] as string[] };
        return { n, file: h.file, locator: h.locator, chunk_id: h.chunk_id, snippet: h.snippet, highlight: h.highlight };
      };
      const base = { question: q, timings: { retrieve: 40, generate: 1200, verify: 3 }, model: "demo-model", search_mode: "hybrid" };
      if (/deadline|enroll/i.test(q)) {
        return { ...base, sources: [pick(2, 1)], status: "grounded", cited: [1], problems: [],
          answer: "According to the Enrollment Announcement, the last day of enrollment is October 24, 2026, with a ₱500.00 late fee after that [1]." };
      }
      if (/tuition|magkano/i.test(q)) {
        return { ...base, sources: [pick(3, 1)], status: "grounded", cited: [1], problems: [],
          answer: "You paid ₱18,450.00 in tuition for the 1st Semester, according to the Official Receipt [1]." };
      }
      return { ...base, sources: s.hits.slice(0, 2).map((h, i) => pick(h.file.id, i + 1)), status: "insufficient", answer: null,
        message: "Not enough evidence in your files. Here are the closest sources.", problems: ["demo: no matching evidence"] };
    }, signal),
  file: (id, _chunk, signal) =>
    wait(250, (): FileDetail => {
      const file = FILES.find((x) => x.id === id);
      if (!file) throw new ApiError(404, "Unknown file");
      return { ...file, folder: file.path.slice(0, file.path.lastIndexOf("\\")), locator: LOC[id] ?? {}, text: TEXT[id], notes: notes[id] ?? [] };
    }, signal),
  thumbUrl: () => "",
  rawUrl: () => "",
  openFile: () => wait(200, () => ({ ok: true })),
  revealFile: () => wait(200, () => ({ ok: true })),
  addNote: (id, text) =>
    wait(250, () => {
      notes = { ...notes, [id]: [...(notes[id] ?? []), { id: Date.now(), text, created_at: new Date().toISOString() }] };
      const file = FILES.find((x) => x.id === id)!;
      return { ...file, folder: file.path.slice(0, file.path.lastIndexOf("\\")), locator: LOC[id] ?? {}, text: TEXT[id], notes: notes[id] };
    }),
  linis: (_path, signal) =>
    wait(1100, (): LinisReport => ({
      duplicates: [
        { sha256: "demo1", size: 18_000_000, keep: { id: 10, path: FILES[9].path, name: FILES[9].name },
          extra: [{ id: 101, path: `${ROOT}\\Downloads\\Thesis_Final_v3 (1).pdf`, name: "Thesis_Final_v3 (1).pdf" },
                  { id: 102, path: `${ROOT}\\Downloads\\Thesis_Final_v3 (2).pdf`, name: "Thesis_Final_v3 (2).pdf" }] },
        { sha256: "demo2", size: 412_000, keep: { id: 1, path: FILES[0].path, name: FILES[0].name },
          extra: [{ id: 103, path: `${ROOT}\\Downloads\\Screenshot_20260814-193012_GCash.jpg`, name: "Screenshot_20260814-193012_GCash.jpg" }] },
      ],
      zero_byte: [{ id: 104, path: `${ROOT}\\Downloads\\New Text Document.txt`, name: "New Text Document.txt" }],
      empty_folders: [{ path: `${ROOT}\\Downloads\\New folder (3)`, name: "New folder (3)" }],
      reclaimable_bytes: 36_412_000,
    }), signal),
  propose: (requestText, signal) =>
    wait(1300, () => {
      const ids = [5, 6, 7, 8, 2];
      const folder = `${ROOT}\\Enrollment Requirements`;
      return store(requestText, {
        kind: "organize", folder, reason: "These files match the requirements listed in the Enrollment Announcement.", planner: "demo-model", rejected_ids: [],
        ops: [{ i: 0, op: "mkdir", dst: folder }, ...ids.map((id, k) => ({ i: k + 1, op: "move" as const, file_id: id, src: FILES[id - 1].path, dst: `${folder}\\${FILES[id - 1].name}`, renamed: false }))],
      });
    }, signal),
  proposeCleanup: (fileIds, folders) =>
    wait(400, () => {
      if (!fileIds.length && !folders.length) throw new ApiError(400, "Nothing selected.");
      return store("Clean-up", {
        kind: "cleanup", reason: "Send selected items to the Recycle Bin.", planner: "linis",
        ops: [...fileIds.map((id, k) => ({ i: k, op: "trash" as const, file_id: id, src: `${ROOT}\\(demo file ${id})` })),
              ...folders.map((d, k) => ({ i: fileIds.length + k, op: "rmdir" as const, src: d }))],
      });
    }),
  approve: (pid, selected) =>
    wait(900, () => {
      const p = getP(pid);
      if (p.status !== "pending") throw new ApiError(400, `Proposal is ${p.status}`);
      const chosen = new Set(selected ?? p.plan.ops.map((o) => o.i));
      p.status = "approved";
      p.log = p.plan.ops
        .filter((o) => o.op === "mkdir" || chosen.has(o.i))
        .map((o, k) => ({ id: pid * 100 + k, proposal_id: pid, op: o.op, src: o.src ?? null, dst: o.op === "trash" ? "Recycle Bin" : o.dst ?? null, status: "done", error: null, done_at: new Date().toISOString() }));
      return structuredClone(p);
    }),
  decline: (pid) =>
    wait(250, () => {
      const p = getP(pid);
      if (p.status !== "pending") throw new ApiError(400, `Proposal is ${p.status}`);
      p.status = "declined";
      return structuredClone(p);
    }),
  undo: (pid) =>
    wait(700, () => {
      const p = getP(pid);
      if (p.status !== "approved") throw new ApiError(400, "Only approved proposals can be undone.");
      p.status = "undone";
      p.log = p.log.map((o) => (o.op === "trash" ? { ...o, error: "Restore it from the Windows Recycle Bin" } : { ...o, status: "undone", undone_at: new Date().toISOString() }));
      return structuredClone(p);
    }),
  history: (signal) => wait(150, () => structuredClone(proposals), signal),
};
