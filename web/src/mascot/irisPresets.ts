/*
  Iris colour presets. "classic" is the approved mascot from board 05.
  Face colours keep at least 6.6:1 against the body. Pale bodies get a thin
  outline on light surfaces (and Midnight on dark) so the silhouette stays
  readable; the approved Classic has no outline, as designed.
*/
import type { IrisPalette, IrisPreset, IrisPresetId } from "./iris.types";

export interface IrisPaletteWithOutline extends IrisPalette {
  outline?: string;
}

interface PresetDef extends Omit<IrisPreset, "light" | "dark"> {
  light: IrisPaletteWithOutline;
  dark: IrisPaletteWithOutline;
}

const INK = "#17121F";
const PORCELAIN = "#F6F3EF";

export const IRIS_PRESETS: PresetDef[] = [
  {
    id: "classic",
    name: "Classic Iris",
    light: { body: "#F28A4E", fold: "#5B3FD6", face: INK, accent: INK },
    dark: { body: "#F28A4E", fold: "#C8BCFF", face: "#0E0A18", accent: PORCELAIN },
  },
  {
    id: "ube",
    name: "Ube Iris",
    light: { body: "#9C8CFF", fold: "#3F2AA6", face: INK, accent: INK },
    dark: { body: "#9C8CFF", fold: "#ECE7FF", face: "#0E0A18", accent: PORCELAIN },
  },
  {
    id: "mint",
    name: "Mint Iris",
    light: { body: "#7EDCB5", fold: "#23784A", face: INK, accent: INK, outline: INK },
    dark: { body: "#7EDCB5", fold: "#E3F1E8", face: "#0E0A18", accent: PORCELAIN },
  },
  {
    id: "midnight",
    name: "Midnight Iris",
    light: { body: "#2A2150", fold: "#F28A4E", face: PORCELAIN, accent: INK },
    dark: { body: "#3A2F70", fold: "#F28A4E", face: PORCELAIN, accent: PORCELAIN, outline: "#C8BCFF" },
  },
  {
    id: "peach",
    name: "Peach Iris",
    light: { body: "#F6B49A", fold: "#A2420F", face: INK, accent: INK, outline: INK },
    dark: { body: "#F6B49A", fold: "#FDE3D2", face: "#0E0A18", accent: PORCELAIN },
  },
  {
    id: "sunshine",
    name: "Sunshine Iris",
    light: { body: "#F5C542", fold: "#A2420F", face: INK, accent: INK, outline: INK },
    dark: { body: "#F5C542", fold: "#FDE3D2", face: "#0E0A18", accent: PORCELAIN },
  },
  {
    id: "rose",
    name: "Rose Iris",
    light: { body: "#F07C7C", fold: "#5B3FD6", face: INK, accent: INK },
    dark: { body: "#F07C7C", fold: "#FDE3D2", face: "#0E0A18", accent: PORCELAIN },
  },
];

export function paletteFor(id: IrisPresetId, theme: "light" | "dark"): IrisPaletteWithOutline {
  const p = IRIS_PRESETS.find((x) => x.id === id) ?? IRIS_PRESETS[0];
  return theme === "dark" ? p.dark : p.light;
}

export const ACCESSORY_LABELS = {
  none: "None",
  glasses: "Tiny glasses",
  headphones: "Headphones",
  gradcap: "Graduation cap",
  beanie: "Mini beanie",
  bowtie: "Bow tie",
  headband: "Headband",
  detective: "Detective hat",
} as const;

export const EXPRESSION_LABELS = {
  classic: "Classic",
  cheerful: "Cheerful",
  curious: "Curious",
  calm: "Calm",
} as const;
