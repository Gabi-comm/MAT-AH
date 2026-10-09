/*
  Iris in the rail. The active section shows a tiny looping scene instead of
  a flat marker: waving (Home), detective with a magnifier (Hanap), writing
  (Sagot), jogging on a treadmill (Kilos), sweeping (Linis), tuning a gear
  (Settings). While a search runs, the Hanap scene becomes the drawer toss
  and the glowing-paper reveal. Decorative only: always aria-hidden.
*/
import type { ReactElement } from "react";
import type { Page } from "../hooks/useRoute";
import { usePrefs } from "../prefs/PrefsContext";
import { accessory, Arm, face, hatFor, Iris, IrisSprite } from "./Iris";
import { useIris } from "./IrisContext";
import type { IrisAccessory } from "./iris.types";
import { paletteFor, type IrisPaletteWithOutline } from "./irisPresets";

const W = 46;
const H = 40;
const VIEW = "-16 -14 92 80";

function lookDown(c: string, x1: number, x2: number, y: number) {
  return (
    <g className="iris-eyes">
      <circle cx={x1} cy={y} r="2.7" fill={c} />
      <circle cx={x2} cy={y} r="2.7" fill={c} />
    </g>
  );
}

function scene(page: Page, p: IrisPaletteWithOutline, acc: (a: IrisAccessory) => ReactElement | null, userAcc: IrisAccessory): ReactElement {
  switch (page) {
    case "home":
      return (
        <g className="ns-bob">
          <Arm d="M7 33L1 40" hand={[0, 41]} p={p} />
          <IrisSprite p={p} faceEl={face("idle", "cheerful", p)}>{acc(userAcc)}</IrisSprite>
          <g className="ns-wave">
            <Arm d="M49 32L58 17" hand={[59, 15]} p={p} />
          </g>
        </g>
      );

    case "hanap":
      return (
        <g className="ns-bob">
          <IrisSprite p={p} faceEl={face("curious", "classic", p)}>{acc("detective")}</IrisSprite>
          <g className="ns-lens">
            <Arm d="M49 34L55 38" hand={[56, 39]} p={p} />
            <path d="M56 39L60.5 34.5" stroke="#8A6442" strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="65" cy="29" r="7.5" fill="rgba(205,180,255,0.28)" stroke="#E9D5FF" strokeWidth="2.4" />
            <path d="M61 26.5q2 -3 5 -3" stroke="#FFFFFF" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.85" />
          </g>
        </g>
      );

    case "sagot":
      return (
        <>
          <g className="ns-lean">
            <IrisSprite p={p} faceEl={lookDown(p.face, 24, 36, 32)}>{acc(userAcc)}</IrisSprite>
          </g>
          <polygon points="0,63 58,63 52,44 6,44" fill="#FFFDFB" stroke="#CDB4FF" strokeWidth="1" />
          <g stroke="#A855F7" strokeWidth="1.5" strokeLinecap="round">
            <path className="ns-line ns-line-1" d="M14 49H44" pathLength={1} />
            <path className="ns-line ns-line-2" d="M12 53.5H46" pathLength={1} />
            <path className="ns-line ns-line-3" d="M10 58H40" pathLength={1} />
          </g>
          <g className="ns-pencil">
            <path d="M0 0L2 -4.5L12 -16L15.5 -12.5L4.5 -2Z" fill="#F5C542" stroke="#2A1F38" strokeWidth="0.7" strokeLinejoin="round" />
            <path d="M0 0L2 -4.5L4.5 -2Z" fill="#2A1F38" />
            <circle cx="10" cy="-11" r="3" fill={p.body} stroke={p.outline ?? "rgba(0,0,0,0.3)"} strokeWidth="1" />
          </g>
        </>
      );

    case "kilos":
      return (
        <>
          <path d="M60 60L64 24M64 24L53 26" stroke="#CDB4FF" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path className="ns-sweat" d="M-3 8q-2.4 3.4 0 4.6q2.4 -1.2 0 -4.6Z" fill="#9BD5FF" />
          <g className="ns-jog">
            <g className="ns-swing-a">
              <Arm d="M7 32L2 41" hand={[1.5, 42]} p={p} />
            </g>
            <IrisSprite p={p} faceEl={<>{lookDown(p.face, 22, 34, 28)}<circle cx="28" cy="37" r="1.8" fill={p.face} /></>}>
              {acc("headband")}
            </IrisSprite>
            <g className="ns-swing-b">
              <Arm d="M49 32L54 41" hand={[54.5, 42]} p={p} />
            </g>
          </g>
          <rect x="-10" y="55" width="74" height="7" rx="3.5" fill="#2B2238" stroke="#CDB4FF" strokeWidth="1" />
          <path className="ns-belt" d="M-5 58.5H59" stroke="#8F7BC4" strokeWidth="1.4" strokeDasharray="3 4" />
          <circle cx="-6" cy="58.5" r="1.8" fill="#CDB4FF" />
          <circle cx="60" cy="58.5" r="1.8" fill="#CDB4FF" />
        </>
      );

    case "linis":
      return (
        <>
          <g className="ns-sway">
            <IrisSprite p={p} faceEl={lookDown(p.face, 20, 32, 31)}>{acc(userAcc)}</IrisSprite>
          </g>
          <g fill="#E9D5FF">
            <circle className="ns-dust" cx="14" cy="62" r="2" />
            <circle className="ns-dust" cx="8" cy="59" r="1.6" />
            <circle className="ns-dust" cx="4" cy="63" r="1.3" />
          </g>
          <g className="ns-broom">
            <path d="M57 13L31 57" stroke="#C9A27A" strokeWidth="2.8" strokeLinecap="round" />
            <rect x="27" y="54" width="9" height="4" rx="1" fill="#7C3AED" transform="rotate(30 31.5 56)" />
            <path d="M24 57L39 61L35 68L16 63Z" fill="#F5C542" stroke="#A2420F" strokeWidth="0.8" strokeLinejoin="round" />
            <path d="M22 61l-2 3M27 62l-2 4M32 63l-1.5 3.5" stroke="#A2420F" strokeWidth="0.8" strokeLinecap="round" />
            <Arm d="M50 33L48 26" hand={[47.5, 25]} p={p} />
          </g>
        </>
      );

    case "settings":
    default:
      return (
        <>
          <g className="ns-gear">
            <circle cx="64" cy="10" r="6.5" fill="none" stroke="#CDB4FF" strokeWidth="3.4" strokeDasharray="2.4 2.7" />
            <circle cx="64" cy="10" r="4.2" fill="none" stroke="#CDB4FF" strokeWidth="1.8" />
          </g>
          <g className="ns-bob">
            <IrisSprite p={p} faceEl={face("idle", "curious", p)}>{acc(userAcc)}</IrisSprite>
          </g>
        </>
      );
  }
}

/** The animated Iris shown inside the active rail item. Returns null when Iris is hidden. */
export function NavIris({ page }: { page: Page }) {
  const { prefs } = usePrefs();
  const { state } = useIris();
  if (!prefs.iris.visible) return null;
  const preset = prefs.iris.preset;
  const busy = state === "searching" || state === "found" || state === "celebrating";
  if (page === "hanap" && busy) {
    return <Iris state={state} size={32} preset={preset} accessory="detective" theme="dark" className="nav-iris-live" />;
  }
  const p = paletteFor(preset, "dark");
  const hat = hatFor(preset, "dark");
  const acc = (a: IrisAccessory) => accessory(a, p, hat);
  return (
    <svg className="nav-iris" data-scene={page} width={W} height={H} viewBox={VIEW} aria-hidden="true" focusable="false">
      {scene(page, p, acc, prefs.iris.accessory)}
    </svg>
  );
}
