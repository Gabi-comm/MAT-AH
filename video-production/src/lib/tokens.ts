// Mirrors MAT-AH's real design tokens (src/styles/tokens.css, dark theme — "Obsidian Iris").
export const colors = {
  void: "#050407",
  canvas: "#020104",
  pupil: "#0b0910",
  night: "#141019",
  night2: "#1d1724",
  plum: "#2a1433",
  plum2: "#3d1d4a",

  textPrimary: "#f4f0f7",
  textSecondary: "#b4abc0",
  textTertiary: "#8d849a",

  violet: "#7c3aed",
  violetHover: "#8b4cf7",
  violetGlow: "#a855f7",
  lavender: "#cdb4ff",
  lavSoft: "#efe7ff",
  orchid: "#e879f9",
  ember: "#f28a4e",
  local: "#7ee0a8",

  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  glassHi: "rgba(255,255,255,0.06)",
  glassEdge: "rgba(255,255,255,0.09)",
  surface: "rgba(22,18,28,0.72)",
  surfaceElevated: "#17131d",

  auroraWarm: "rgba(236,170,160,0.85)",
  auroraPurple: "rgba(150,100,200,0.7)",
  auroraIndigo: "rgba(52,30,130,0.75)",
  auroraViolet: "rgba(120,60,200,0.6)",
  auroraVioletHi: "rgba(180,130,245,0.85)",
} as const;

export const fonts = {
  display: "'Space Grotesk', 'Segoe UI', system-ui, sans-serif",
  ui: "'Geist', 'Segoe UI Variable', system-ui, sans-serif",
  mono: "'Geist Mono', 'Cascadia Mono', Consolas, ui-monospace, monospace",
} as const;

export const ease = {
  aperture: [0.2, 0.8, 0.2, 1] as const,
  settle: [0.3, 0, 0.1, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
};
