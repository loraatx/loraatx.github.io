import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinBikeShops: React.FC = () => (
  <ReportPromo
    title="Bike & E-Bike Shops"
    eyebrow="Austin Shopping"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#2f855a"
    locationCount={12}
    appPath="/apps/reports/austin-bike-shops"
    bullets={[
      "12 bike & e-bike shops",
      "Independents, co-op & specialists",
      "Austin Tri Cyclist · Austin Bike Farm · Trek Bicycle",
      "REI Austin · Rocket Electrics · etc.",
    ]}
  />
);
