import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinPs5Bundles: React.FC = () => (
  <ReportPromo
    title="PS5 Slim Bundles in Austin"
    eyebrow="Austin Shopping"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#003087"
    locationCount={18}
    appPath="/apps/reports/austin-ps5-bundles"
    bullets={[
      "18 retail locations across 7 retailers profiled.",
      "Types: big-box chains, warehouse clubs, specialty game stores, and used-game shops.",
      "Highlights include Best Buy North and Target Austin North.",
    ]}
  />
);
