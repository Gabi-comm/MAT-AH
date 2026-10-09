import { useEffect, useState } from "react";
import { useBackend } from "../../services/BackendContext";
import { isAbort } from "../../services/apiClient";
import { formatBytes, formatDate, hasThumb, kindLabel, locatorLong } from "../../services/normalize";
import type { FileDetail, Locator } from "../../services/types";
import { Dialog } from "../dialogs/Dialog";
import { ErrorState, Skeleton, useToast } from "../feedback/Feedback";
import { Icon } from "../Icon";
import { Highlighted } from "./ResultCard";
import { useFileActions } from "./fileActions";

export interface PreviewTarget {
  fileId: number;
  name: string;
  chunkId?: number | null;
  locator?: Locator;
  highlight?: string[];
  /** Short evidence passage to spotlight (from search or Ask). */
  excerpt?: string;
}

export function PreviewDrawer({ target, onClose }: { target: PreviewTarget | null; onClose: () => void }) {
  const backend = useBackend();
  const toast = useToast();
  const { open, reveal } = useFileActions();
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [imgOk, setImgOk] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!target) return;
    const c = new AbortController();
    setDetail(null);
    setError(null);
    setImgOk(true);
    backend
      .file(target.fileId, target.chunkId, c.signal)
      .then(setDetail)
      .catch((e) => !isAbort(e) && setError(e));
    return () => c.abort();
  }, [backend, target, attempt]);

  const loc = target?.locator ?? detail?.locator;
  const page = loc?.page ?? 1;
  const kind = detail?.kind ?? "";
  const raw = target ? backend.rawUrl(target.fileId) : "";
  const big = target && hasThumb(kind) ? backend.thumbUrl(target.fileId, page, 720, loc?.t ?? 1) : "";

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !note.trim()) return;
    setSaving(true);
    try {
      const d = await backend.addNote(target.fileId, note.trim());
      setDetail(d);
      setNote("");
      toast("Note saved. It's searchable now.");
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!target} onClose={onClose} variant="drawer" title={target?.name ?? ""}>
      {error && <ErrorState error={error} onRetry={() => setAttempt((a) => a + 1)} title="Can't preview this file." />}
      {!error && !detail && (
        <div className="stack gap-3" aria-busy="true" aria-label="Loading preview">
          <Skeleton h={300} />
          <Skeleton h={16} w="60%" />
          <Skeleton h={80} />
        </div>
      )}
      {detail && target && (
        <>
          <MediaStage
            kind={kind}
            raw={raw}
            big={big && imgOk ? big : ""}
            onImgError={() => setImgOk(false)}
            detail={detail}
            loc={loc}
            needles={target.highlight ?? []}
          />

          {(target.excerpt || detail.text) && (
            <section className="stack gap-2" aria-label="Matched passage">
              <span className="eyebrow" style={{ color: "var(--accent-secondary-text)" }}>
                Matched · {locatorLong(loc)}
              </span>
              <div className="excerpt">
                <Highlighted text={(target.excerpt || detail.text).slice(0, 1600)} needles={target.highlight ?? []} />
              </div>
            </section>
          )}

          <section className="stack gap-2">
            <span className="eyebrow">Exact location</span>
            <div className="path-box">{detail.path}</div>
          </section>

          <dl className="kv">
            <div><dt>Type</dt><dd>{kindLabel(kind)}</dd></div>
            <div><dt>Size</dt><dd>{formatBytes(detail.size)}</dd></div>
            <div><dt>Modified</dt><dd>{formatDate(detail.mtime)}</dd></div>
            <div><dt>Location in file</dt><dd>{locatorLong(loc)}</dd></div>
          </dl>

          <div className="row wrap gap-2">
            <button className="btn btn-primary" onClick={() => open(detail.id, detail.name)}>
              <Icon name="open" /> Open in app
            </button>
            <button className="btn btn-line" onClick={() => reveal(detail.id, detail.name)}>
              <Icon name="folder" /> Show in folder
            </button>
            {raw && kind === "pdf" && (
              <a className="btn btn-ghost" href={`${raw}#page=${page}`} target="_blank" rel="noreferrer">
                View {locatorLong(loc)}
              </a>
            )}
          </div>

          <section className="stack gap-3" aria-label="Notes">
            <span className="eyebrow">Notes on this file</span>
            {detail.notes.length > 0 ? (
              <ul className="list-plain">
                {detail.notes.map((n) => (
                  <li key={n.id} className="card" style={{ padding: 12 }}>
                    <span style={{ fontSize: 15 }}>"{n.text}"</span>
                    <br />
                    <span className="mono subtle" style={{ fontSize: 12 }}>{formatDate(n.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="subtle" style={{ fontSize: 14 }}>Write how you would remember this file. MAT-AH searches your notes too.</p>
            )}
            <form className="field" onSubmit={saveNote}>
              <label htmlFor="tala">Add a note</label>
              <textarea id="tala" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The one my teacher sent before enrollment." />
              <button className="btn btn-line" type="submit" disabled={saving || !note.trim()} style={{ alignSelf: "flex-start" }}>
                {saving ? "Sine-save…" : "Save note"}
              </button>
            </form>
          </section>
        </>
      )}
    </Dialog>
  );
}

const foldText = (x: string) => Array.from(x, (c) => (c.normalize("NFD")[0] ?? c).toLowerCase()).join("");

/**
 * The file itself, landed at the right spot: PDFs open at the cited page,
 * video and audio start at the matched second, images show the OCR words
 * that matched (only when the backend supplied word boxes).
 */
function MediaStage({
  kind,
  raw,
  big,
  onImgError,
  detail,
  loc,
  needles,
}: {
  kind: string;
  raw: string;
  big: string;
  onImgError: () => void;
  detail: FileDetail;
  loc: Locator | undefined;
  needles: string[];
}) {
  const page = loc?.page ?? 1;
  const t = loc?.t ?? 0;
  if (raw && kind === "pdf") {
    return (
      <div className="preview-stage media">
        <iframe key={`${detail.id}-${page}`} title={`${detail.name}, page ${page}`} src={`${raw}#page=${page}&view=FitH&navpanes=0`} />
      </div>
    );
  }
  if (raw && kind === "video") {
    return (
      <div className="preview-stage media">
        <video key={`${detail.id}-${t}`} controls muted preload="metadata" src={`${raw}#t=${t}`} aria-label={`${detail.name}, starting at ${locatorLong(loc)}`} />
      </div>
    );
  }
  if (raw && kind === "audio") {
    return (
      <div className="preview-stage">
        <audio controls preload="metadata" src={`${raw}#t=${t}`} aria-label={`${detail.name}, starting at ${locatorLong(loc)}`} />
      </div>
    );
  }
  if (raw && kind === "image") {
    const dl = detail.locator ?? {};
    const [w, h] = dl.size ?? [0, 0];
    const words = needles.filter((n) => n.length >= 2).map(foldText);
    const hits = (dl.boxes ?? []).filter((b) => words.some((n) => foldText(b.text).includes(n)));
    return (
      <div className="stack gap-2">
        <div className="preview-stage reveal">
          <div className="ocr">
            <img src={raw} alt={detail.name} />
            {w > 0 && hits.length > 0 && (
              <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
                {hits.map((b, i) => (
                  <rect key={i} x={b.box[0] - 6} y={b.box[1] - 4} width={b.box[2] - b.box[0] + 12} height={b.box[3] - b.box[1] + 8} rx="6" />
                ))}
              </svg>
            )}
          </div>
        </div>
        {hits.length > 0 && <span className="subtle" style={{ fontSize: 13 }}>Highlighted: words MAT-AH read in this image that match your search.</span>}
      </div>
    );
  }
  if (big) {
    return (
      <div className="preview-stage reveal">
        <img src={big} alt={`${detail.name}, ${locatorLong(loc)}`} onError={onImgError} />
      </div>
    );
  }
  return (
    <div className="preview-stage">
      <span className="subtle">{detail.__demo ? "Demo data: no real preview." : `No visual preview for ${kindLabel(kind)} files. The matched text is below.`}</span>
    </div>
  );
}
