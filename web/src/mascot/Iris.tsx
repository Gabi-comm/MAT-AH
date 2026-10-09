/*
  Iris, the MAT-AH mascot (board 05). A small paper sprite: a file with a
  folded-corner "ear", two dot eyes and stubby feet, drawn flat in the
  chunky puzzle-game style. Pure presentation: no timers, no network.
  Motion comes from CSS keyed on data-state (styles/animations.css).
*/
import { memo, type ReactElement } from "react";
import type { IrisAccessory, IrisExpression, IrisPresetId, IrisState } from "./iris.types";
import { paletteFor, type IrisPaletteWithOutline } from "./irisPresets";

export interface IrisProps {
  state?: IrisState;
  size?: number;
  preset?: IrisPresetId;
  accessory?: IrisAccessory;
  expression?: IrisExpression;
  theme?: "light" | "dark";
  /** Transient idle micro-action chosen by the idle scheduler. */
  idleAct?: "tilt" | "wiggle" | null;
  /** Three-frame hand-drawn boil while idle (full motion only). */
  boil?: boolean;
  /** Accessible name. Omit for decorative use (aria-hidden). */
  label?: string;
  className?: string;
}

const BODY = "M8 50C4 50 4 46 4 40V20C4 10 10 6 20 6H38L52 18V40C52 48 50 50 44 50Z";
const FOLD = "M38 6V15C38 17 39 18 41 18H52Z";

function dots(c: string, x1: number, x2: number, y: number, r: number) {
  return (
    <g className="iris-eyes">
      <circle cx={x1} cy={y} r={r} fill={c} />
      <circle cx={x2} cy={y} r={r} fill={c} />
    </g>
  );
}

function strokes(c: string, d: string, w = 2.6) {
  return (
    <g className="iris-eyes">
      <path d={d} stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" />
    </g>
  );
}

const HAPPY = "M18 30q4 -5 8 0M30 30q4 -5 8 0";
const RELAXED = "M18 29q4 3 8 0M30 29q4 3 8 0";
const CLOSED = "M18 29.5h8M30 29.5h8";
const SMILE = "M24 36q4 4 8 0";

