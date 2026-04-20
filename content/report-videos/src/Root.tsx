import React from "react";
import { Composition } from "remotion";
import { AustinBikeShops } from "./reports/austin-bike-shops";

// 170 frames = ~5.7 seconds at 30fps — punchy promo length
const DURATION = 170;
const FPS = 30;
const WIDTH = 1280;
const HEIGHT = 720;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="austin-bike-shops"
      component={AustinBikeShops}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);
