import React from "react";
import { Composition } from "remotion";
import { AustinBikeShops } from "./reports/austin-bike-shops";
import { AustinChambers } from "./reports/austin-chambers";
import { AustinGolfCourses } from "./reports/austin-golf-courses";
import { AustinHorsebackRiding } from "./reports/austin-horseback-riding";
import { AustinNeighborhoods } from "./reports/austin-neighborhoods";
import { AustinPs5Bundles } from "./reports/austin-ps5-bundles";
import { AustinToyStores } from "./reports/austin-toy-stores";
import { AustinVintageGuitar } from "./reports/austin-vintage-guitar";
import { PoolOpenings } from "./reports/pool-openings";

// 300 frames = 10 seconds at 30fps
const DURATION = 300;
const FPS = 30;
const WIDTH = 1280;
const HEIGHT = 720;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="austin-bike-shops"      component={AustinBikeShops}      durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="austin-chambers"        component={AustinChambers}        durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="austin-golf-courses"    component={AustinGolfCourses}     durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="austin-horseback-riding" component={AustinHorsebackRiding} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="austin-neighborhoods"   component={AustinNeighborhoods}   durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="austin-ps5-bundles"     component={AustinPs5Bundles}      durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="austin-toy-stores"      component={AustinToyStores}       durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="austin-vintage-guitar"  component={AustinVintageGuitar}   durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="pool-openings"          component={PoolOpenings}          durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);
