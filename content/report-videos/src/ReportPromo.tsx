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

const BG = "#080e1a";
const GRID = "rgba(255,255,255,0.04)";

const DotGrid: React.FC<{ width: number; height: number; color: string }> = ({
  width, height, color,
}) => {
  const cols = 32;
  const rows = 18;
  const dots: React.ReactNode[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      dots.push(
        <circle key={`${r}-${c}`} cx={(width / cols) * c} cy={(height / rows) * r} r={1.5} fill={color} />
      );
    }
  }
  return (
    <svg style={{ position: "absolute", inset: 0 }} width={width} height={height}>
      {dots}
    </svg>
  );
};

const MapPin: React.FC<{ x: number; y: number; color: string; delay: number; frame: number; fps: number }> = ({
  x, y, color, delay, frame, fps,
}) => {
  const s = spring({ fps, frame: frame - delay, config: { damping: 12, stiffness: 120, mass: 0.5 }, from: 0, to: 1, durationInFrames: 25 });
  const drop = interpolate(s, [0, 1], [-30, 0]);
  return (
    <g transform={`translate(${x}, ${y + drop})`} opacity={s}>
      <circle cx={0} cy={-14} r={9} fill={color} />
      <circle cx={0} cy={-14} r={4} fill="#fff" />
      <path d="M0 0 L-6 -8 Q-9 -14 0 -23 Q9 -14 6 -8 Z" fill={color} />
      <circle cx={0} cy={-14} r={interpolate(s, [0.6, 1], [0, 16])} fill="none" stroke={color} strokeWidth={1.5}
        opacity={interpolate(s, [0.6, 1], [0.8, 0])} />
    </g>
  );
};

const cl = (left: number, right: number) =>
  ({ extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const });

export const ReportPromo: React.FC<ReportPromoProps> = ({
  title, eyebrow, subtitle, accentColor, locationCount, appPath, bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ── Accent strip (0–20) ──────────────────────────────────
  const stripW = interpolate(frame, [0, 20], [0, width], cl(0, 20));

  // ── Eyebrow (15–40) ─────────────────────────────────────
  const eyebrowOp = interpolate(frame, [15, 40], [0, 1], cl(15, 40));

  // ── Title spring (30–75) ────────────────────────────────
  const titleSpring = spring({ fps, frame: frame - 30, config: { damping: 16, stiffness: 70, mass: 0.9 }, from: 0, to: 1, durationInFrames: 45 });
  const titleY  = interpolate(titleSpring, [0, 1], [50, 0]);
  const titleOp = titleSpring;

  // ── Subtitle (75–100) ───────────────────────────────────
  const subOp = interpolate(frame, [75, 100], [0, 1], cl(75, 100));

  // ── Divider (80–115) ────────────────────────────────────
  const divW = interpolate(frame, [80, 115], [0, 520], cl(80, 115));

  // ── Bullets staggered (110 / 130 / 150 – +20 each) ─────
  const b0Op = interpolate(frame, [110, 130], [0, 1], cl(110, 130));
  const b1Op = interpolate(frame, [130, 150], [0, 1], cl(130, 150));
  const b2Op = interpolate(frame, [150, 170], [0, 1], cl(150, 170));
  const bulletOps = [b0Op, b1Op, b2Op];

  // ── Counter (190–240) ───────────────────────────────────
  const countVal = interpolate(frame, [190, 240], [0, locationCount], cl(190, 240));
  const countOp  = interpolate(frame, [190, 210], [0, 1], cl(190, 210));

  // ── CTA badge (245–270) ─────────────────────────────────
  const ctaX  = interpolate(frame, [245, 270], [80, 0], cl(245, 270));
  const ctaOp = interpolate(frame, [245, 270], [0, 1], cl(245, 270));

  // ── Map pins (45+) ──────────────────────────────────────
  const pins = [
    { x: width * 0.72, y: height * 0.28 },
    { x: width * 0.78, y: height * 0.52 },
    { x: width * 0.68, y: height * 0.62 },
    { x: width * 0.84, y: height * 0.38 },
    { x: width * 0.76, y: height * 0.72 },
  ];

  const url = `anatomy.city/${appPath}`;

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "'Helvetica Neue', Arial, sans-serif", overflow: "hidden" }}>

      <DotGrid width={width} height={height} color={GRID} />

      {/* Top accent strip */}
      <div style={{ position: "absolute", top: 0, left: 0, width: stripW, height: 5, background: accentColor }} />

      {/* Map-pin cluster right side */}
      <svg style={{ position: "absolute", inset: 0 }} width={width} height={height}>
        <circle
          cx={width * 0.76} cy={height * 0.5}
          r={interpolate(frame, [20, 60], [0, 180], cl(20, 60))}
          fill={accentColor} opacity={0.06}
        />
        {pins.map((p, i) => (
          <MapPin key={i} x={p.x} y={p.y} color={accentColor} delay={45 + i * 8} frame={frame} fps={fps} />
        ))}
      </svg>

      {/* Left content block */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: 80,
        transform: "translateY(-50%)",
        width: width * 0.58,
      }}>

        {/* Eyebrow */}
        <div style={{
          fontSize: 15,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: accentColor,
          marginBottom: 18,
          opacity: eyebrowOp,
        }}>
          {eyebrow}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 56,
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          transform: `translateY(${titleY}px)`,
          opacity: titleOp,
        }}>
          {title}
        </div>

        {/* Divider */}
        <div style={{
          width: divW,
          height: 2,
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
          margin: "22px 0 18px",
          borderRadius: 1,
        }} />

        {/* Subtitle */}
        <div style={{
          fontSize: 21,
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.45,
          opacity: subOp,
          marginBottom: 22,
        }}>
          {subtitle}
        </div>

        {/* Bullets */}
        {bullets.map((text, i) => (
          <div key={i} style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 12,
            opacity: bulletOps[i],
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: accentColor,
              marginTop: 8,
              flexShrink: 0,
            }} />
            <div style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.5,
            }}>
              {text}
            </div>
          </div>
        ))}
      </div>

      {/* Location counter — bottom left */}
      <div style={{
        position: "absolute",
        bottom: 52,
        left: 80,
        opacity: countOp,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}>
        <span style={{ fontSize: 12, color: accentColor, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Locations mapped
        </span>
        <span style={{ fontSize: 46, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>
          {Math.round(countVal)}
        </span>
      </div>

      {/* CTA badge — bottom right */}
      <div style={{
        position: "absolute",
        bottom: 52,
        right: 80,
        opacity: ctaOp,
        transform: `translateX(${ctaX}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
      }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Explore the full report
        </div>
        <div style={{
          background: accentColor,
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.05em",
          padding: "9px 20px",
          borderRadius: 4,
        }}>
          {url}
        </div>
      </div>

      {/* City Anatomy brand — top right */}
      <div style={{
        position: "absolute",
        top: 28,
        right: 40,
        fontSize: 13,
        fontWeight: 700,
        color: "rgba(255,255,255,0.25)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        opacity: eyebrowOp,
      }}>
        City Anatomy
      </div>

    </AbsoluteFill>
  );
};
