import { useState } from "react";
import { useBackend } from "../../services/BackendContext";
import { hasThumb, kindLabel, locatorLabel } from "../../services/normalize";
import type { FileRef, Locator } from "../../services/types";
import { Icon } from "../Icon";

/** Thumbnail with a stable box: skeleton while loading, honest fallback on 415/404 or demo data. */
export function FileThumb({ file, locator, width = 360, height, showLocator = true }: { file: FileRef; locator?: Locator; width?: number; height?: number; showLocator?: boolean }) {
  const backend = useBackend();
  const page = locator?.page ?? 1;
  const url = hasThumb(file.kind) ? backend.thumbUrl(file.id, page, width, locator?.t ?? 1) : "";
  const [state, setState] = useState<"loading" | "ok" | "fail">(url ? "loading" : "fail");
  const loc = showLocator ? locatorLabel(locator) : null;
  return (
    <div className={`thumb kind-${file.kind}`} style={height ? { height } : undefined}>
      {url && state !== "fail" && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("fail")}
          style={state === "loading" ? { opacity: 0 } : undefined}
        />
      )}
      {state === "loading" && <div className="skeleton" style={{ position: "absolute", inset: 0, borderRadius: 0 }} aria-hidden="true" />}
      {state === "fail" && (
        <div className="thumb-fallback" aria-hidden="true">
          <Icon name={file.kind === "image" ? "image" : "file"} size={28} />
          <span>{file.__demo ? "Demo preview" : "No preview"}</span>
        </div>
      )}
      <span className="thumb-kind">{kindLabel(file.kind)}</span>
      {loc && <span className="thumb-loc">{loc}</span>}
    </div>
  );
}
