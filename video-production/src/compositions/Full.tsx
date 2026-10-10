import { Series } from "remotion";
import { Segment1 } from "./Segment1";
import { Segment2 } from "./Segment2";
import { Segment3 } from "./Segment3";

export function Full() {
  return (
    <Series>
      <Series.Sequence durationInFrames={600}>
        <Segment1 />
      </Series.Sequence>
      <Series.Sequence durationInFrames={600}>
        <Segment2 />
      </Series.Sequence>
      <Series.Sequence durationInFrames={600}>
        <Segment3 />
      </Series.Sequence>
    </Series>
  );
}
