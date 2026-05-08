import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinToyStores: React.FC = () => (
  <ReportPromo
    title="Toy Stores & Children's Specialty Retailers"
    eyebrow="City Anatomy Free Report: AUSTIN SHOPPING - Toy Stores"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#d4380d"
    locationCount={8}
    appPath="/apps/reports/austin-toy-stores"
    bullets={[
      "8 toy stores across Greater Austin",
      "Independent · Educational · Collectible · Closed",
      "Terra Toys · Toy Joy · Lakeshore Learning",
      "Monkey See Monkey Do · Over the Rainbow · etc.",
    ]}
  />
);
