// V2 scenes — the five-agent, 60s cut. Reuses the shared design system (lib/*)
// from V1 but retimes/extends the story to fit Hanap, Sagot, Linis, Kilos,
// Tala and an Iris-customization beat into one coherent 60s arc.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AuroraBackground, Checkmark, Chip, Cursor, GlassCard, TypedText } from "../lib/primitives";
import { Iris, IRIS_COLOR_PRESETS } from "../lib/Iris";
import { colors, fonts } from "../lib/tokens";

// ---------- 1. Problem (180f / 6s) ----------
const FOLDERS = [
  { label: "Downloads", x: 230, y: 220 },
  { label: "Documents", x: 1180, y: 200 },
  { label: "Desktop", x: 340, y: 640 },
  { label: "Screenshots", x: 1300, y: 660 },
];

export function ProblemScene() {
  const frame = useCurrentFrame();
  const cycle = 36;
  const idx = Math.min(FOLDERS.length - 1, Math.floor(frame / cycle));
  const f = FOLDERS[idx];
  const localFrame = frame - idx * cycle;
  const cardOpacity = interpolate(localFrame, [0, 4, cycle - 8, cycle - 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shake = Math.sin(frame / 2) * 2;
  const line1 = spring({ frame, fps: 30, config: { damping: 12 }, durationInFrames: 14 });
  const line2 = spring({ frame: Math.max(0, frame - 100), fps: 30, config: { damping: 12 }, durationInFrames: 14 });

  return (
    <AbsoluteFill style={{ background: colors.void }}>
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
          padding: "20px 28px",
          fontFamily: fonts.ui,
          fontSize: 26,
          fontWeight: 600,
          color: colors.textSecondary,
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        📁 {f.label}
      </div>
      <Cursor x={f.x - 6} y={f.y - 6} clicking={localFrame < 6} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 68,
              color: colors.textPrimary,
              opacity: line1,
              transform: `translateY(${(1 - line1) * 20}px)`,
              textShadow: "0 0 40px rgba(0,0,0,0.8)",
            }}
          >
            YOU KNOW THE FILE EXISTS.
          </div>
          {frame >= 100 && (
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 68,
                color: colors.violetGlow,
                opacity: line2,
                transform: `translateY(${(1 - line2) * 20}px)`,
                marginTop: 16,
              }}
            >
              BUT WHERE?
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------- 2. Reveal (120f / 4s) ----------
export function RevealScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bloom = interpolate(frame, [0, 50], [0, 1], { extrapolateRight: "clamp" });
  const wordmarkIn = spring({ frame, fps, config: { damping: 14 }, durationInFrames: 22 });
  const barIn = spring({ frame: frame - 28, fps, config: { damping: 14 }, durationInFrames: 18 });
  const taglineIn = interpolate(frame, [55, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <AuroraBackground intensity={bloom} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{ opacity: wordmarkIn, transform: `translateY(${(1 - wordmarkIn) * 16}px)`, display: "flex", alignItems: "center", gap: 16 }}>
            <Iris state="idle" size={76} />
            <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 52, color: colors.textPrimary, letterSpacing: 1 }}>MAT-AH</span>
          </div>
          {frame >= 28 && (
            <div
              style={{
                opacity: Math.max(0, Math.min(1, barIn)),
                transform: `translateY(${(1 - Math.max(0, Math.min(1, barIn))) * 12}px)`,
                width: 720,
                height: 60,
                borderRadius: 999,
                background: "rgba(22,18,28,0.72)",
                border: `1px solid ${colors.borderStrong}`,
                display: "flex",
                alignItems: "center",
                padding: "0 26px",
                fontFamily: fonts.ui,
                fontSize: 24,
                color: colors.textTertiary,
              }}
            >
              🔍&nbsp;&nbsp;What are you looking for?
            </div>
          )}
          {frame >= 55 && (
            <div style={{ opacity: taglineIn, fontFamily: fonts.ui, fontSize: 22, color: colors.lavender, textAlign: "center" }}>
              Remember what it was, not where you saved it.
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------- shared: agent header row ----------
function AgentHeader({ name, line }: { name: string; line: string }) {
  const frame = useCurrentFrame();
  const in1 = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ opacity: in1, transform: `translateY(${(1 - in1) * -10}px)`, textAlign: "center", marginBottom: 6 }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 30, color: colors.violetGlow }}>{name}</div>
      <div style={{ fontFamily: fonts.ui, fontSize: 18, color: colors.textTertiary }}>{line}</div>
    </div>
  );
}

