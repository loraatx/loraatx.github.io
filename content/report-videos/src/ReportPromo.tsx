import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
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
  bullets: [string, string, string];
}

// Austin zoom-10 tile grid: x=231..236, y=419..423 (6×5 = 1536×1280px)
// Positioned so Austin (tile 234,421, offset 0px,197px) sits at canvas center (640,360)
const TILE_X_START = 231;
const TILE_Y_START = 419;
const TILE_COLS = 6;
const TILE_ROWS = 5;
const GRID_LEFT = -128;
const GRID_TOP = -349;

const MapBackground: React.FC<{ opacity: number }> = ({ opacity }) => {
  const tiles: React.ReactNode[] = [];
  for (let ty = 0; ty < TILE_ROWS; ty++) {
    for (let tx = 0; tx < TILE_COLS; tx++) {
      const tileX = TILE_X_START + tx;
      const tileY = TILE_Y_START + ty;
      tiles.push(
        <Img
          key={`${tx}-${ty}`}
          src={staticFile(`tiles/10/${tileX}_${tileY}.png`)}
          style={{
            position: "absolute",
            left: tx * 256,
            top: ty * 256,
            width: 256,
            height: 256,
          }}
        />
      );
    }
  }
  return (
    <div style={{ position: "absolute", inset: 0, opacity, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: GRID_LEFT, top: GRID_TOP }}>
        {tiles}
      </div>
    </div>
  );
};

const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

export const ReportPromo: React.FC<ReportPromoProps> = ({
  title, eyebrow, accentColor, appPath, bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mapOp    = interpolate(frame, [0, 25],    [0, 1],  cl);
  const overlayOp = interpolate(frame, [0, 30],   [0, 0.62], cl);
  const barW     = interpolate(frame, [0, 18],    [0, 1280], cl);
  const eyeOp    = interpolate(frame, [12, 30],   [0, 1],  cl);

  const titleS   = spring({ fps, frame: frame - 20, config: { damping: 18, stiffness: 80, mass: 0.8 }, from: 0, to: 1, durationInFrames: 35 });
  const titleY   = interpolate(titleS, [0, 1], [28, 0]);

  const divW     = interpolate(frame, [50, 78],   [0, 1140], cl);
  const b0Op     = interpolate(frame, [75,  92],  [0, 1],  cl);
  const b0Y      = interpolate(frame, [75,  92],  [22, 0], cl);
  const b1Op     = interpolate(frame, [95,  112], [0, 1],  cl);
  const b1Y      = interpolate(frame, [95,  112], [22, 0], cl);
  const b2Op     = interpolate(frame, [115, 132], [0, 1],  cl);
  const b2Y      = interpolate(frame, [115, 132], [22, 0], cl);
  const bulletOps = [b0Op, b1Op, b2Op];
  const bulletYs  = [b0Y,  b1Y,  b2Y];

  const ctaOp    = interpolate(frame, [150, 170], [0, 1],  cl);

  const url = `anatomy.city${appPath}`;

  return (
    <AbsoluteFill style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", overflow: "hidden", background: "#1a1a2e" }}>

      {/* Map tiles */}
      <MapBackground opacity={mapOp} />

      {/* Dark overlay so text pops */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "rgba(10, 10, 20, 0.62)",
        opacity: overlayOp,
      }} />

      {/* Accent bar across top */}
      <div style={{
        position: "absolute",
        top: 0, left: 0,
        width: barW, height: 7,
        background: accentColor,
      }} />

      {/* Main content — full-screen column */}
      <div style={{
        position: "absolute",
        inset: 0,
        padding: "44px 70px 36px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}>
        <div>
          {/* Eyebrow */}
          <div style={{
            fontSize: 20,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: accentColor,
            marginBottom: 18,
            opacity: eyeOp,
          }}>
            {eyebrow}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 90,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            transform: `translateY(${titleY}px)`,
            opacity: titleS,
            marginBottom: 22,
          }}>
            {title}
          </div>

          {/* Divider */}
          <div style={{
            width: divW,
            height: 2,
            background: `linear-gradient(90deg, ${accentColor}, transparent)`,
            marginBottom: 28,
            borderRadius: 1,
          }} />

          {/* Bullets */}
          {bullets.map((text, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 18,
              marginBottom: 14,
              opacity: bulletOps[i],
              transform: `translateY(${bulletYs[i]}px)`,
            }}>
              <div style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: accentColor,
                marginTop: 13,
                flexShrink: 0,
              }} />
              <div style={{
                fontSize: 72,
                fontWeight: 600,
                color: "#f0f0f0",
                lineHeight: 1.25,
              }}>
                {text}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: URL badge */}
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          opacity: ctaOp,
        }}>
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
