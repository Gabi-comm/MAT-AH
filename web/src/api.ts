export type Kind = 'pdf' | 'docx' | 'pptx' | 'text' | 'image' | 'other'

export interface FileRef {
  id: number
  path: string
  name: string
  ext: string
  kind: Kind
  size: number
  mtime: number
  taken_at: string | null
}

export interface Locator {
  page?: number
  slide?: number
  chars?: [number, number]
  size?: [number, number]
  boxes?: { text: string; box: [number, number, number, number] }[]
}

export interface Hit {
  file: FileRef
  chunk_id: number | null
  locator: Locator
  snippet: string
  score: number
  why: string[]
  highlight: string[]
}

export interface ParsedQuery {
  raw: string
  kinds: string[]
  date: [string, string] | null
  date_label: string | null
  amounts: number[]
  phrases: string[]
  terms: string[]
  llm: boolean
}

export interface SearchResult {
  query: ParsedQuery
  hits: Hit[]
  timings: Record<string, number>
  relaxed: string[]
  mode: 'hybrid' | 'keyword'
}

export interface Source {
  n: number
  file: FileRef
  locator: Locator
  chunk_id: number
  snippet: string
  highlight: string[]
}

export interface Answer {
  question: string
  status: 'grounded' | 'insufficient' | 'offline'
  answer: string | null
  message?: string
  problems?: string[]
  rejected?: string | null
  sources: Source[]
  cited?: number[]
  timings: Record<string, number>
  model: string | null
}

export interface Root {
  id: number
  path: string
  name: string
  files: number
}

export interface IndexProgress {
  running: boolean
  total: number
  done: number
  current: string
  errors: string[]
  embedded: number
  embed_skipped: boolean
  finished: number
}

export interface Status {
  online: boolean
  ollama: boolean
  chat_model: string | null
  embed_model: string | null
  loaded: string[]
  cloud_models: string[]
  ocr: string
  vectors: number
  files: Record<string, number>
  last: Record<string, number | string>
  indexing: boolean
}

export interface LinisRef {
  id: number | null
  path: string
  name: string
}

export interface LinisReport {
  duplicates: { sha256: string; size: number; keep: LinisRef; extra: LinisRef[] }[]
  zero_byte: LinisRef[]
  empty_folders: { path: string; name: string }[]
  reclaimable_bytes: number
}

export interface Op {
  i: number
  op: 'mkdir' | 'move' | 'trash' | 'rmdir'
  src?: string
  dst?: string
  file_id?: number
  renamed?: boolean
}

export interface LogRow {
  id: number
  op: string
  src: string | null
  dst: string | null
  status: string
  error: string | null
  done_at: string
  undone_at: string | null
}

export interface Proposal {
  id: number
  request: string
  status: 'pending' | 'approved' | 'declined' | 'undone'
  created_at: string
  plan: { kind: 'organize' | 'cleanup'; folder?: string; reason: string; planner: string; rejected_ids?: number[]; ops: Op[] }
  log: LogRow[]
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try {
      msg = (await r.json()).detail ?? msg
    } catch {
      /* not json */
    }
    throw new Error(msg)
  }
  return r.json()
}

const post = <T,>(path: string, body?: unknown) =>
  call<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  roots: () => call<Root[]>('/api/roots'),
  addRoot: () => post<Root | { cancelled: true }>('/api/roots', {}),
  removeRoot: (id: number) => call(`/api/roots/${id}`, { method: 'DELETE' }),
  reindex: () => post<IndexProgress>('/api/index'),
  indexStatus: () => call<IndexProgress>('/api/index/status'),
  search: (q: string) => call<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`),
  ask: (q: string) => post<Answer>('/api/ask', { q }),
  file: (id: number, chunk?: number | null) =>
    call<FileRef & { folder: string; locator: Locator; text: string; notes: { id: number; text: string }[] }>(
      `/api/files/${id}${chunk ? `?chunk=${chunk}` : ''}`,
    ),
  open: (id: number) => post(`/api/files/${id}/open`),
  reveal: (id: number) => post(`/api/files/${id}/reveal`),
  addNote: (id: number, text: string) => post(`/api/files/${id}/notes`, { text }),
  linis: (path?: string) => call<LinisReport>(`/api/linis${path ? `?path=${encodeURIComponent(path)}` : ''}`),
  propose: (request: string) => post<Proposal>('/api/kilos/propose', { request }),
  cleanup: (file_ids: number[], folders: string[]) => post<Proposal>('/api/kilos/cleanup', { file_ids, folders }),
  approve: (id: number, selected: number[]) => post<Proposal>(`/api/kilos/${id}/approve`, { selected }),
  decline: (id: number) => post<Proposal>(`/api/kilos/${id}/decline`),
  undo: (id: number) => post<Proposal>(`/api/kilos/${id}/undo`),
  history: () => call<Proposal[]>('/api/ops'),
  status: () => call<Status>('/api/status'),
}

export const rawUrl = (id: number) => `/api/files/${id}/raw`
export const thumbUrl = (id: number, page = 1) => `/api/files/${id}/thumb?page=${page}`
