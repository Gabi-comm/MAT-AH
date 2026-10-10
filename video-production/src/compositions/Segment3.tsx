import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene } from "../lib/Scene";
import { AuroraBackground, Checkmark, Chip, Cursor, GlassCard } from "../lib/primitives";
import { Iris } from "../lib/Iris";
import { colors, fonts } from "../lib/tokens";

function LinisScene() {
  const frame = useCurrentFrame();
  const in1 = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const in2 = interpolate(frame, [10, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flag = interpolate(frame, [35, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 760 }}>
        <div style={{ fontFamily: fonts.ui, fontSize: 24, color: colors.textTertiary, marginBottom: 4 }}>Linis — clean up</div>
        <GlassCard
          style={{ padding: 20, opacity: in1, transform: `translateX(${(1 - in1) * -24}px)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span style={{ fontFamily: fonts.mono, fontSize: 20, color: colors.textPrimary }}>IMG_20260814_1930.jpg</span>
          <Chip tone="plain">original</Chip>
        </GlassCard>
        <GlassCard
          style={{
            padding: 20,
            opacity: in2,
            transform: `translateX(${(1 - in2) * 24}px)`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: flag > 0.5 ? `1.5px solid ${colors.ember}` : undefined,
          }}
        >
          <span style={{ fontFamily: fonts.mono, fontSize: 20, color: colors.textPrimary }}>IMG_20260814_1930 (1).jpg</span>
          <span style={{ opacity: flag }}>
            <Chip>exact duplicate · SHA-256</Chip>
          </span>
        </GlassCard>
      </div>
    </AbsoluteFill>
  );
}

function KilosScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slideIn = spring({ frame, fps, config: { damping: 14 }, durationInFrames: 20 });
  const clicking = frame >= 70 && frame < 76;
  const checked = frame >= 76;
  const undoIn = interpolate(frame, [85, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const before = ["Screenshot_193012.jpg", "GCash_receipt.jpg", "enrollment_form.pdf"];
  const after = ["Receipts/GCash_receipt.jpg", "School/enrollment_form.pdf", "Screenshots/Screenshot_193012.jpg"];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, width: 1000 }}>
        <div style={{ fontFamily: fonts.ui, fontSize: 24, color: colors.textTertiary }}>Kilos — organize, only after you say yes</div>
        <div
          style={{
            display: "flex",
            gap: 40,
            opacity: slideIn,
            transform: `translateY(${(1 - slideIn) * 20}px)`,
          }}
        >
          <GlassCard style={{ flex: 1, padding: 24 }}>
            <div style={{ fontFamily: fonts.ui, fontSize: 18, color: colors.textTertiary, marginBottom: 10 }}>Before</div>
            {before.map((b) => (
              <div key={b} style={{ fontFamily: fonts.mono, fontSize: 18, color: colors.textSecondary, padding: "6px 0" }}>
                {b}
              </div>
            ))}
          </GlassCard>
          <div style={{ display: "flex", alignItems: "center", fontSize: 32, color: colors.violetGlow }}>→</div>
          <GlassCard style={{ flex: 1, padding: 24, border: `1px solid ${colors.violetGlow}` }}>
            <div style={{ fontFamily: fonts.ui, fontSize: 18, color: colors.textTertiary, marginBottom: 10 }}>After</div>
            {after.map((a) => (
              <div key={a} style={{ fontFamily: fonts.mono, fontSize: 18, color: colors.textPrimary, padding: "6px 0" }}>
                {a}
              </div>
            ))}
          </GlassCard>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 6, position: "relative", height: 60 }}>
          <div
            style={{
              padding: "14px 36px",
              borderRadius: 999,
              background: checked ? colors.local : colors.violet,
              color: "#0b0910",
              fontFamily: fonts.ui,
              fontWeight: 700,
              fontSize: 22,
              transition: "background 120ms",
            }}
          >
            {checked ? "Done" : "Yes"}
          </div>
          {clicking && <Cursor x={40} y={0} clicking />}
          {checked && <Checkmark size={34} />}
          <div style={{ marginLeft: "auto", opacity: undoIn }}>
            <Chip tone="plain">Undo</Chip>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function PrivacyAndOutro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const badgeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const wordmarkIn = spring({ frame: Math.max(0, frame - 60), fps, config: { damping: 11 }, durationInFrames: 26 });
  const taglineIn = interpolate(frame, [110, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const catchphraseIn = spring({ frame: Math.max(0, frame - 170), fps, config: { damping: 9 }, durationInFrames: 20 });
  const fadeOut = interpolate(frame, [270, 300], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <AuroraBackground intensity={1} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
          <div
            style={{
              opacity: badgeIn,
              display: "flex",
              gap: 14,
              fontFamily: fonts.ui,
              fontSize: 22,
              color: colors.textSecondary,
            }}
          >
            <Chip tone="plain">🔒 Files stay on this computer</Chip>
            <Chip tone="plain">⚙ Local AI ready · gemma4 / embeddinggemma</Chip>
            <Chip tone="plain">✈ Wi-Fi off, still works</Chip>
          </div>

          <div
            style={{
              opacity: wordmarkIn,
              transform: `translateY(${(1 - wordmarkIn) * 18}px) scale(${0.9 + wordmarkIn * 0.1})`,
              display: "flex",
              alignItems: "center",
              gap: 24,
              marginTop: 10,
            }}
          >
            <Iris state="celebrating" size={110} />
            <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 84, color: colors.textPrimary, letterSpacing: 1 }}>
              MAT-AH
            </span>
          </div>

          <div
            style={{
              opacity: taglineIn,
              fontFamily: fonts.ui,
              fontSize: 28,
              color: colors.lavender,
              textAlign: "center",
            }}
          >
            Remember what it was, not where you saved it.
          </div>

          <div
            style={{
              opacity: Math.max(0, Math.min(1, catchphraseIn)),
              transform: `scale(${0.85 + Math.max(0, Math.min(1, catchphraseIn)) * 0.15})`,
              fontFamily: fonts.display,
              fontWeight: 600,
              fontSize: 36,
              color: colors.orchid,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            "Ahh, kita ko na!"
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Segment3() {
  return (
    <Scene>
      <Sequence from={0} durationInFrames={90}>
        <LinisScene />
      </Sequence>
      <Sequence from={90} durationInFrames={210}>
        <KilosScene />
      </Sequence>
      <Sequence from={300} durationInFrames={300}>
        <PrivacyAndOutro />
      </Sequence>

      <Sequence from={30}>
        <Audio src={staticFile("audio/line4.wav")} volume={0.95} />
      </Sequence>
      <Sequence from={330}>
        <Audio src={staticFile("audio/line5.wav")} volume={0.95} />
      </Sequence>
      <Sequence from={390}>
        <Audio src={staticFile("audio/line6.wav")} volume={0.95} />
      </Sequence>
    </Scene>
  );
}
