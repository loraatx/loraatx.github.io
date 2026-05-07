import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinChambers: React.FC = () => (
  <ReportPromo
    title="Chambers of Commerce"
    eyebrow="City Anatomy Free City Government Report"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#6f4e37"
    locationCount={12}
    appPath="/apps/reports/austin-chambers"
    bullets={[
      "12 chambers across the metro",
      "Regional, affinity & corridor orgs",
      "Austin Chamber · LGBT Chamber · West Austin Chamber",
      "Pflugerville · Round Rock · etc.",
    ]}
  />
);
