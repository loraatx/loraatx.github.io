import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinNeighborhoods: React.FC = () => (
  <ReportPromo
    title="Historic and Emerging Neighborhoods of Austin"
    eyebrow="Austin Metro"
    subtitle="A survey of central, historic, and master-planned Austin communities."
    accentColor="#2B6CB0"
    locationCount={8}
    appPath="/apps/reports/austin-neighborhoods"
  />
);
