import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { useMatahFonts } from "../lib/Fonts";
import { colors, fonts } from "../lib/tokens";
import {
  HanapScene2,
  IrisScene,
  KilosScene2,
  LinisScene2,
  OutroScene2,
  ProblemScene,
  RevealScene,
  SagotScene2,
  TalaScene,
} from "./v2";

// Visual scene boundaries (frames @30fps). Sums to 1800 (60s).
const SCENES = [
  { Comp: ProblemScene, from: 0, dur: 180 },
  { Comp: RevealScene, from: 180, dur: 120 },
  { Comp: HanapScene2, from: 300, dur: 270 },
  { Comp: SagotScene2, from: 570, dur: 180 },
  { Comp: LinisScene2, from: 750, dur: 150 },
  { Comp: KilosScene2, from: 900, dur: 150 },
  { Comp: TalaScene, from: 1050, dur: 150 },
  { Comp: IrisScene, from: 1200, dur: 150 },
  { Comp: OutroScene2, from: 1350, dur: 450 },
];

// One continuous narration recording, sliced at its natural sentence pauses
// (see video-production notes: detected via ffmpeg silencedetect) and placed
// near the start of the matching visual beat — scene timing was built around
// these real spoken durations, not the other way around.
const NARRATION: { file: string; from: number; dur: number }[] = [
  { file: "A.wav", from: 21, dur: 77 },
  { file: "B.wav", from: 198, dur: 268 },
  { file: "C.wav", from: 588, dur: 152 },
  { file: "D.wav", from: 768, dur: 62 },
  { file: "E.wav", from: 918, dur: 92 },
  { file: "F.wav", from: 1062, dur: 132 },
  { file: "G.wav", from: 1209, dur: 108 },
  { file: "H.wav", from: 1359, dur: 159 },
  { file: "I.wav", from: 1527, dur: 265 },
];

function MusicBed() {
  const frame = useCurrentFrame();
  const inWindow = NARRATION.some((n) => frame >= n.from - 6 && frame < n.from + n.dur + 6);
  const volume = inWindow ? 0.07 : 0.22;
  return <Audio src={staticFile("audio/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3")} volume={volume} />;
}

export function FullV2() {
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
          <Audio src={staticFile(`audio/narr/${n.file}`)} volume={1} />
        </Sequence>
      ))}

      {/* sparse SFX: confirm tap on Kilos "Yes" (scene-local frame 58 + scene.from 900), soft bong on the outro wordmark landing (scene-local ~86 + scene.from 1350) */}
      <Sequence from={958} durationInFrames={20}>
        <Audio src={staticFile("audio/sfx/click1.ogg")} volume={0.6} />
      </Sequence>
      <Sequence from={1434} durationInFrames={30}>
        <Audio src={staticFile("audio/sfx/bong_001.ogg")} volume={0.45} />
      </Sequence>
    </AbsoluteFill>
  );
}
