import { useEffect } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

const FACES: { family: string; weight: string; file: string }[] = [
  { family: "Space Grotesk", weight: "400", file: "space-grotesk-latin-400-normal.woff2" },
  { family: "Space Grotesk", weight: "500", file: "space-grotesk-latin-500-normal.woff2" },
  { family: "Space Grotesk", weight: "700", file: "space-grotesk-latin-700-normal.woff2" },
  { family: "Geist", weight: "400", file: "geist-latin-400-normal.woff2" },
  { family: "Geist", weight: "500", file: "geist-latin-500-normal.woff2" },
  { family: "Geist", weight: "600", file: "geist-latin-600-normal.woff2" },
  { family: "Geist Mono", weight: "400", file: "geist-mono-latin-400-normal.woff2" },
  { family: "Geist Mono", weight: "500", file: "geist-mono-latin-500-normal.woff2" },
];

let fontsReadyPromise: Promise<void> | null = null;

function loadAllFonts(): Promise<void> {
  if (!fontsReadyPromise) {
    fontsReadyPromise = Promise.all(
      FACES.map(async (f) => {
        const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)})`, { weight: f.weight });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return fontsReadyPromise;
}

export function useMatahFonts() {
  useEffect(() => {
    const handle = delayRender("Loading MAT-AH fonts");
    loadAllFonts().then(() => continueRender(handle));
  }, []);
}
