import React from "react";
import { ReportPromo } from "../ReportPromo";

export const PoolOpenings: React.FC = () => (
  <ReportPromo
    title="Austin's Public Pool Network"
    eyebrow="City Anatomy Free Recreation Report"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#0ea5e9"
    locationCount={46}
    appPath="/apps/reports/PoolOpenings"
    bullets={[
      "22 aquatic facilities mapped",
      "Pools, lap lanes & splash pads",
      "Barton Springs · Deep Eddy · Stacy · Rosewood · Brentwood",
      "Dittmar · Patterson · Bartholomew · Givens · etc.",
    ]}
  />
);
