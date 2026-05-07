import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinBikeShops: React.FC = () => (
  <ReportPromo
    title="Bike & E-Bike Shops"
    eyebrow="Austin Shopping"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#2f855a"
    locationCount={5}
    appPath="/apps/reports/austin-bike-shops"
    bullets={[
      "12 bicycle and e-bike shops profiled.",
      "Types: independents, brand chains, a co-op, and e-bike specialists.",
      "Highlights include Austin Tri Cyclist and Austin Bike Farm.",
    ]}
  />
);
