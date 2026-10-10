import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { useMatahFonts } from "./Fonts";
import { fonts, colors } from "./tokens";

/** Common wrapper every segment root uses: loads MAT-AH's real fonts, sets the base canvas. */
export function Scene({ children }: { children: ReactNode }) {
  useMatahFonts();
  return (
    <AbsoluteFill style={{ background: colors.void, fontFamily: fonts.ui, color: colors.textPrimary }}>
      {children}
    </AbsoluteFill>
  );
}
