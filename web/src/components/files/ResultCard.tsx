import { memo } from "react";
import { formatBytes, formatDate, highlightParts, pathCrumbs, whyLabel } from "../../services/normalize";
import type { SearchHit } from "../../services/types";
import { Icon } from "../Icon";
import { FileThumb } from "./FileThumb";
import { useFileActions } from "./fileActions";

export function Highlighted({ text, needles }: { text: string; needles: string[] }) {
  return (
    <>
      {highlightParts(text, needles).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  );
}

interface Props {
  hit: SearchHit;
  best?: boolean;
  selected?: boolean;
  dim?: boolean;
  onPreview: (hit: SearchHit) => void;
}

function ResultCardImpl({ hit, best, selected, dim, onPreview }: Props) {
  const { open, reveal } = useFileActions();
  const f = hit.file;
  const crumbs = pathCrumbs(f.path);
  return (
    <article
      className={`result${selected ? " is-selected" : ""}${dim ? " is-dim" : ""}`}
      aria-label={`${f.name}${best ? ", best match" : ""}`}
      data-best={best ? "true" : undefined}
    >
      <button className="result-open" onClick={() => onPreview(hit)} aria-label={`Preview ${f.name}`} />
      {best && (
        <span className="brackets" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      )}
      <FileThumb file={f} locator={hit.locator} />
      <div className="result-body">
        <div className="row wrap gap-2">
          {best && <span className="tag tag-best">Best match</span>}
          {f.__demo && <span className="tag tag-warn">DEMO</span>}
          {hit.why.map((w) => (
            <span key={w} className="tag">
              {whyLabel(w)}
            </span>
          ))}
        </div>
        <span className="result-name truncate" title={f.name}>
          {f.name}
        </span>
        {hit.snippet && (
          <p className="result-snippet">
            <Highlighted text={hit.snippet} needles={hit.highlight} />
          </p>
        )}
        <ol className="crumbs" aria-label="Location">
          {crumbs.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
        <span className="mono subtle" style={{ fontSize: 11.5 }}>
          {formatBytes(f.size)} · {formatDate(f.taken_at ?? f.mtime)}
        </span>
        <div className="result-actions">
          <button className="btn btn-line btn-sm" onClick={() => open(f.id, f.name)}>
            <Icon name="open" size={16} /> Buksan
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => reveal(f.id, f.name)}>
            <Icon name="folder" size={16} /> Show in folder
          </button>
        </div>
      </div>
    </article>
  );
}

export const ResultCard = memo(ResultCardImpl);
