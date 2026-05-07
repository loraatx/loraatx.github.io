import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinChambers: React.FC = () => (
  <ReportPromo
    title="Chambers of Commerce"
    eyebrow="Austin Metro"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#6f4e37"
    locationCount={5}
    appPath="/apps/reports/austin-chambers"
    bullets={[
      "12 chambers profiled across the metro.",
      "Types: regional hub, affinity chambers, geographic corridors, and young professionals.",
      "Highlights include the Austin Chamber and Austin LGBT Chamber.",
    ]}
  />
);
