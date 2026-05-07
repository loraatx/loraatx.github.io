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
      "9 guitar shops profiled across the metro.",
      "Types: vintage specialists, boutique luthier showrooms, acoustic-only, independents, and chain outlets.",
      "Highlights include Austin Vintage Guitars and South Austin Music.",
    ]}
  />
);
