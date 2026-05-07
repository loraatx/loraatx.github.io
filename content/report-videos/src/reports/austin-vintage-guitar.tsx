import React from "react";
import { ReportPromo } from "../ReportPromo";

export const AustinVintageGuitar: React.FC = () => (
  <ReportPromo
    title="Vintage & Used Guitar Shops"
    eyebrow="Austin Shopping"
    subtitle="Greater Austin · Product Intelligence Report"
    accentColor="#7D4F00"
    locationCount={9}
    appPath="/apps/reports/austin-vintage-guitar"
    bullets={[
      "9 guitar shops across Austin",
      "Vintage, boutique & acoustic",
      "Austin Vintage Guitars · South Austin Music · Moon Music",
      "Austin Guitar House · Strait Music · Fiddler's Green · etc.",
    ]}
  />
);
