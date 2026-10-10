import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene } from "../lib/Scene";
import { AuroraBackground, Chip, GlassCard, TypedText } from "../lib/primitives";
import { Iris, type IrisState } from "../lib/Iris";
import { colors, fonts } from "../lib/tokens";

const QUERY = "Yung PDF tungkol sa enrollment na sinend last week.";
const QUESTION = "Kailan ang deadline ng enrollment?";

function SearchBar({ text, typing }: { text: string; typing: boolean }) {
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        width: 1000,
        height: 72,
        borderRadius: 999,
        background: "rgba(22,18,28,0.72)",
        border: `1px solid ${colors.borderStrong}`,
        display: "flex",
        alignItems: "center",
        padding: "0 32px",
        fontFamily: fonts.ui,
        fontSize: 28,
        color: colors.textPrimary,
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        gap: 16,
      }}
    >
      <span>🔍</span>
      {typing ? <TypedText text={text} fps={fps} charsPerSecond={20} /> : <span>{text}</span>}
    </div>
  );
}

function HanapScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const irisState: IrisState = frame < 160 ? "searching" : frame < 185 ? "found" : "celebrating";
  const resultsIn = interpolate(frame, [155, 175], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const card2In = interpolate(frame, [175, 195], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const docZoom = spring({ frame: Math.max(0, frame - 300), fps, config: { damping: 16 }, durationInFrames: 30 });

  return (
    <AbsoluteFill>
      <AuroraBackground intensity={0.7} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 110 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, width: 1100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <SearchBar text={QUERY} typing={frame < 150} />
            <div style={{ transform: "scale(0.8)" }}>
              <Iris state={irisState} size={70} />
            </div>
          </div>

          {frame >= 150 && frame < 300 && (
            <div style={{ display: "flex", gap: 20, marginTop: 10, width: "100%" }}>
              <GlassCard
                style={{
                  flex: 1,
                  padding: 24,
                  opacity: resultsIn,
                  transform: `translateY(${(1 - resultsIn) * 16}px)`,
                  border: `1.5px solid ${colors.violetGlow}`,
                }}
              >
                <div style={{ fontFamily: fonts.ui, fontWeight: 600, fontSize: 24, color: colors.textPrimary, marginBottom: 10 }}>
                  📄 Enrollment_Announcement.pdf
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <Chip>pdf</Chip>
                  <Chip>enrollment</Chip>
                  <Chip>best match</Chip>
                </div>
              </GlassCard>
              <GlassCard style={{ flex: 1, padding: 24, opacity: card2In, transform: `translateY(${(1 - card2In) * 16}px)` }}>
                <div style={{ fontFamily: fonts.ui, fontWeight: 600, fontSize: 24, color: colors.textSecondary, marginBottom: 10 }}>
                  📄 Form_138_scan.pdf
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <Chip tone="plain">pdf</Chip>
                  <Chip tone="plain">school</Chip>
                </div>
              </GlassCard>
            </div>
          )}

          {frame >= 300 && (
            <GlassCard
              style={{
                marginTop: 10,
                padding: 32,
                width: "100%",
                opacity: docZoom,
                transform: `scale(${0.96 + docZoom * 0.04})`,
                border: `1.5px solid ${colors.violetGlow}`,
              }}
            >
              <div style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.textTertiary, marginBottom: 12 }}>
                ENROLLMENT ANNOUNCEMENT — page 1
              </div>
              <div style={{ fontFamily: fonts.ui, fontSize: 24, color: colors.textSecondary, lineHeight: 1.5 }}>
                Online enrollment opens on October 1, 2026 for all year levels.{" "}
                <mark style={{ background: "rgba(124,58,237,0.35)", color: colors.textPrimary, padding: "0 4px", borderRadius: 4 }}>
                  The last day of enrollment is October 24, 2026.
                </mark>{" "}
                Late enrollment will incur a fee of ₱500.00.
              </div>
            </GlassCard>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function SagotScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const answerIn = interpolate(frame, [60, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const citeIn = spring({ frame: Math.max(0, frame - 120), fps, config: { damping: 14 }, durationInFrames: 16 });

  return (
    <AbsoluteFill>
      <AuroraBackground intensity={0.6} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 1100, display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontFamily: fonts.ui,
              fontSize: 30,
              fontWeight: 600,
              color: colors.textPrimary,
              display: "flex",
              gap: 14,
              alignItems: "center",
            }}
          >
            <span>💬</span>
            <TypedText text={QUESTION} fps={fps} charsPerSecond={22} />
          </div>

          {frame >= 60 && (
            <GlassCard style={{ padding: 32, opacity: answerIn, transform: `translateY(${(1 - answerIn) * 16}px)` }}>
              <div style={{ fontFamily: fonts.ui, fontSize: 26, color: colors.textSecondary, lineHeight: 1.6 }}>
                According to the Enrollment Announcement, the last day of enrollment is{" "}
                <strong style={{ color: colors.textPrimary }}>October 24, 2026</strong>, with a{" "}
                <strong style={{ color: colors.textPrimary }}>₱500.00</strong> late fee after that{" "}
                {frame >= 120 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: colors.violet,
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 700,
                      transform: `scale(${citeIn})`,
                    }}
                  >
                    1
                  </span>
                )}
                .
              </div>
            </GlassCard>
          )}

          {frame >= 140 && (
            <div
              style={{
                opacity: interpolate(frame, [140, 160], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                fontFamily: fonts.mono,
                fontSize: 16,
                color: colors.textTertiary,
                borderLeft: `2px solid ${colors.violet}`,
                paddingLeft: 16,
              }}
            >
              [1] ENROLLMENT ANNOUNCEMENT · "...last day of enrollment is October 24, 2026..."
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Segment2() {
  return (
    <Scene>
      <Sequence from={0} durationInFrames={390}>
        <HanapScene />
      </Sequence>
      <Sequence from={390} durationInFrames={210}>
        <SagotScene />
      </Sequence>

      <Sequence from={30}>
        <Audio src={staticFile("audio/line3.wav")} volume={0.95} />
      </Sequence>
    </Scene>
  );
}
