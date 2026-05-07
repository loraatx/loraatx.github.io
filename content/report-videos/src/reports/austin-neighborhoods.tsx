import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinNeighborhoods: React.FC = () => (
  <ReportPromo
    title="Historic & Emerging Neighborhoods"
    eyebrow="City Anatomy Free Report: AUSTIN CITY GOVERNMENT - Neighborhoods"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#2B6CB0"
    locationCount={33}
    appPath="/apps/reports/austin-neighborhoods"
    bullets={[
      "33 Austin neighborhoods",
      "Historic districts to new suburbs",
      "Downtown · Hyde Park · Travis Heights · Zilker · Mueller",
      "The Domain · Circle C · Easton Park · etc.",
    ]}
  />
);
