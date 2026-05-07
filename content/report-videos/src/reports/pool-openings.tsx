import React from "react";
import { ReportPromo } from "../ReportPromo";

export const PoolOpenings: React.FC = () => (
  <ReportPromo
    title="Austin's Public Pool Network"
    eyebrow="Austin Parks"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#0ea5e9"
    locationCount={46}
    appPath="/apps/reports/PoolOpenings"
    bullets={[
      "22 public aquatic facilities mapped.",
      "Types: historic spring-fed pools, competitive lap pools, and modern splash pads.",
      "Highlights include Barton Springs Pool and Deep Eddy Pool.",
    ]}
  />
);
