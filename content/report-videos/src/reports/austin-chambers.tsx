import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinChambers: React.FC = () => (
  <ReportPromo
    title="Austin-Area Chambers of Commerce"
    eyebrow="Austin Metro"
    subtitle="Regional, affinity, and corridor chambers mapped across Greater Austin."
    accentColor="#6f4e37"
    locationCount={5}
    appPath="/apps/reports/austin-chambers"
  />
);
