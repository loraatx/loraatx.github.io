import React from "react";
import { Composition } from "remotion";
import { CityIntro } from "./CityIntro";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CityIntro"
      component={CityIntro}
      durationInFrames={185}
      fps={30}
      width={1280}
      height={720}
    />
  );
};