function face(state: IrisState, expression: IrisExpression, p: IrisPaletteWithOutline): ReactElement {
  const c = p.face;
  switch (state) {
    case "searching":
      return (
        <g className="iris-eyes">
          <rect x="18" y="28" width="7" height="3" rx="1.5" fill={c} />
          <rect x="31" y="28" width="7" height="3" rx="1.5" fill={c} />
        </g>
      );
    case "curious":
      return dots(c, 26, 38, 28, 3.2);
    case "thinking":
      return (
        <>
          {dots(c, 23, 35, 25, 2.8)}
          <circle className="iris-dot1" cx="18" cy="-1" r="2.3" fill={p.fold} />
          <circle className="iris-dot2" cx="26" cy="-3" r="2.3" fill={p.fold} />
          <circle className="iris-dot3" cx="34" cy="-1" r="2.3" fill={p.fold} />
        </>
      );
    case "found":
      return (
        <>
          {dots(c, 22, 34, 27, 3.8)}
          <path d={SMILE} stroke={c} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      );
    case "celebrating":
    case "success":
      return (
        <>
          {strokes(c, HAPPY)}
          <path d={SMILE} stroke={c} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      );
    case "no-results":
      return (
        <g className="iris-eyes">
          <circle cx="22" cy="29" r="2.8" fill={c} />
          <path d="M30 29.3h8" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );
    case "planning":
      return dots(c, 25, 37, 31, 2.8);
    case "waiting-for-approval":
      return dots(c, 27, 39, 29, 2.8);
    case "error":
      return (
        <>
          {dots(c, 22, 34, 31, 2.8)}
          <path d="M24 39h8" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    case "unavailable":
      return strokes(c, RELAXED);
    case "resting":
      return strokes(c, CLOSED);
    case "idle":
    default:
      switch (expression) {
        case "cheerful":
          return (
            <>
              {dots(c, 22, 34, 28, 2.8)}
              <path d={SMILE} stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round" />
            </>
          );
        case "curious":
          return dots(c, 25, 37, 28, 3.2);
        case "calm":
          return strokes(c, RELAXED);
        case "classic":
        default:
          return dots(c, 22, 34, 29, 2.8);
      }
  }
}

function accessory(a: IrisAccessory, p: IrisPaletteWithOutline, hat: string): ReactElement | null {
  const ink = p.accent;
  switch (a) {
    case "glasses":
      return (
        <g fill="none" stroke={ink} strokeWidth="1.6">
          <circle cx="22" cy="29" r="5.6" />
          <circle cx="34" cy="29" r="5.6" />
          <path d="M27.6 29h0.8" strokeLinecap="round" />
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d="M5 27C5 1 51 1 51 27" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <rect x="0" y="22" width="8" height="14" rx="3" fill={hat} />
          <rect x="48" y="22" width="8" height="14" rx="3" fill={hat} />
        </g>
      );
    case "gradcap":
      return (
        <g>
          <rect x="17" y="1" width="22" height="7" rx="1.5" fill={ink} />
          <path d="M6 1L28 -7L50 1L28 9Z" fill={ink} />
          <path d="M44 -1V8" stroke={hat} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="44" cy="9.5" r="2" fill={hat} />
        </g>
      );
    case "beanie":
      return (
        <g>
          <path d="M6 15C6 -1 46 -3 50 13Z" fill={hat} />
          <rect x="4" y="11" width="48" height="6" rx="3" fill={ink} opacity="0.85" />
          <circle cx="27" cy="-2" r="4" fill={hat} />
        </g>
      );
    case "bowtie":
      return (
        <g>
          <path d="M19 40L28 44L19 48Z M37 40L28 44L37 48Z" fill={hat} />
          <circle cx="28" cy="44" r="2.2" fill={ink} />
        </g>
      );
    case "headband":
      return (
        <g>
          <rect x="4" y="11" width="48" height="4.5" rx="2.2" fill={hat} />
          <path d="M10 13l-5 -6l8 2Z M10 13l-6 4l7 -1Z" fill={hat} />
        </g>
      );
    case "none":
    default:
      return null;
  }
}

function IrisImpl({
  state = "idle",
  size = 64,
  preset = "classic",
  accessory: acc = "none",
  expression = "classic",
  theme = "light",
  idleAct = null,
  boil = false,
  label,
  className,
}: IrisProps) {
  const p = paletteFor(preset, theme);
  // Hats contrast with the body: violet on warm bodies, ember on cool ones.
  const warm = preset === "classic" || preset === "peach" || preset === "sunshine" || preset === "rose";
  const hat = warm ? (theme === "dark" ? "#9C8CFF" : "#5B3FD6") : "#F28A4E";
  const showReveal = state === "found" || state === "celebrating";
  const outline = p.outline ? { stroke: p.outline, strokeWidth: 1.5, strokeLinejoin: "round" as const } : {};
  return (
    <svg
      className={`iris${className ? ` ${className}` : ""}`}
      width={size}
      height={Math.round((size * 72) / 64)}
      viewBox="-4 -10 64 72"
      data-state={state}
      data-idle-act={state === "idle" && idleAct ? idleAct : undefined}
      data-boil={state === "idle" && boil && !idleAct ? "true" : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {showReveal && (
        <g aria-hidden="true">
          <circle className="iris-ring" cx="28" cy="30" r="30" fill="none" stroke="#F28A4E" strokeWidth="2" />
          <g className="iris-docmark">
            <path d="M52 -6h8l4 4v10h-12z" fill="#FFFDFB" stroke="#17121F" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M54 2h7M54 5h5" stroke="#F28A4E" strokeWidth="1.6" strokeLinecap="round" />
          </g>
          {state === "celebrating" && (
            <g fill="#F28A4E">
              <path className="iris-shape" d="M-2 8l2 -3l2 3l-2 3Z" />
              <path className="iris-shape" d="M58 22l2 -3l2 3l-2 3Z" />
              <path className="iris-shape" d="M2 -4l1.5 -2.5l1.5 2.5l-1.5 2.5Z" />
            </g>
          )}
        </g>
      )}
      {state === "planning" && (
        <g aria-hidden="true">
          <rect className="iris-shape" x="56" y="34" width="7" height="9" rx="1.5" fill="#FFFDFB" stroke="#5B3FD6" strokeWidth="1.2" />
          <rect className="iris-shape" x="58" y="24" width="7" height="9" rx="1.5" fill="#FFFDFB" stroke="#5B3FD6" strokeWidth="1.2" />
          <rect className="iris-shape" x="54" y="44" width="7" height="9" rx="1.5" fill="#FFFDFB" stroke="#5B3FD6" strokeWidth="1.2" />
        </g>
      )}
      <g className="iris-wrap">
        <g className="iris-body" opacity={state === "unavailable" ? 0.6 : 1}>
          <rect x="11" y="48" width="8" height="7" rx="2" fill={p.body} {...outline} />
          <rect x="37" y="48" width="8" height="7" rx="2" fill={p.body} {...outline} />
          <path d={BODY} fill={p.body} {...outline} />
          <path d={FOLD} fill={p.fold} {...outline} />
          <g className="iris-face">{face(state, expression, p)}</g>
          {state === "error" && <path d="M8 2q-3 5 0 7q3 -2 0 -7Z" fill="#C8BCFF" />}
          {acc !== "none" && <g className="iris-acc">{accessory(acc, p, hat)}</g>}
        </g>
      </g>
    </svg>
  );
}

export const Iris = memo(IrisImpl);
