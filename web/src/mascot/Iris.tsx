/*
  Iris, the MAT-AH mascot (board 05). A small paper sprite: a file with a
  folded-corner "ear", two dot eyes and stubby feet, drawn flat in the
  chunky puzzle-game style. Pure presentation: no network. The only timer
  re-pops the search drawer at a random spot while she is searching.
  Motion comes from CSS keyed on data-state (styles/animations.css).
*/
import { memo, useEffect, useId, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
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

export const BODY = "M8 50C4 50 4 46 4 40V20C4 10 10 6 20 6H38L52 18V40C52 48 50 50 44 50Z";
export const FOLD = "M38 6V15C38 17 39 18 41 18H52Z";

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

export function face(state: IrisState, expression: IrisExpression, p: IrisPaletteWithOutline): ReactElement {
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

export function accessory(a: IrisAccessory, p: IrisPaletteWithOutline, hat: string): ReactElement | null {
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
    case "detective":
      return (
        <g>
          <path d="M9 10C9 -5 47 -5 47 10Z" fill="#C9A27A" />
          <path d="M9 10C11 2 18 -2 26 -3C20 0 15 4 14 10Z" fill="#E0BE96" />
          <rect x="9" y="5" width="38" height="4.5" rx="1.2" fill="#3B2A4D" />
          <path d="M1 10.5H55Q51 15 45 13.5H11Q5 15 1 10.5Z" fill="#8A6442" />
          <circle cx="28" cy="-3.2" r="1.8" fill="#8A6442" />
        </g>
      );
    case "none":
    default:
      return null;
  }
}

/** Hat colour that contrasts with the body: violet on warm bodies, ember on cool ones. */
export function hatFor(preset: IrisPresetId, theme: "light" | "dark"): string {
  const warm = preset === "classic" || preset === "peach" || preset === "sunshine" || preset === "rose";
  return warm ? (theme === "dark" ? "#9C8CFF" : "#5B3FD6") : "#F28A4E";
}

type Outline = { stroke?: string; strokeWidth?: number; strokeLinejoin?: "round" };

function outlineFor(p: IrisPaletteWithOutline): Outline {
  return p.outline ? { stroke: p.outline, strokeWidth: 1.5, strokeLinejoin: "round" } : {};
}

/** Feet, body, folded ear and face. Shared by the header Iris and the rail scenes. */
export function IrisSprite({ p, faceEl, dim = false, children }: { p: IrisPaletteWithOutline; faceEl: ReactElement; dim?: boolean; children?: ReactNode }) {
  const o = outlineFor(p);
  return (
    <g className="iris-body" opacity={dim ? 0.6 : 1}>
      <rect className="iris-foot-l" x="11" y="48" width="8" height="7" rx="2" fill={p.body} {...o} />
      <rect className="iris-foot-r" x="37" y="48" width="8" height="7" rx="2" fill={p.body} {...o} />
      <path d={BODY} fill={p.body} {...o} />
      <path d={FOLD} fill={p.fold} {...o} />
      <g className="iris-face">{faceEl}</g>
      {children}
    </g>
  );
}

/** A stubby arm: a rounded stroke in the body colour with a round hand. */
export function Arm({ d, hand, p, className }: { d: string; hand: [number, number]; p: IrisPaletteWithOutline; className?: string }) {
  const edge = p.outline ?? "rgba(0,0,0,0.3)";
  return (
    <g className={className}>
      <path d={d} stroke={edge} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d={d} stroke={p.body} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <circle cx={hand[0]} cy={hand[1]} r="2.9" fill={p.body} stroke={edge} strokeWidth="1" />
    </g>
  );
}

/* ---------- Searching: a drawer pops up in front and she tosses papers in ---------- */

const DRAWER_SPOTS = [-12, -5, 4, 12];

interface DrawerSpot {
  x: number;
  n: number;
  delay: number;
}

function randomSpot(prev?: DrawerSpot): DrawerSpot {
  const choices = prev ? DRAWER_SPOTS.filter((x) => x !== prev.x) : DRAWER_SPOTS;
  return {
    x: choices[Math.floor(Math.random() * choices.length)],
    n: (prev?.n ?? 0) + 1,
    delay: prev ? 0 : Math.round(Math.random() * 350),
  };
}

/** Picks a random spot for the drawer, then re-pops it somewhere else every few seconds. */
function useDrawerSpot(active: boolean): DrawerSpot {
  const [spot, setSpot] = useState<DrawerSpot>(() => randomSpot());
  useEffect(() => {
    if (!active) return;
    setSpot(randomSpot());
    let t = 0;
    const next = () => {
      t = window.setTimeout(() => {
        setSpot((s) => randomSpot(s));
        next();
      }, 2200 + Math.random() * 1400);
    };
    next();
    return () => window.clearTimeout(t);
  }, [active]);
  return spot;
}

function Paper({ x, y, w = 8, h = 10 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="1.2" fill="#FFFDFB" stroke="#2A1F38" strokeWidth="0.8" />
      <path d={`M${x + 2} ${y + 3}h${w - 4}M${x + 2} ${y + 5.5}h${w - 4}M${x + 2} ${y + 8}h${w - 5}`} stroke="#A855F7" strokeWidth="0.9" strokeLinecap="round" />
    </>
  );
}

function SearchProps({ p, spot }: { p: IrisPaletteWithOutline; spot: DrawerSpot }) {
  // Papers leave her hand (about 58,15) and land in the open drawer top.
  const dx = 28 + spot.x - 58;
  const toss = (i: number) => ({ "--dx": `${dx}px`, "--dy": "22px", animationDelay: `${spot.delay + 220 + i * 360}ms` }) as CSSProperties;
  return (
    <g aria-hidden="true">
      <Arm className="iris-arm-toss" d="M50 31L57 21" hand={[58, 19.5]} p={p} />
      {[0, 1, 2].map((i) => (
        <g key={`${spot.n}-${i}`} className="iris-toss" style={toss(i)}>
          <Paper x={54} y={10} />
        </g>
      ))}
      <g key={spot.n} transform={`translate(${spot.x} 0)`}>
        <g className="iris-drawer" style={{ animationDelay: `${spot.delay}ms` }}>
          <rect x="8" y="33" width="40" height="7" rx="1.5" fill="#1B1424" stroke="#CDB4FF" strokeWidth="1" />
          <path d="M14 35.5h6l2 -3h8l2 3h6" stroke="#FFFDFB" strokeWidth="1.2" fill="none" opacity="0.85" />
          <rect x="6" y="38" width="44" height="19" rx="3" fill="#3D2A5C" stroke="#CDB4FF" strokeWidth="1.1" />
          <rect x="10" y="41" width="36" height="13" rx="2" fill="#4B3570" />
          <rect x="21" y="46" width="14" height="3.4" rx="1.7" fill="#CDB4FF" />
          <rect x="24" y="42.6" width="8" height="2" rx="0.6" fill="#FFFDFB" opacity="0.8" />
        </g>
      </g>
    </g>
  );
}

/* ---------- Found: she lifts a glowing paper and three spark lines burst above it ---------- */

function PrizeProps({ p, gid }: { p: IrisPaletteWithOutline; gid: string }) {
  return (
    <g aria-hidden="true">
      <g className="iris-prize">
        <circle className="iris-glow" cx="28" cy="-14" r="17" fill={`url(#${gid})`} />
        <g className="iris-paper-lit">
          <rect x="19.5" y="-24" width="17" height="21" rx="2" fill="#FFFDFB" stroke="#E9D5FF" strokeWidth="1" />
          <path d="M23 -18.5h10M23 -14.5h10M23 -10.5h7" stroke="#A855F7" strokeWidth="1.4" strokeLinecap="round" />
        </g>
        <g stroke="#F5D0FE" strokeWidth="2" strokeLinecap="round" fill="none">
          <path className="iris-spark" d="M28 -28V-38" />
          <path className="iris-spark" d="M21 -26.5L14.5 -33" />
          <path className="iris-spark" d="M35 -26.5L41.5 -33" />
        </g>
      </g>
      <Arm className="iris-arm-up" d="M8 30Q2 14 19 -4" hand={[20, -5]} p={p} />
      <Arm className="iris-arm-up" d="M48 30Q54 14 37 -4" hand={[36, -5]} p={p} />
    </g>
  );
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
  const hat = hatFor(preset, theme);
  const reveal = state === "found" || state === "celebrating";
  const searching = state === "searching";
  const spot = useDrawerSpot(searching);
  const gid = `iris-glow-${useId().replace(/:/g, "")}`;
  return (
    <svg
      className={`iris${className ? ` ${className}` : ""}`}
      width={size}
      height={Math.round((size * 72) / 64)}
      viewBox="-4 -10 64 72"
      data-state={state}
      data-reveal={reveal ? "true" : undefined}
      data-idle-act={state === "idle" && idleAct ? idleAct : undefined}
      data-boil={state === "idle" && boil && !idleAct ? "true" : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {reveal && (
        <defs>
          <radialGradient id={gid}>
            <stop offset="0%" stopColor="#F5D0FE" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#C084FC" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
          </radialGradient>
        </defs>
      )}
      {state === "celebrating" && (
        <g fill="#E879F9" aria-hidden="true">
          <path className="iris-shape" d="M-2 8l2 -3l2 3l-2 3Z" />
          <path className="iris-shape" d="M58 22l2 -3l2 3l-2 3Z" />
          <path className="iris-shape" d="M2 -4l1.5 -2.5l1.5 2.5l-1.5 2.5Z" />
        </g>
      )}
      {state === "planning" && (
        <g aria-hidden="true">
          <rect className="iris-shape" x="56" y="34" width="7" height="9" rx="1.5" fill="#FFFDFB" stroke="#7C3AED" strokeWidth="1.2" />
          <rect className="iris-shape" x="58" y="24" width="7" height="9" rx="1.5" fill="#FFFDFB" stroke="#7C3AED" strokeWidth="1.2" />
          <rect className="iris-shape" x="54" y="44" width="7" height="9" rx="1.5" fill="#FFFDFB" stroke="#7C3AED" strokeWidth="1.2" />
        </g>
      )}
      <g className="iris-wrap">
        <IrisSprite p={p} faceEl={face(state, expression, p)} dim={state === "unavailable"}>
          {state === "error" && <path d="M8 2q-3 5 0 7q3 -2 0 -7Z" fill="#C8BCFF" />}
          {acc !== "none" && <g className="iris-acc">{accessory(acc, p, hat)}</g>}
        </IrisSprite>
        {reveal && <PrizeProps p={p} gid={gid} />}
      </g>
      {searching && <SearchProps p={p} spot={spot} />}
    </svg>
  );
}

export const Iris = memo(IrisImpl);
