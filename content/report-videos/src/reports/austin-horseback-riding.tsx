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
      "17 riding operations",
      "Trail ranches, lessons & wellness",
      "Southern Trails · Maverick · Willow · Bee Cave Riding",
      "Texas Trail Rides · Tri-Star Farm · Manor Equestrian · etc.",
    ]}
  />
);
