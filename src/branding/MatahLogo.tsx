/*
  MAT-AH identity (board 04, "The hyphen is the opening").
  The letters are real outlines of Space Grotesk Bold (SIL OFL), so the
  wordmark renders identically without the font installed. The hyphen is an
  ember seam: width 0.75 of cap height, thickness 0.15, centred on the cap
  height midline.
*/
import type { SVGProps } from "react";

const MAT =
  "M66 0V-700H311L432 -90H450L571 -700H816V0H688V-603H670L550 0H332L212 -603H194V0ZM880 0 1064 -700H1294L1478 0H1342L1304 -154H1054L1016 0ZM1085 -276H1273L1188 -617H1170ZM1704 0V-580H1500V-700H2040V-580H1836V0Z";
const AH =
  "M18 0 202 -700H432L616 0H480L442 -154H192L154 0ZM223 -276H411L326 -617H308ZM680 0V-700H812V-411H1072V-700H1204V0H1072V-291H812V0Z";

export const SEAM = { x: 2170, y: -402, w: 525, h: 105 };
const AH_X = 2807;
export const WORDMARK_VIEWBOX = "0 -700 4080 700";
export const EMBER = "#F28A4E";

interface WordmarkProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Height in px. Width follows the 5.83:1 aspect ratio. */
  height?: number;
  /** "brand": letters in currentColor, ember seam. "mono": everything currentColor. */
  variant?: "brand" | "mono";
  /** Play the reveal: the seam stretches and opens, letters unmask from its midline. */
  animate?: boolean;
  title?: string;
}

export function MatahWordmark({ height = 28, variant = "brand", animate = false, title = "MAT-AH", className, ...rest }: WordmarkProps) {
  const width = Math.round((height * 4080) / 700);
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      width={width}
      height={height}
      role="img"
      aria-label={title}
      className={`${animate ? "logo-animate " : ""}${className ?? ""}`.trim() || undefined}
      {...rest}
    >
      <g className="logo-letters" fill="currentColor">
        <path d={MAT} />
        <path d={AH} transform={`translate(${AH_X} 0)`} />
      </g>
      <rect
        className="logo-seam"
        x={SEAM.x}
        y={SEAM.y}
        width={SEAM.w}
        height={SEAM.h}
        rx={SEAM.h / 2}
        fill={variant === "mono" ? "currentColor" : EMBER}
      />
    </svg>
  );
}

interface MarkProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
  title?: string;
}

/** "The Opening": a file with a folded corner parting along an ember seam. */
export function MatahSymbol({ size = 32, title, tone = "ink", ...svg }: MarkProps & { tone?: "ink" | "light" }) {
  const slab = tone === "light" ? "#F6F3EF" : "currentColor";
  const fold = tone === "light" ? "#C8BCFF" : "#5B3FD6";
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} {...svg}>
      <path d="M20 30a8 8 0 018-8h30l14 14v8H20z" fill={slab} />
      <path d="M58 22v8a6 6 0 006 6h8z" fill={fold} />
      <rect x="14" y="47" width="68" height="6" rx="3" fill={EMBER} />
      <path d="M20 56h52v10a8 8 0 01-8 8H28a8 8 0 01-8-8z" fill={slab} />
    </svg>
  );
}

/**
 * App icon. Sizes below 32 px use simplified drawings (board 04,
 * "Small-scale"): the fold drops first, then everything but the seam.
 */
export function MatahAppIcon({ size = 48, title = "MAT-AH", ...rest }: MarkProps) {
  if (size <= 20) {
    return (
      <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={title} {...rest}>
        <rect width="96" height="96" rx="20" fill="#5B3FD6" />
        <rect x="10" y="40" width="76" height="16" rx="8" fill={EMBER} />
      </svg>
    );
  }
  if (size < 32) {
    return (
      <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={title} {...rest}>
        <rect width="96" height="96" rx="22" fill="#5B3FD6" />
        <rect x="18" y="20" width="60" height="22" rx="6" fill="#F6F3EF" />
        <rect x="12" y="45" width="72" height="10" rx="5" fill={EMBER} />
        <rect x="18" y="58" width="60" height="18" rx="6" fill="#F6F3EF" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={title} {...rest}>
      <rect width="96" height="96" rx="24" fill="#5B3FD6" />
      <path d="M20 30a8 8 0 018-8h30l14 14v8H20z" fill="#F6F3EF" />
      <path d="M58 22v8a6 6 0 006 6h8z" fill="#C8BCFF" />
      <rect x="14" y="47" width="68" height="6" rx="3" fill={EMBER} />
      <path d="M20 56h52v10a8 8 0 01-8 8H28a8 8 0 01-8-8z" fill="#F6F3EF" />
    </svg>
  );
}

/** Compact logo: symbol + wordmark, for tight headers. */
export function MatahLockup({ height = 24 }: { height?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(height * 0.4) }}>
      <MatahSymbol size={Math.round(height * 1.25)} tone="light" />
      <MatahWordmark height={Math.round(height * 0.72)} />
    </span>
  );
}
