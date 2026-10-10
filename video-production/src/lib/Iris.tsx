// Faithful recreation of MAT-AH's real mascot (src/mascot/Iris.tsx): a small
// paper file-sprite with a folded "ear", two dot eyes and stubby feet, drawn
// in the "Classic Iris" dark-theme palette. Re-driven with Remotion timing
// instead of CSS keyframes so it can be choreographed per-frame in a render.
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type IrisState = "idle" | "searching" | "found" | "celebrating" | "thinking";

const BODY = "M8 50C4 50 4 46 4 40V20C4 10 10 6 20 6H38L52 18V40C52 48 50 50 44 50Z";
const FOLD = "M38 6V15C38 17 39 18 41 18H52Z";

const PALETTE = { body: "#F28A4E", fold: "#C8BCFF", face: "#0E0A18" };

export type IrisPalette = { body: string; fold: string; face: string };

/** The 7 real presets from src/mascot/irisPresets.ts (dark theme), "Classic Iris" first (the default). */
export const IRIS_COLOR_PRESETS: { id: string; name: string; palette: IrisPalette }[] = [
  { id: "classic", name: "Classic", palette: { body: "#F28A4E", fold: "#C8BCFF", face: "#0E0A18" } },
  { id: "ube", name: "Ube", palette: { body: "#9C8CFF", fold: "#ECE7FF", face: "#0E0A18" } },
  { id: "mint", name: "Mint", palette: { body: "#7EDCB5", fold: "#E3F1E8", face: "#0E0A18" } },
  { id: "midnight", name: "Midnight", palette: { body: "#3A2F70", fold: "#F28A4E", face: "#F6F3EF" } },
  { id: "peach", name: "Peach", palette: { body: "#F6B49A", fold: "#FDE3D2", face: "#0E0A18" } },
  { id: "sunshine", name: "Sunshine", palette: { body: "#F5C542", fold: "#FDE3D2", face: "#0E0A18" } },
  { id: "rose", name: "Rose", palette: { body: "#F07C7C", fold: "#FDE3D2", face: "#0E0A18" } },
];

function Face({ state, face: c }: { state: IrisState; face: string }) {
  if (state === "searching") {
    return (
      <g>
        <rect x="18" y="28" width="7" height="3" rx="1.5" fill={c} />
        <rect x="31" y="28" width="7" height="3" rx="1.5" fill={c} />
      </g>
    );
  }
  if (state === "found" || state === "celebrating") {
    return (
      <g>
        <circle cx="22" cy="27" r="3.8" fill={c} />
        <circle cx="34" cy="27" r="3.8" fill={c} />
        <path d="M24 36q4 4 8 0" stroke={c} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (state === "thinking") {
    return (
      <g>
        <circle cx="23" cy="25" r="2.8" fill={c} />
        <circle cx="35" cy="25" r="2.8" fill={c} />
      </g>
    );
  }
  // idle
  return (
    <g>
      <circle cx="18" cy="29" r="3.2" fill={c} />
      <circle cx="38" cy="29" r="3.2" fill={c} />
    </g>
  );
}

export function Iris({
  state = "idle",
  size = 120,
  palette = PALETTE,
  accessory,
}: {
  state?: IrisState;
  size?: number;
  palette?: IrisPalette;
  /** Optional small accessory mark drawn near the top of the sprite (e.g. a tiny grad cap). */
  accessory?: "gradcap" | "bowtie" | "glasses";
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hop =
    state === "celebrating"
      ? spring({ frame, fps, config: { damping: 9, mass: 0.4 }, durationInFrames: 16 }) * -10
      : 0;
  const breathe = state === "idle" ? Math.sin(frame / 14) * 1.5 : 0;
  const glowOpacity =
    state === "found" || state === "celebrating"
      ? interpolate(frame % 40, [0, 20, 40], [0.5, 0.95, 0.5])
      : 0;

  return (
    <svg width={size} height={Math.round((size * 72) / 64)} viewBox="-4 -10 64 72">
      <defs>
        <radialGradient id="iris-glow">
          <stop offset="0%" stopColor="#F5D0FE" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#C084FC" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
        </radialGradient>
      </defs>
      {(state === "found" || state === "celebrating") && (
        <circle cx="28" cy="28" r="40" fill="url(#iris-glow)" opacity={glowOpacity} />
      )}
      {state === "celebrating" && (
        <g fill="#E879F9">
          <path d="M-2 8l2 -3l2 3l-2 3Z" opacity={glowOpacity} />
          <path d="M58 22l2 -3l2 3l-2 3Z" opacity={glowOpacity} />
          <path d="M2 -4l1.5 -2.5l1.5 2.5l-1.5 2.5Z" opacity={glowOpacity} />
        </g>
      )}
      <g transform={`translate(0 ${hop + breathe})`}>
        <path d={BODY} fill={palette.body} />
        <path d={FOLD} fill={palette.fold} />
        <Face state={state} face={palette.face} />
        {accessory === "gradcap" && (
          <g transform="translate(14 -6)">
            <rect x="0" y="4" width="28" height="4" rx="1" fill="#17121F" />
            <rect x="11" y="-2" width="6" height="7" fill="#17121F" />
            <circle cx="26" cy="8" r="1.6" fill="#F5C542" />
          </g>
        )}
        {accessory === "bowtie" && (
          <g transform="translate(16 44)">
            <path d="M0 0 L8 -4 L8 4 Z M16 0 L8 -4 L8 4 Z" fill={palette.fold} />
            <circle cx="8" cy="0" r="2" fill="#17121F" />
          </g>
        )}
        {accessory === "glasses" && (
          <g transform="translate(13 24)" stroke="#17121F" strokeWidth="1.6" fill="none">
            <circle cx="5" cy="4" r="4.4" />
            <circle cx="21" cy="4" r="4.4" />
            <path d="M9.4 4h7.2" />
          </g>
        )}
      </g>
    </svg>
  );
}
