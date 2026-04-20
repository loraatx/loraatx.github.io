import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinBikeShops: React.FC = () => (
  <ReportPromo
    title="E-Bike and Bicycle Shops in Greater Austin"
    eyebrow="Austin Shopping"
    subtitle="Independent, chain, and e-bike specialist shops across the metro"
    accentColor="#2f855a"
    locationCount={5}
    appPath="apps/citywide/austin-bike-shops"
  />
);
