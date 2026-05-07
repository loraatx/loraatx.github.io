import React from "react";
import { ReportPromo } from "../ReportPromo";

export const PoolOpenings: React.FC = () => (
  <ReportPromo
    title="Austin Pool Openings"
    eyebrow="Austin Parks"
    subtitle="Austin public pools — seasonal openings, locations, and aquatic amenities across the city."
    accentColor="#0ea5e9"
    locationCount={46}
    appPath="/apps/reports/PoolOpenings"
  />
);
