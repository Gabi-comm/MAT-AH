/*
  Typed models of the MAT-AH backend contract, read from backend/app.py,
  hanap.py, sagot.py, linis.py, kilos.py, scan.py and status.py (read-only).
  If the backend changes a shape, update it here only. Pages consume the
  normalized helpers in services/normalize.ts, not raw fields.
*/

export type FileKind = "pdf" | "docx" | "pptx" | "sheet" | "text" | "image" | "video" | "audio" | "other" | string;

export interface FileRef {
  id: number;
  path: string;
  name: string;
  ext: string;
  kind: FileKind;
  size: number;
  mtime: number; // seconds since epoch
  taken_at: string | null;
  status?: string;
  /** Present only on records produced by the frontend demo layer. */
  __demo?: true;
}

/**
 * Where inside a file a chunk lives. Search and Sagot strip `boxes`;
 * GET /api/files/{id} keeps them (OCR word boxes for highlighting images).
 */
export interface Locator {
  page?: number;
  slide?: number;
  sheet?: string;
  /** Seconds into a video or audio file. */
  t?: number;
  end?: number;
  /** CLIP image-match score when the hit came from visual search. */
  visual?: number;
  caption?: boolean;
  chars?: [number, number];
  size?: [number, number];
  boxes?: { text: string; box: [number, number, number, number] }[];
}

export interface ParsedQuery {
  raw: string;
  kinds: string[];
  date: [string, string] | null;
  date_label: string | null;
  amounts: number[];
  phrases: string[];
  terms: string[];
  llm?: boolean;
}

/** Backend labels: "words", "meaning", "looks like", "Windows index" (older builds: "keyword"). */
export type MatchReason = string;

export interface SearchHit {
  file: FileRef;
  chunk_id: number | null;
  locator: Locator;
  snippet: string;
  score: number;
  why: MatchReason[];
  highlight: string[];
}

/** GET /api/search?q=&mode=&limit= */
export interface SearchResponse {
  query: ParsedQuery;
  hits: SearchHit[];
  timings: Record<string, number>;
  relaxed: string[];
  mode: "hybrid" | "keyword";
  llm_model?: string | null;
}

export interface AskSource {
  n: number;
  file: FileRef;
  locator: Locator;
  chunk_id: number | null;
  snippet: string;
  highlight: string[];
}

/** POST /api/ask { q } */
export interface AskResponse {
  question: string;
  sources: AskSource[];
  timings: Record<string, number>;
  model: string | null;
  search_mode: string;
  status: "grounded" | "insufficient" | "offline";
  answer: string | null;
  message?: string;
  cited?: number[];
  problems?: string[];
  rejected?: string | null;
}

/** GET /api/files/{id}?chunk= */
export interface FileDetail extends FileRef {
  folder: string;
  locator: Locator;
  text: string;
  notes: { id: number; text: string; created_at: string }[];
  root_id?: number | null;
  status?: string;
}

/** GET /api/roots */
export interface RootFolder {
  id: number;
  path: string;
  added_at: string;
  files: number;
  name: string;
}

export type IndexPhase = "idle" | "listing" | "reading" | "seeing" | "listening" | "embedding" | "describing" | "done";

/** GET /api/index/status, POST /api/index, POST /api/index/stop */
export interface IndexProgress {
  running: boolean;
  phase?: IndexPhase;
  listed?: number;
  seen?: number;
  described?: number;
  total: number;
  done: number;
  current: string;
  errors: string[];
  started: number;
  finished: number;
  embedded: number;
  embed_skipped: boolean;
  stop?: boolean;
}

/** GET /api/status */
export interface SystemStatus {
  online: boolean;
  ollama: boolean;
  chat_model: string | null;
  embed_model: string | null;
  loaded: string[];
  cloud_models: string[];
  ocr: string;
  vectors: number;
  files: Record<string, number>;
  last: Record<string, unknown>;
  indexing: boolean;
  index?: IndexProgress;
  visual?: { model: string; installed: boolean; loaded: boolean; error: string | null; device?: string | null };
  media?: { whisper_model: string; whisper_installed: boolean; whisper_loaded: boolean; whisper_error: string | null };
  windows_search?: { available: boolean; error: string | null };
  vision_model?: string | null;
}

/** Settings > Local LLM. "" model = automatic. */
export interface LlmConfig {
  host: string;
  chat_model: string;
  vision_model: string;
  num_ctx: number;
  keep_alive: string;
}

/** GET /api/llm, PUT /api/llm */
export interface LlmInfo {
  config: LlmConfig;
  defaults: LlmConfig;
  auto_order: string[];
  up: boolean;
  installed: string[];
  chat_model: string | null;
  vision_model: string | null;
  embed_model: string;
  embed_installed: boolean;
  /** Models on this computer: from Ollama when it is up, else read from its model folder. */
  downloaded: DownloadedModel[];
  /** Curated models worth downloading, checked against this computer's memory. */
  recommended: RecommendedModel[];
  /** Total memory in GB, or null when it can't be read. */
  ram_gb: number | null;
  /** Background downloads by model name. */
  pulls: Record<string, ModelPull>;
}

export interface DownloadedModel {
  name: string;
  size_gb: number | null;
  embed: boolean;
}

export interface RecommendedModel {
  name: string;
  label: string;
  uses: ("answer" | "image" | "embed")[];
  size_gb: number | null;
  min_ram_gb: number;
  note: string;
  installed: boolean;
  fits: boolean;
}

export interface ModelPull {
  state: "downloading" | "done" | "error";
  status: string;
  completed: number;
  total: number;
  error: string | null;
}

/** GET /api/linis */
export interface LinisRef {
  id: number | null;
  path: string;
  name: string;
}

export interface DuplicateGroup {
  sha256: string;
  size: number;
  keep: LinisRef;
  extra: LinisRef[];
}

export interface LinisReport {
  duplicates: DuplicateGroup[];
  zero_byte: LinisRef[];
  empty_folders: { path: string; name: string }[];
  reclaimable_bytes: number;
}

/** Kilos proposals: POST /api/kilos/propose | cleanup, approve, decline, undo; GET /api/ops */
export type OpKind = "mkdir" | "move" | "trash" | "rmdir";

export interface PlanOp {
  i: number;
  op: OpKind;
  file_id?: number;
  src?: string;
  dst?: string;
  renamed?: boolean;
}

export interface ProposalPlan {
  kind: "organize" | "cleanup";
  folder?: string;
  reason: string;
  planner: string;
  rejected_ids?: number[];
  ops: PlanOp[];
}

export interface OpLog {
  id: number;
  proposal_id: number;
  op: OpKind;
  src: string | null;
  dst: string | null;
  status: "done" | "failed" | "undone" | string;
  error: string | null;
  done_at: string;
  undone_at?: string | null;
}

export interface Proposal {
  id: number;
  request: string;
  status: "pending" | "approved" | "declined" | "undone" | string;
  created_at: string;
  plan: ProposalPlan;
  log: OpLog[];
}
