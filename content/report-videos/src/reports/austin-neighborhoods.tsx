import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinNeighborhoods: React.FC = () => (
  <ReportPromo
    title="Historic & Emerging Neighborhoods"
    eyebrow="Austin Metro"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#2B6CB0"
    locationCount={8}
    appPath="/apps/reports/austin-neighborhoods"
    bullets={[
      "33 Austin neighborhoods surveyed.",
      "Eras: freedmen's settlements, streetcar suburbs, postwar bungalow districts, and master-planned communities.",
      "Highlights include Clarksville and Mueller.",
    ]}
  />
);
