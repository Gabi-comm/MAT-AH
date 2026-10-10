import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { useMatahFonts } from "../lib/Fonts";
import { colors, fonts } from "../lib/tokens";
import { HanapScene2, IrisScene, KilosScene2, LinisScene2, SagotScene2, TalaScene } from "./v2";
import { OutroSceneV3, ProblemSceneV3, RevealSceneV3 } from "./v3";

// Visual scene boundaries (frames @30fps). Sums to 1800 (60s). Durations were
// built around the real spoken lengths of the V3 narration (see NARRATION
// below), not the other way around.
const SCENES = [
  { Comp: ProblemSceneV3, from: 0, dur: 225 },
  { Comp: RevealSceneV3, from: 225, dur: 105 },
  { Comp: HanapScene2, from: 330, dur: 270 },
  { Comp: SagotScene2, from: 600, dur: 195 },
  { Comp: LinisScene2, from: 795, dur: 135 },
  { Comp: KilosScene2, from: 930, dur: 150 },
  { Comp: TalaScene, from: 1080, dur: 180 },
  { Comp: IrisScene, from: 1260, dur: 150 },
  { Comp: OutroSceneV3, from: 1410, dur: 390 },
];

// One continuous recording ("Mah-ta" substituted for "MAT-AH" so Kokoro says
// the Filipino "mata" sound, never spelled-out letters), sliced at its real
// sentence pauses (ffmpeg silencedetect) and placed near the start of the
// matching visual beat.
const NARRATION: { file: string; from: number; dur: number }[] = [
  { file: "A.wav", from: 15, dur: 192 }, // "Ever spent minutes...where it is."
  { file: "B.wav", from: 237, dur: 69 }, // "Meet Mah-ta."
  { file: "C.wav", from: 342, dur: 156 }, // "Mah-ta finds it...That's Hanap."
  { file: "D.wav", from: 612, dur: 134 }, // Sagot
  { file: "E.wav", from: 807, dur: 44 }, // Linis
  { file: "F.wav", from: 939, dur: 197 }, // Kilos + Tala (spans both scenes)
  { file: "G.wav", from: 1269, dur: 92 }, // Iris
  { file: "H.wav", from: 1422, dur: 139 }, // privacy/local AI
  { file: "I.wav", from: 1572, dur: 58 }, // "Mah-ta."
  { file: "J.wav", from: 1638, dur: 145 }, // tagline + catchphrase
];

function MusicBed() {
  const frame = useCurrentFrame();
  const inWindow = NARRATION.some((n) => frame >= n.from - 6 && frame < n.from + n.dur + 6);
  const volume = inWindow ? 0.07 : 0.22;
  return <Audio src={staticFile("audio/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3")} volume={volume} />;
}

export function FullV3() {
  useMatahFonts();
  return (
    <AbsoluteFill style={{ background: colors.void, fontFamily: fonts.ui, color: colors.textPrimary }}>
      {SCENES.map(({ Comp, from, dur }, i) => (
        <Sequence key={i} from={from} durationInFrames={dur}>
          <Comp />
        </Sequence>
      ))}

      <MusicBed />

      {NARRATION.map((n) => (
        <Sequence key={n.file} from={n.from} durationInFrames={n.dur}>
          <Audio src={staticFile(`audio/narr-v3/${n.file}`)} volume={1} />
        </Sequence>
      ))}

      {/* sparse SFX: confirm tap on Kilos "Yes" (scene.from 930 + local 58), soft bong on the outro wordmark landing (scene.from 1410 + local 86) */}
      <Sequence from={988} durationInFrames={20}>
        <Audio src={staticFile("audio/sfx/click1.ogg")} volume={0.6} />
      </Sequence>
      <Sequence from={1496} durationInFrames={30}>
        <Audio src={staticFile("audio/sfx/bong_001.ogg")} volume={0.45} />
      </Sequence>
    </AbsoluteFill>
  );
}
