import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface ReportPromoProps {
  title: string;
  eyebrow: string;
  subtitle: string;
  accentColor: string;
  locationCount: number;
  appPath: string;
  bullets: [string, string, string, string];
}

const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// Simple Austin-style city skyline — pure SVG, no external assets
const Cityscape: React.FC<{ width: number; height: number; accent: string }> = ({ width, height, accent }) => {
  // Buildings: [x, w, h]. Tallest cluster near center = downtown.
  const bldgs = [
    [0,55,95],[45,70,140],[105,50,110],[148,60,162],[198,45,130],
    [232,80,196],[302,55,218],[348,72,252],
    [410,92,282],[495,58,238],[542,82,262],
    [614,104,308], // tallest — Frost Bank stand-in
    [706,62,278],[758,88,258],
    [836,72,232],[898,56,205],[944,82,182],
    [1016,60,156],[1066,76,172],[1132,50,132],[1172,66,116],[1228,52,142],
  ];

  const ground = height;
  const buildingColor = "#c8cdd8";
  const windowColor = "#dde2ec";
  const accentGlow = accent + "18"; // very subtle accent tint on tallest

  return (
    <svg
      style={{ position: "absolute", bottom: 0, left: 0 }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Subtle sky gradient */}
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eef1f8" />
          <stop offset="100%" stopColor="#f8f9fc" />
        </linearGradient>
        <linearGradient id="groundfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={buildingColor} />
          <stop offset="100%" stopColor="#b8bdc8" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="url(#sky)" />

      {/* Ground line */}
      <rect x={0} y={ground - 3} width={width} height={3} fill="#b8bdc8" opacity={0.5} />

      {bldgs.map(([x, w, h], i) => {
        const isLandmark = h > 270;
        return (
          <g key={i}>
            {/* Building body */}
            <rect
              x={x} y={ground - h} width={w} height={h}
              fill={isLandmark ? `url(#groundfade)` : buildingColor}
            />
            {/* Accent tint on tallest */}
            {isLandmark && (
              <rect x={x} y={ground - h} width={w} height={h} fill={accentGlow} />
            )}
            {/* Windows — rows of small rects on taller buildings */}
            {h > 150 && (() => {
              const winW = 5, winH = 4, colGap = 13, rowGap = 16;
              const cols = Math.floor((w - 10) / colGap);
              const rows = Math.floor((h - 24) / rowGap);
              const wins: React.ReactNode[] = [];
              for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                  wins.push(
                    <rect
                      key={`${r}-${c}`}
                      x={x + 5 + c * colGap}
                      y={ground - h + 12 + r * rowGap}
                      width={winW} height={winH}
                      fill={windowColor}
                      opacity={0.7}
                    />
                  );
                }
              }
              return wins;
            })()}
          </g>
        );
      })}
    </svg>
  );
};

export const ReportPromo: React.FC<ReportPromoProps> = ({
  title, eyebrow, accentColor, appPath, bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const barW    = interpolate(frame, [0, 18],    [0, width],  cl);
  const eyeOp   = interpolate(frame, [12, 32],   [0, 1],      cl);
  const cityOp  = interpolate(frame, [0, 40],    [0, 1],      cl);

  const titleS  = spring({ fps, frame: frame - 18, config: { damping: 18, stiffness: 80, mass: 0.8 }, from: 0, to: 1, durationInFrames: 35 });
  const titleY  = interpolate(titleS, [0, 1], [26, 0]);

  const divW    = interpolate(frame, [48, 74],   [0, width - 140], cl);

  const b0Op    = interpolate(frame, [72,  88],  [0, 1],  cl);
  const b0Y     = interpolate(frame, [72,  88],  [20, 0], cl);
  const b1Op    = interpolate(frame, [92,  108], [0, 1],  cl);
  const b1Y     = interpolate(frame, [92,  108], [20, 0], cl);
  const b2Op    = interpolate(frame, [112, 128], [0, 1],  cl);
  const b2Y     = interpolate(frame, [112, 128], [20, 0], cl);
  const b3Op    = interpolate(frame, [132, 148], [0, 1],  cl);
  const b3Y     = interpolate(frame, [132, 148], [20, 0], cl);
  const bulletOps = [b0Op, b1Op, b2Op, b3Op];
  const bulletYs  = [b0Y,  b1Y,  b2Y,  b3Y];

  const ctaOp   = interpolate(frame, [162, 180], [0, 1],  cl);

  const url = `anatomy.city${appPath}`;

  return (
    <AbsoluteFill style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", overflow: "hidden", background: "#f8f9fc" }}>

      {/* City skyline */}
      <div style={{ position: "absolute", inset: 0, opacity: cityOp }}>
        <Cityscape width={width} height={height} accent={accentColor} />
      </div>

      {/* Accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, width: barW, height: 7, background: accentColor }} />

      {/* Content */}
      <div style={{
        position: "absolute",
        inset: 0,
        padding: "44px 70px 36px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}>
        <div>
          {/* Eyebrow — format: "City Anatomy Free Report: BOLD PART - normal part" */}
          {(() => {
            const colonIdx = eyebrow.indexOf(": ");
            const dashIdx  = eyebrow.indexOf(" - ");
            const prefix   = colonIdx > -1 ? eyebrow.slice(0, colonIdx + 2) : eyebrow;
            const bold     = colonIdx > -1 && dashIdx > -1 ? eyebrow.slice(colonIdx + 2, dashIdx) : "";
            const suffix   = dashIdx  > -1 ? eyebrow.slice(dashIdx) : "";
            return (
              <div style={{
                fontSize: 22,
                letterSpacing: "0.08em",
                color: accentColor,
                marginBottom: 16,
                opacity: eyeOp,
              }}>
                <span style={{ fontWeight: 400 }}>{prefix}</span>
                <span style={{ fontWeight: 800 }}>{bold}</span>
                <span style={{ fontWeight: 400 }}>{suffix}</span>
              </div>
            );
          })()}

          {/* Title */}
          <div style={{
            fontSize: 84,
            fontWeight: 800,
            color: "#111827",
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            transform: `translateY(${titleY}px)`,
            opacity: titleS,
            marginBottom: 20,
          }}>
            {title}
          </div>

          {/* Divider */}
          <div style={{
            width: divW,
            height: 2,
            background: `linear-gradient(90deg, ${accentColor}, transparent)`,
            marginBottom: 24,
            borderRadius: 1,
          }} />

          {/* Bullets */}
          {bullets.map((text, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              marginBottom: 12,
              opacity: bulletOps[i],
              transform: `translateY(${bulletYs[i]}px)`,
            }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: accentColor,
                marginTop: 10,
                flexShrink: 0,
              }} />
              <div style={{
                fontSize: 58,
                fontWeight: 600,
                color: "#1f2937",
                lineHeight: 1.2,
              }}>
                {text}
              </div>
            </div>
          ))}
        </div>

        {/* URL badge */}
        <div style={{ display: "flex", justifyContent: "flex-end", opacity: ctaOp }}>
          <div style={{
            background: accentColor,
            color: "#ffffff",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.04em",
            padding: "10px 22px",
            borderRadius: 5,
          }}>
            {url}
          </div>
        </div>
      </div>

    </AbsoluteFill>
  );
};
