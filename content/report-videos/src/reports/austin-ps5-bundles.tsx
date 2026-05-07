import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinPs5Bundles: React.FC = () => (
  <ReportPromo
    title="PS5 Slim Bundles in Austin"
    eyebrow="City Anatomy Free Shopping Report"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#003087"
    locationCount={18}
    appPath="/apps/reports/austin-ps5-bundles"
    bullets={[
      "18 locations across 7 retailers",
      "Big box, warehouse & game stores",
      "Best Buy · Target · Walmart · Costco · Sam's Club",
      "GameStop · Game Over · etc.",
    ]}
  />
);