// ---------- 3. Hanap (270f / 9s) ----------
const QUERY = "Yung PDF tungkol sa enrollment na sinend last week.";

export function HanapScene2() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const irisState = frame < 190 ? "searching" : frame < 210 ? "found" : "celebrating";
  const kindsIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const card1In = interpolate(frame, [190, 206], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const card2In = interpolate(frame, [206, 222], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const docZoom = spring({ frame: Math.max(0, frame - 215), fps, config: { damping: 16 }, durationInFrames: 30 });

  return (
    <AbsoluteFill>
      <AuroraBackground intensity={0.65} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 72 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: 1150 }}>
          <AgentHeader name="Hanap" line="Natural-language search — across documents, images, and videos" />
          <div style={{ display: "flex", gap: 12, opacity: kindsIn }}>
            <Chip>Documents</Chip>
            <Chip>Images</Chip>
            <Chip>Videos</Chip>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
            <div
              style={{
                width: 940,
                height: 68,
                borderRadius: 999,
                background: "rgba(22,18,28,0.72)",
                border: `1px solid ${colors.borderStrong}`,
                display: "flex",
                alignItems: "center",
                padding: "0 28px",
                fontFamily: fonts.ui,
                fontSize: 25,
                color: colors.textPrimary,
                gap: 14,
              }}
            >
              <span>🔍</span>
              {frame < 105 ? <TypedText text={QUERY} fps={fps} charsPerSecond={22} /> : <span>{QUERY}</span>}
            </div>
            <div style={{ transform: "scale(0.78)" }}>
              <Iris state={irisState} size={66} />
            </div>
          </div>

          {frame >= 185 && frame < 215 && (
            <div style={{ display: "flex", gap: 18, marginTop: 6, width: "100%" }}>
              <GlassCard style={{ flex: 1, padding: 22, opacity: card1In, transform: `translateY(${(1 - card1In) * 14}px)`, border: `1.5px solid ${colors.violetGlow}` }}>
                <div style={{ fontFamily: fonts.ui, fontWeight: 600, fontSize: 22, color: colors.textPrimary, marginBottom: 8 }}>
                  📄 Enrollment_Announcement.pdf
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Chip>pdf</Chip>
                  <Chip>best match</Chip>
                </div>
              </GlassCard>
              <GlassCard style={{ flex: 1, padding: 22, opacity: card2In, transform: `translateY(${(1 - card2In) * 14}px)` }}>
                <div style={{ fontFamily: fonts.ui, fontWeight: 600, fontSize: 22, color: colors.textSecondary, marginBottom: 8 }}>
                  🖼 Screenshot_enrollment.jpg
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Chip tone="plain">image</Chip>
                </div>
              </GlassCard>
            </div>
          )}

          {frame >= 215 && (
            <GlassCard style={{ marginTop: 6, padding: 28, width: "100%", opacity: docZoom, transform: `scale(${0.96 + docZoom * 0.04})`, border: `1.5px solid ${colors.violetGlow}` }}>
              <div style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.textTertiary, marginBottom: 10 }}>ENROLLMENT ANNOUNCEMENT — page 1</div>
              <div style={{ fontFamily: fonts.ui, fontSize: 21, color: colors.textSecondary, lineHeight: 1.5 }}>
                Online enrollment opens October 1, 2026.{" "}
                <mark style={{ background: "rgba(124,58,237,0.35)", color: colors.textPrimary, padding: "0 4px", borderRadius: 4 }}>
                  Last day of enrollment: October 24, 2026.
                </mark>
              </div>
            </GlassCard>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------- 4. Sagot (180f / 6s) ----------
const QUESTION = "Kailan ang deadline ng enrollment?";

export function SagotScene2() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const answerIn = interpolate(frame, [48, 76], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const citeIn = spring({ frame: Math.max(0, frame - 100), fps, config: { damping: 14 }, durationInFrames: 14 });

  return (
    <AbsoluteFill>
      <AuroraBackground intensity={0.55} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 1100, display: "flex", flexDirection: "column", gap: 18 }}>
          <AgentHeader name="Sagot" line="Ask a question, get an answer — cited back to the source" />
          <div style={{ fontFamily: fonts.ui, fontSize: 28, fontWeight: 600, color: colors.textPrimary, display: "flex", gap: 12, alignItems: "center" }}>
            <span>💬</span>
            <TypedText text={QUESTION} fps={fps} charsPerSecond={24} />
          </div>
          {frame >= 48 && (
            <GlassCard style={{ padding: 28, opacity: answerIn, transform: `translateY(${(1 - answerIn) * 14}px)` }}>
              <div style={{ fontFamily: fonts.ui, fontSize: 23, color: colors.textSecondary, lineHeight: 1.6 }}>
                The last day of enrollment is <strong style={{ color: colors.textPrimary }}>October 24, 2026</strong>, with a{" "}
                <strong style={{ color: colors.textPrimary }}>₱500.00</strong> late fee after that{" "}
                {frame >= 100 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      borderRadius: 7,
                      background: colors.violet,
                      color: "#fff",
                      fontSize: 15,
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
          {frame >= 120 && (
            <div
              style={{
                opacity: interpolate(frame, [120, 136], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                fontFamily: fonts.mono,
                fontSize: 14,
                color: colors.textTertiary,
                borderLeft: `2px solid ${colors.violet}`,
                paddingLeft: 14,
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

// ---------- 5. Linis (150f / 5s) ----------
export function LinisScene2() {
  const frame = useCurrentFrame();
  const in1 = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const in2 = interpolate(frame, [12, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flag = interpolate(frame, [38, 54], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const reportIn = interpolate(frame, [70, 95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <AuroraBackground intensity={0.4} />
      <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 760, zIndex: 1 }}>
        <AgentHeader name="Linis" line="Finds exact duplicates, zero-byte files, and empty folders" />
        <GlassCard style={{ padding: 18, opacity: in1, transform: `translateX(${(1 - in1) * -20}px)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 18, color: colors.textPrimary }}>IMG_20260814_1930.jpg</span>
          <Chip tone="plain">original</Chip>
        </GlassCard>
        <GlassCard
          style={{
            padding: 18,
            opacity: in2,
            transform: `translateX(${(1 - in2) * 20}px)`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: flag > 0.5 ? `1.5px solid ${colors.ember}` : undefined,
          }}
        >
          <span style={{ fontFamily: fonts.mono, fontSize: 18, color: colors.textPrimary }}>IMG_20260814_1930 (1).jpg</span>
          <span style={{ opacity: flag }}>
            <Chip>exact duplicate · SHA-256</Chip>
          </span>
        </GlassCard>
        {frame >= 70 && (
          <div style={{ opacity: reportIn, fontFamily: fonts.mono, fontSize: 16, color: colors.textTertiary, textAlign: "center" }}>
            Report: 1 exact duplicate · 1 empty folder found
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

// ---------- 6. Kilos (150f / 5s) ----------
export function KilosScene2() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slideIn = spring({ frame, fps, config: { damping: 14 }, durationInFrames: 18 });
  const clicking = frame >= 58 && frame < 64;
  const checked = frame >= 64;
  const undoIn = interpolate(frame, [72, 88], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const before = ["Screenshot_193012.jpg", "GCash_receipt.jpg", "enrollment_form.pdf"];
  const after = ["Receipts/GCash_receipt.jpg", "School/enrollment_form.pdf", "Screenshots/Screenshot_193012.jpg"];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 1000 }}>
        <AgentHeader name="Kilos" line="Proposes a cleanup — moves nothing until you say yes" />
        <div style={{ display: "flex", gap: 36, opacity: slideIn, transform: `translateY(${(1 - slideIn) * 18}px)` }}>
          <GlassCard style={{ flex: 1, padding: 22 }}>
            <div style={{ fontFamily: fonts.ui, fontSize: 16, color: colors.textTertiary, marginBottom: 8 }}>Before</div>
            {before.map((b) => (
              <div key={b} style={{ fontFamily: fonts.mono, fontSize: 17, color: colors.textSecondary, padding: "5px 0" }}>{b}</div>
            ))}
          </GlassCard>
          <div style={{ display: "flex", alignItems: "center", fontSize: 28, color: colors.violetGlow }}>→</div>
          <GlassCard style={{ flex: 1, padding: 22, border: `1px solid ${colors.violetGlow}` }}>
            <div style={{ fontFamily: fonts.ui, fontSize: 16, color: colors.textTertiary, marginBottom: 8 }}>After</div>
            {after.map((a) => (
              <div key={a} style={{ fontFamily: fonts.mono, fontSize: 17, color: colors.textPrimary, padding: "5px 0" }}>{a}</div>
            ))}
          </GlassCard>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", height: 56 }}>
          <div style={{ padding: "12px 32px", borderRadius: 999, background: checked ? colors.local : colors.violet, color: "#0b0910", fontFamily: fonts.ui, fontWeight: 700, fontSize: 20 }}>
            {checked ? "Done" : "Yes"}
          </div>
          {clicking && <Cursor x={36} y={0} clicking />}
          {checked && <Checkmark size={30} />}
          <div style={{ marginLeft: "auto", opacity: undoIn }}>
            <Chip tone="plain">Undo</Chip>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ---------- 7. Tala (150f / 5s) ----------
const NOTE = "The one my teacher sent before enrollment.";

export function TalaScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typing = frame < 70;
  const saveIn = spring({ frame: Math.max(0, frame - 75), fps, config: { damping: 14 }, durationInFrames: 12 });
  const savedCard = interpolate(frame, [90, 106], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const demoIn = interpolate(frame, [115, 135], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <AuroraBackground intensity={0.4} />
      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 820, zIndex: 1 }}>
        <AgentHeader name="Tala" line="Write how you'd remember a file — MAT-AH searches notes too" />
        <GlassCard style={{ padding: 22 }}>
          <div style={{ fontFamily: fonts.ui, fontSize: 15, color: colors.textTertiary, marginBottom: 10 }}>Add a note</div>
          <div
            style={{
              minHeight: 50,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: "12px 16px",
              fontFamily: fonts.ui,
              fontSize: 20,
              color: colors.textPrimary,
            }}
          >
            {typing ? <TypedText text={NOTE} fps={fps} charsPerSecond={22} /> : <span>{NOTE}</span>}
          </div>
          {frame >= 75 && (
            <div
              style={{
                marginTop: 12,
                display: "inline-block",
                opacity: Math.max(0, Math.min(1, saveIn)),
                padding: "9px 20px",
                borderRadius: 999,
                border: `1px solid ${colors.borderStrong}`,
                fontFamily: fonts.ui,
                fontSize: 16,
                color: colors.textSecondary,
              }}
            >
              Save note
            </div>
          )}
        </GlassCard>

        {frame >= 90 && (
          <GlassCard style={{ padding: "14px 20px", opacity: savedCard, border: `1px solid ${colors.local}` }}>
            <span style={{ fontFamily: fonts.ui, fontSize: 17, color: colors.textPrimary }}>"{NOTE}"</span>
            <span style={{ marginLeft: 10 }}>
              <Chip tone="plain">saved</Chip>
            </span>
          </GlassCard>
        )}

        {frame >= 115 && (
          <div style={{ opacity: demoIn, fontFamily: fonts.ui, fontSize: 18, color: colors.lavender, textAlign: "center" }}>
            Now it's searchable — in your own words.
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

// ---------- 8. Iris customization (150f / 5s) ----------
export function IrisScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const swatchesIn = interpolate(frame, [10, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bigIrisIn = spring({ frame: Math.max(0, frame - 55), fps, config: { damping: 13 }, durationInFrames: 18 });
  const labelsIn = interpolate(frame, [80, 105], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bigState = frame < 110 ? "idle" : frame < 130 ? "found" : "celebrating";

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <AuroraBackground intensity={0.5} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 1 }}>
        <AgentHeader name="Iris" line="Your search companion — customize her look and feel" />
        <div style={{ display: "flex", gap: 22, opacity: swatchesIn }}>
          {IRIS_COLOR_PRESETS.map((p) => (
            <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <Iris state="idle" size={42} palette={p.palette} />
              <span style={{ fontFamily: fonts.ui, fontSize: 13, color: colors.textTertiary }}>{p.name}</span>
            </div>
          ))}
        </div>

        <div style={{ opacity: Math.max(0, Math.min(1, bigIrisIn)), transform: `scale(${0.85 + Math.max(0, Math.min(1, bigIrisIn)) * 0.15})`, marginTop: 4 }}>
          <Iris state={bigState} size={96} palette={IRIS_COLOR_PRESETS[4].palette} accessory="gradcap" />
        </div>

        {frame >= 80 && (
          <div style={{ opacity: labelsIn, display: "flex", gap: 12 }}>
            <Chip>Peach</Chip>
            <Chip>Graduation cap</Chip>
            <Chip>Cheerful</Chip>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

// ---------- 9. Outro (450f / 15s) ----------
export function OutroScene2() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const badgeIn = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  const wordmarkIn = spring({ frame: Math.max(0, frame - 60), fps, config: { damping: 11 }, durationInFrames: 26 });
  const taglineIn = interpolate(frame, [110, 145], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const catchphraseIn = spring({ frame: Math.max(0, frame - 175), fps, config: { damping: 9 }, durationInFrames: 20 });
  const fadeOut = interpolate(frame, [420, 450], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <AuroraBackground intensity={1} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
          <div style={{ opacity: badgeIn, display: "flex", gap: 14, fontFamily: fonts.ui, fontSize: 21, color: colors.textSecondary }}>
            <Chip tone="plain">🔒 Files stay on this computer</Chip>
            <Chip tone="plain">⚙ Local AI · gemma4 / embeddinggemma</Chip>
            <Chip tone="plain">✈ Wi-Fi off, still works</Chip>
          </div>
          <div style={{ opacity: wordmarkIn, transform: `translateY(${(1 - wordmarkIn) * 18}px) scale(${0.9 + wordmarkIn * 0.1})`, display: "flex", alignItems: "center", gap: 22, marginTop: 8 }}>
            <Iris state="celebrating" size={104} />
            <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 80, color: colors.textPrimary, letterSpacing: 1 }}>MAT-AH</span>
          </div>
          <div style={{ opacity: taglineIn, fontFamily: fonts.ui, fontSize: 27, color: colors.lavender, textAlign: "center" }}>
            Remember what it was, not where you saved it.
          </div>
          <div
            style={{
              opacity: Math.max(0, Math.min(1, catchphraseIn)),
              transform: `scale(${0.85 + Math.max(0, Math.min(1, catchphraseIn)) * 0.15})`,
              fontFamily: fonts.display,
              fontWeight: 600,
              fontSize: 34,
              color: colors.orchid,
              textAlign: "center",
            }}
          >
            "Ahh, kita ko na!"
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
