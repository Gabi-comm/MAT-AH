/** Presentation-only mascot states. They never stand in for backend operation states. */
export type IrisState =
  | "idle"
  | "curious"
  | "searching"
  | "thinking"
  | "found"
  | "celebrating"
  | "no-results"
  | "planning"
  | "waiting-for-approval"
  | "success"
  | "error"
  | "unavailable"
  | "resting";

export type IrisPresetId = "classic" | "ube" | "mint" | "midnight" | "peach" | "sunshine" | "rose";

export type IrisAccessory = "none" | "glasses" | "headphones" | "gradcap" | "beanie" | "bowtie" | "headband" | "detective";

export type IrisExpression = "classic" | "cheerful" | "curious" | "calm";

export interface IrisPalette {
  body: string;
  fold: string;
  /** Eyes and mouth. Chosen per preset for contrast against `body`. */
  face: string;
  /** Accessory ink, readable on both themes. */
  accent: string;
}

export interface IrisPreset {
  id: IrisPresetId;
  name: string;
  light: IrisPalette;
  dark: IrisPalette;
}
