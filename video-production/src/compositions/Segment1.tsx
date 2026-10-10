import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene } from "../lib/Scene";
import { AuroraBackground, Cursor } from "../lib/primitives";
import { Iris } from "../lib/Iris";
import { colors, fonts } from "../lib/tokens";

const FOLDERS = [
  { label: "Downloads", x: 180, y: 180 },
  { label: "Documents", x: 1180, y: 160 },
  { label: "Desktop", x: 300, y: 620 },
  { label: "Screenshots", x: 1300, y: 640 },
  { label: "Downloads", x: 700, y: 760 },
];

function FrustratedSearch() {
  const frame = useCurrentFrame();
  // Cycle through folders roughly every 22 frames, cursor jumping to each.
  const cycle = 22;
  const idx = Math.min(FOLDERS.length - 1, Math.floor(frame / cycle));
  const f = FOLDERS[idx];
  const localFrame = frame - idx * cycle;
  const cardOpacity = interpolate(localFrame, [0, 4, cycle - 6, cycle - 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shake = Math.sin(frame / 2) * 2;

  return (
    <>
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
          padding: "22px 30px",
          fontFamily: fonts.ui,
          fontSize: 28,
          fontWeight: 600,
          color: colors.textSecondary,
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        📁 {f.label}
      </div>
      <Cursor x={f.x - 6} y={f.y - 6} clicking={localFrame < 6} />
    </>
  );
}

function Headline() {
  const frame = useCurrentFrame();
  const line1 = spring({ frame, fps: 30, config: { damping: 12 }, durationInFrames: 14 });
  const line2Frame = frame - 160;
  const line2 = spring({ frame: Math.max(0, line2Frame), fps: 30, config: { damping: 12 }, durationInFrames: 14 });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 72,
            color: colors.textPrimary,
            opacity: line1,
            transform: `translateY(${(1 - line1) * 20}px)`,
            textShadow: "0 0 40px rgba(0,0,0,0.8)",
          }}
        >
          YOU KNOW THE FILE EXISTS.
        </div>
        {frame >= 160 && (
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 72,
              color: colors.violetGlow,
              opacity: line2,
              transform: `translateY(${(1 - line2) * 20}px)`,
              marginTop: 18,
            }}
          >
            BUT WHERE?
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

function Reveal() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bloom = interpolate(frame, [0, 60], [0, 1], { extrapolateRight: "clamp" });
  const wordmarkIn = spring({ frame, fps, config: { damping: 14 }, durationInFrames: 24 });
  const barIn = spring({ frame: frame - 40, fps, config: { damping: 14 }, durationInFrames: 20 });
  const taglineIn = interpolate(frame, [70, 95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <AuroraBackground intensity={bloom} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          <div
            style={{
              opacity: wordmarkIn,
              transform: `translateY(${(1 - wordmarkIn) * 16}px)`,
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <Iris state="idle" size={84} />
            <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 56, color: colors.textPrimary, letterSpacing: 1 }}>
              MAT-AH
            </span>
          </div>

          {frame >= 40 && (
            <div
              style={{
                opacity: Math.max(0, Math.min(1, barIn)),
                transform: `translateY(${(1 - Math.max(0, Math.min(1, barIn))) * 12}px)`,
                width: 760,
                height: 64,
                borderRadius: 999,
                background: "rgba(22,18,28,0.72)",
                border: `1px solid ${colors.borderStrong}`,
                display: "flex",
                alignItems: "center",
                padding: "0 28px",
                fontFamily: fonts.ui,
                fontSize: 26,
                color: colors.textTertiary,
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              }}
            >
              🔍&nbsp;&nbsp;What are you looking for?
            </div>
          )}

          {frame >= 70 && (
            <div
              style={{
                opacity: taglineIn,
                fontFamily: fonts.ui,
                fontSize: 24,
                color: colors.lavender,
                textAlign: "center",
              }}
            >
              Remember what it was, not where you saved it.
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Segment1() {
  return (
    <Scene>
      {/* Phase A — the problem, frames 0-300 (0-10s) */}
      <Sequence from={0} durationInFrames={300}>
        <AbsoluteFill style={{ background: colors.void }}>
          <FrustratedSearch />
          <Headline />
        </AbsoluteFill>
      </Sequence>

      {/* Phase B — the reveal, frames 300-600 (10-20s) */}
      <Sequence from={300} durationInFrames={300}>
        <Reveal />
      </Sequence>

      <Sequence from={15}>
        <Audio src={staticFile("audio/line1.wav")} volume={0.95} />
      </Sequence>
      <Sequence from={315}>
        <Audio src={staticFile("audio/line2.wav")} volume={0.95} />
      </Sequence>
    </Scene>
  );
}
