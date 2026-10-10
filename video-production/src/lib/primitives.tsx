import type { CSSProperties, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "./tokens";

/** The near-black canvas + plum/violet aurora glow pool ("Obsidian Iris"). */
export function AuroraBackground({ intensity = 1 }: { intensity?: number }) {
  const frame = useCurrentFrame();
  const breathe = 0.85 + Math.sin(frame / 50) * 0.15 * intensity;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: colors.void,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "62%",
          width: 1400,
          height: 900,
          transform: `translate(-50%, -50%) scale(${breathe})`,
          background: `radial-gradient(ellipse at 50% 50%, ${colors.auroraVioletHi} 0%, ${colors.auroraViolet} 32%, ${colors.auroraIndigo} 58%, transparent 80%)`,
          filter: "blur(40px)",
          opacity: 0.8 * intensity,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "28%",
          top: "30%",
          width: 700,
          height: 500,
          background: `radial-gradient(circle, ${colors.auroraWarm} 0%, transparent 70%)`,
          filter: "blur(60px)",
          opacity: 0.35 * intensity,
        }}
      />
    </div>
  );
}

/** Low, unobtrusive burned-in caption line (matches the plan's low-caption cues). */
export function Caption({ text, style }: { text: string; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 64,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: fonts.ui,
        fontSize: 30,
        fontWeight: 500,
        color: colors.textSecondary,
        opacity,
        letterSpacing: 0.2,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

/** Reveals `text` progressively, `charsPerSecond` characters per second, from the frame it mounts. */
export function TypedText({
  text,
  charsPerSecond = 18,
  fps,
  style,
  cursor = true,
}: {
  text: string;
  charsPerSecond?: number;
  fps: number;
  style?: CSSProperties;
  cursor?: boolean;
}) {
  const frame = useCurrentFrame();
  const chars = Math.max(0, Math.min(text.length, Math.floor((frame / fps) * charsPerSecond)));
  const shown = text.slice(0, chars);
  const done = chars >= text.length;
  return (
    <span style={style}>
      {shown}
      {cursor && !done && <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>|</span>}
    </span>
  );
}

export function Chip({ children, tone = "violet" }: { children: ReactNode; tone?: "violet" | "plain" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 14px",
        borderRadius: 999,
        fontFamily: fonts.ui,
        fontSize: 20,
        fontWeight: 500,
        background: tone === "violet" ? "rgba(124,58,237,0.18)" : colors.glassHi,
        color: tone === "violet" ? colors.lavender : colors.textSecondary,
        border: `1px solid ${tone === "violet" ? "rgba(124,58,237,0.4)" : colors.border}`,
      }}
    >
      {children}
    </span>
  );
}

export function GlassCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.glassEdge}`,
        borderRadius: 24,
        backdropFilter: "blur(10px)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A small filled dot standing in for a cursor, with an optional click-pulse ring. */
export function Cursor({ x, y, clicking = false }: { x: number; y: number; clicking?: boolean }) {
  const frame = useCurrentFrame();
  const pulse = clicking ? interpolate(frame % 20, [0, 20], [0, 1]) : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}>
      {clicking && (
        <div
          style={{
            position: "absolute",
            left: -18 * pulse,
            top: -18 * pulse,
            width: 36 * pulse,
            height: 36 * pulse,
            borderRadius: "50%",
            border: `2px solid ${colors.violetGlow}`,
            opacity: 1 - pulse,
          }}
        />
      )}
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: colors.textPrimary,
          border: `2px solid ${colors.violet}`,
          boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
}

export function Checkmark({ size = 48 }: { size?: number }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill={colors.local} opacity={0.18} />
      <path
        d="M6 12.5l4 4 8-9"
        fill="none"
        stroke={colors.local}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="20"
        strokeDashoffset={20 - 20 * progress}
      />
    </svg>
  );
}
