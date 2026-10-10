import { Composition } from "remotion";
import { Segment1 } from "./compositions/Segment1";
import { Segment2 } from "./compositions/Segment2";
import { Segment3 } from "./compositions/Segment3";
import { Full } from "./compositions/Full";
import { FullV2 } from "./compositions/FullV2";
import { FullV3 } from "./compositions/FullV3";

export const RemotionRoot = () => {
  return (
    <>
      <Composition id="Segment1" component={Segment1} width={1920} height={1080} fps={30} durationInFrames={600} />
      <Composition id="Segment2" component={Segment2} width={1920} height={1080} fps={30} durationInFrames={600} />
      <Composition id="Segment3" component={Segment3} width={1920} height={1080} fps={30} durationInFrames={600} />
      <Composition id="Full" component={Full} width={1920} height={1080} fps={30} durationInFrames={1800} />
      <Composition id="FullV2" component={FullV2} width={1920} height={1080} fps={30} durationInFrames={1800} />
      <Composition id="FullV3" component={FullV3} width={1920} height={1080} fps={30} durationInFrames={1800} />
    </>
  );
};
