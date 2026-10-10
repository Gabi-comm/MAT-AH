// V3-specific scenes: a retimed, more relatable opening + an outro that fades
// cleanly at its new (shorter) duration. Everything else (Hanap/Sagot/Linis/
// Kilos/Tala/Iris) is reused unmodified from ./v2 — see FullV3.tsx.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AuroraBackground, Cursor } from "../lib/primitives";
import { Iris } from "../lib/Iris";
import { colors, fonts } from "../lib/tokens";
import { OutroScene2 } from "./v2";

// ---------- Problem (225f / 7.5s) — "you remember it, you just can't find it" ----------
const FOLDERS: { label: string; x: number; y: number; files: string[] }[] = [
  { label: "Downloads", x: 260, y: 210, files: ["IMG_4471.jpg", "file (3).pdf"] },
  { label: "Documents", x: 1150, y: 190, files: ["Untitled.docx", "scan0021.pdf"] },
  { label: "Desktop", x: 360, y: 630, files: ["New folder (2)", "asdf.png"] },
  { label: "Screenshots", x: 1290, y: 650, files: ["Screenshot_0472.png", "Screenshot_0511.png"] },
];

export function ProblemSceneV3() {
  const frame = useCurrentFrame();
  const cycle = 56;
  const idx = Math.min(FOLDERS.length - 1, Math.floor(frame / cycle));
  const f = FOLDERS[idx];
  const localFrame = frame - idx * cycle;
  const cardOpacity = interpolate(localFrame, [0, 5, cycle - 10, cycle - 2], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fileOpacity = interpolate(localFrame, [10, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shake = Math.sin(frame / 2.3) * 1.6;

  const line1 = spring({ frame, fps: 30, config: { damping: 12 }, durationInFrames: 14 });
  const line2 = spring({ frame: Math.max(0, frame - 95), fps: 30, config: { damping: 12 }, durationInFrames: 14 });
  const sceneFadeOut = interpolate(frame, [200, 225], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ background: colors.void, opacity: sceneFadeOut }}>
      <div
        style={{
          position: "absolute",
          left: f.x,
          top: f.y,
          transform: `translate(-50%, -50%) rotate(${shake}deg)`,
          opacity: cardOpacity,
          background: colors.surfaceElevated,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: "18px 26px",
          fontFamily: fonts.ui,
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          minWidth: 220,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.textSecondary, marginBottom: 8 }}>📁 {f.label}</div>
        <div style={{ opacity: fileOpacity, display: "flex", flexDirection: "column", gap: 4 }}>
          {f.files.map((name) => (
            <span key={name} style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.textTertiary }}>
              {name}
            </span>
          ))}
        </div>
      </div>
      <Cursor x={f.x - 6} y={f.y - 6} clicking={localFrame < 6} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 64,
              color: colors.textPrimary,
              opacity: line1,
              transform: `translateY(${(1 - line1) * 20}px)`,
              textShadow: "0 0 40px rgba(0,0,0,0.8)",
            }}
          >
            YOU REMEMBER THE FILE.
          </div>
          {frame >= 95 && (
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 64,
                color: colors.violetGlow,
                opacity: line2,
                transform: `translateY(${(1 - line2) * 20}px)`,
                marginTop: 16,
              }}
            >
              NOT WHERE YOU SAVED IT.
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------- Reveal (105f / 3.5s) — "Meet Mata." ----------
export function RevealSceneV3() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bloom = interpolate(frame, [0, 45], [0, 1], { extrapolateRight: "clamp" });
  const wordmarkIn = spring({ frame, fps, config: { damping: 13 }, durationInFrames: 22 });
  const taglineIn = interpolate(frame, [45, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <AuroraBackground intensity={bloom} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ opacity: wordmarkIn, transform: `translateY(${(1 - wordmarkIn) * 16}px) scale(${0.92 + wordmarkIn * 0.08})`, display: "flex", alignItems: "center", gap: 18 }}>
            <Iris state="celebrating" size={84} />
            <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 58, color: colors.textPrimary, letterSpacing: 1 }}>MAT-AH</span>
          </div>
          {frame >= 45 && (
            <div style={{ opacity: taglineIn, fontFamily: fonts.ui, fontSize: 24, color: colors.lavender, textAlign: "center" }}>
              Remember what it was, not where you saved it.
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------- Outro wrapper (390f / 13s) — same OutroScene2 content from V2, re-faded for the new, shorter duration ----------
export function OutroSceneV3() {
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [365, 390], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <OutroScene2 />
      <AbsoluteFill style={{ background: colors.void, opacity: fadeOut }} />
    </AbsoluteFill>
  );
}
