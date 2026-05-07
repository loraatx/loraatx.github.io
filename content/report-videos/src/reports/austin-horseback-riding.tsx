import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinHorsebackRiding: React.FC = () => (
  <ReportPromo
    title="Horseback Riding in Greater Austin"
    eyebrow="Austin Metro"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#8B4513"
    locationCount={17}
    appPath="/apps/reports/austin-horseback-riding"
    bullets={[
      "17 riding operations profiled within an hour of downtown.",
      "Types: guided trail ranches, lesson barns, and a luxury wellness resort.",
      "Highlights include Southern Trails and Miraval Austin.",
    ]}
  />
);
