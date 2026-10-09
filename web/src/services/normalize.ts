/* UI-facing helpers that turn raw backend fields into display values. */
import type { FileKind, Locator } from "./types";

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`;
}

export function formatDate(secondsOrIso: number | string | null | undefined): string {
  if (secondsOrIso === null || secondsOrIso === undefined || secondsOrIso === "") return "";
  const d = typeof secondsOrIso === "number" ? new Date(secondsOrIso * 1000) : new Date(secondsOrIso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

const KIND_LABEL: Record<string, string> = {
  pdf: "PDF",
  docx: "WORD",
  pptx: "SLIDES",
  sheet: "EXCEL",
  text: "TEXT",
  image: "IMAGE",
  video: "VIDEO",
  audio: "AUDIO",
  other: "FILE",
};

export function kindLabel(kind: FileKind): string {
  return KIND_LABEL[kind] ?? String(kind || "FILE").toUpperCase();
}

export function hasThumb(kind: FileKind): boolean {
  return kind === "pdf" || kind === "image" || kind === "video";
}

/** 75 -> "1:15" */
export function clock(t: number): string {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

export function locatorLabel(loc: Locator | undefined): string | null {
  if (!loc) return null;
  if (typeof loc.page === "number") return `p. ${loc.page}`;
  if (typeof loc.slide === "number") return `slide ${loc.slide}`;
  if (loc.sheet) return `sheet ${loc.sheet}`;
  if (typeof loc.t === "number") return clock(loc.t);
  return null;
}

export function locatorLong(loc: Locator | undefined): string {
  if (!loc) return "whole file";
  if (typeof loc.page === "number") return `page ${loc.page}`;
  if (typeof loc.slide === "number") return `slide ${loc.slide}`;
  if (loc.sheet) return `sheet ${loc.sheet}`;
  if (typeof loc.t === "number") return `at ${clock(loc.t)}`;
  return "whole file";
}

/** "C:\\Users\\JR\\Pictures\\Screenshots\\a.jpg" -> ["Users","JR","Pictures","Screenshots"] (last 4 folders). */
export function pathCrumbs(path: string, max = 4): string[] {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  parts.pop(); // file name
  if (parts.length && /^[A-Za-z]:$/.test(parts[0])) parts.shift();
  return parts.slice(-max);
}

export function folderOf(path: string): string {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return i > 0 ? path.slice(0, i) : path;
}

const WHY_LABEL: Record<string, string> = {
  keyword: "Words match",
  words: "Words match",
  meaning: "Meaning match",
  "looks like": "Looks like",
  "Windows index": "Windows index",
  type: "File type",
};

export function whyLabel(w: string): string {
  return WHY_LABEL[w] ?? w;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface TextPart {
  text: string;
  hit: boolean;
}

/** Splits text into highlighted and plain parts. Case and accent insensitive. */
export function highlightParts(text: string, needles: string[]): TextPart[] {
  const terms = [...new Set(needles.map((n) => n.trim()).filter((n) => n.length >= 2))].sort(
    (a, b) => b.length - a.length,
  );
  if (!text || !terms.length) return [{ text, hit: false }];
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const folded = fold(text);
  // Folding can change length for some characters; only use it when lengths match.
  const source = folded.length === text.length ? folded : text.toLowerCase();
  const re = new RegExp(terms.map((t) => escapeRe(fold(t))).join("|"), "g");
  const out: TextPart[] = [];
  let last = 0;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false });
    out.push({ text: text.slice(m.index, m.index + m[0].length), hit: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out.length ? out : [{ text, hit: false }];
}

export interface AnswerPart {
  text?: string;
  cite?: number;
}

/** "Deadline is Aug 15 [1]." -> text and citation parts. */
export function answerParts(answer: string): AnswerPart[] {
  const out: AnswerPart[] = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  for (let m = re.exec(answer); m; m = re.exec(answer)) {
    if (m.index > last) out.push({ text: answer.slice(last, m.index) });
    out.push({ cite: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < answer.length) out.push({ text: answer.slice(last) });
  return out;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** Human text for the backend's indexing phase. Counts come straight from /api/index/status. */
export function indexPhaseText(p: { phase?: string; listed?: number; done: number; total: number; current: string }): string {
  const n = (x?: number) => (x ?? 0).toLocaleString("en-US");
  switch (p.phase) {
    case "listing":
      return `Listing files… ${n(p.listed)} found`;
    case "reading":
      return `Reading files · ${n(p.done)} of ${n(p.total)}`;
    case "seeing":
      return p.total ? `Looking at pictures and videos · ${n(p.done)} of ${n(p.total)}` : "Loading the visual model…";
    case "embedding":
      return `Learning meaning · ${n(p.done)} of ${n(p.total)}`;
    case "describing":
      return `Describing pictures · ${n(p.done)} of ${n(p.total)}`;
    default:
      return p.total ? `Indexing · ${n(p.done)} of ${n(p.total)}` : "Indexing…";
  }
}
