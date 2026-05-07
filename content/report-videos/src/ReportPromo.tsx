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
  bullets: [string, string, string];
}

const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

export const ReportPromo: React.FC<ReportPromoProps> = ({
  title, eyebrow, subtitle, accentColor, appPath, bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const pad = width * 0.08;

  const headerOp  = interpolate(frame, [0,  20], [0, 1], cl);
  const titleS    = spring({ fps, frame: frame - 15, config: { damping: 18, stiffness: 80, mass: 0.8 }, from: 0, to: 1, durationInFrames: 40 });
  const titleY    = interpolate(titleS, [0, 1], [32, 0]);
  const divW      = interpolate(frame, [55, 85], [0, width - pad * 2], cl);
  const subOp     = interpolate(frame, [70, 95], [0, 1], cl);
  const b0Op      = interpolate(frame, [90,  110], [0, 1], cl);
  const b1Op      = interpolate(frame, [110, 130], [0, 1], cl);
  const b2Op      = interpolate(frame, [130, 150], [0, 1], cl);
  const bulletOps = [b0Op, b1Op, b2Op];
  const ctaOp     = interpolate(frame, [165, 185], [0, 1], cl);

  const url = `anatomy.city${appPath}`;

  return (
    <AbsoluteFill style={{
      background: "#ffffff",
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      overflow: "hidden",
    }}>

      {/* Top accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 8, background: accentColor }} />

      {/* Main card content */}
      <div style={{
        position: "absolute",
        top: 8,
        left: 0,
        right: 0,
        bottom: 0,
        padding: `${height * 0.1}px ${pad}px ${height * 0.08}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}>

        <div>
          {/* Eyebrow */}
          <div style={{
            fontSize: width * 0.018,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: accentColor,
            marginBottom: height * 0.04,
            opacity: headerOp,
          }}>
            {eyebrow}
          </div>

          {/* Title */}
          <div style={{
            fontSize: width * 0.058,
            fontWeight: 800,
            color: "#111111",
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            transform: `translateY(${titleY}px)`,
            opacity: titleS,
            marginBottom: height * 0.04,
          }}>
            {title}
          </div>

          {/* Divider */}
          <div style={{
            width: divW,
            height: 2,
            background: `linear-gradient(90deg, ${accentColor}, transparent)`,
            marginBottom: height * 0.04,
            borderRadius: 1,
          }} />

          {/* Subtitle */}
          <div style={{
            fontSize: width * 0.024,
            fontWeight: 600,
            color: "rgba(0,0,0,0.5)",
            lineHeight: 1.35,
            opacity: subOp,
            marginBottom: height * 0.05,
          }}>
            {subtitle}
          </div>

          {/* Bullets */}
          {bullets.map((text, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "flex-start",
              gap: width * 0.012,
              marginBottom: height * 0.025,
              opacity: bulletOps[i],
            }}>
              <div style={{
                width: width * 0.008,
                height: width * 0.008,
                borderRadius: "50%",
                background: accentColor,
                marginTop: width * 0.009,
                flexShrink: 0,
              }} />
              <div style={{
                fontSize: width * 0.022,
                fontWeight: 500,
                color: "rgba(0,0,0,0.8)",
                lineHeight: 1.45,
              }}>
                {text}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: URL tag */}
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          opacity: ctaOp,
        }}>
          <div style={{
            background: accentColor,
            color: "#ffffff",
            fontSize: width * 0.016,
            fontWeight: 700,
            letterSpacing: "0.04em",
            padding: `${height * 0.022}px ${width * 0.025}px`,
            borderRadius: 5,
          }}>
            {url}
          </div>
        </div>

      </div>

    </AbsoluteFill>
  );
};
