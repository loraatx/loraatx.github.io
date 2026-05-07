import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinGolfCourses: React.FC = () => (
  <ReportPromo
    title="Golf in the Austin Region"
    eyebrow="Austin Metro"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#2d7a1a"
    locationCount={20}
    appPath="/apps/reports/austin-golf-courses"
    bullets={[
      "20 golf facilities",
      "Municipal, daily-fee & resort",
      "Lions Municipal · Hancock · Jimmy Clay · Roy Kizer",
      "Morris Williams · Grey Rock · Avery Ranch · etc.",
    ]}
  />
);
