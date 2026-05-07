import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinGolfCourses: React.FC = () => (
  <ReportPromo
    title="Golf in the Austin Region"
    eyebrow="Austin Metro"
    subtitle="Municipal munis, Hill Country resorts, and 120 years of Austin golf history."
    accentColor="#2d7a1a"
    locationCount={20}
    appPath="/apps/reports/austin-golf-courses"
  />
);
