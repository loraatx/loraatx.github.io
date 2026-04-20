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
  appPath: string; // e.g. "apps/citywide/austin-bike-shops"
}

const BG = "#080e1a";
const GRID = "rgba(255,255,255,0.04)";

// Dot-grid backdrop
const DotGrid: React.FC<{ width: number; height: number; color: string }> = ({
  width,
  height,
  color,
}) => {
  const cols = 32;
  const rows = 18;
  const dots: React.ReactNode[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={(width / cols) * c}
          cy={(height / rows) * r}
          r={1.5}
          fill={color}
        />
      );
    }
  }
  return (
    <svg style={{ position: "absolute", inset: 0 }} width={width} height={height}>
      {dots}
    </svg>
  );
};

// Animated map-pin icon
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
      {/* pulse ring */}
      <circle cx={0} cy={-14} r={interpolate(s, [0.6, 1], [0, 16])} fill="none" stroke={color} strokeWidth={1.5}
        opacity={interpolate(s, [0.6, 1], [0.8, 0])} />
    </g>
  );
};

export const ReportPromo: React.FC<ReportPromoProps> = ({
  title,
  eyebrow,
  subtitle,
  accentColor,
  locationCount,
  appPath,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ── Accent strip slides in from left (0–20) ──────────────
  const stripW = interpolate(frame, [0, 20], [0, width], { extrapolateRight: "clamp" });

  // ── Eyebrow fades in (15–35) ─────────────────────────────
  const eyebrowOp = interpolate(frame, [15, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Title springs up (30–70) ─────────────────────────────
  const titleSpring = spring({ fps, frame: frame - 30, config: { damping: 16, stiffness: 70, mass: 0.9 }, from: 0, to: 1, durationInFrames: 40 });
  const titleY   = interpolate(titleSpring, [0, 1], [50, 0]);
  const titleOp  = titleSpring;

  // ── Subtitle fades in (65–90) ────────────────────────────
  const subOp = interpolate(frame, [65, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Divider line grows (70–100) ──────────────────────────
  const divW = interpolate(frame, [70, 100], [0, 480], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Counter counts up (90–140) ───────────────────────────
  const countVal = interpolate(frame, [90, 140], [0, locationCount], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const countOp  = interpolate(frame, [90, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── CTA badge slides in (130–155) ────────────────────────
  const ctaX = interpolate(frame, [130, 155], [80, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaOp = interpolate(frame, [130, 155], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Map pins staggered from frame 45 ─────────────────────
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

      {/* Dot grid */}
      <DotGrid width={width} height={height} color={GRID} />

      {/* Top accent strip */}
      <div style={{ position: "absolute", top: 0, left: 0, width: stripW, height: 4, background: accentColor }} />

      {/* Right-side map-pin cluster */}
      <svg style={{ position: "absolute", inset: 0 }} width={width} height={height}>
        {/* faint circle backdrop */}
        <circle
          cx={width * 0.76}
          cy={height * 0.5}
          r={interpolate(frame, [20, 60], [0, 180], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          fill={accentColor}
          opacity={0.06}
        />
        {pins.map((p, i) => (
          <MapPin key={i} x={p.x} y={p.y} color={accentColor} delay={45 + i * 8} frame={frame} fps={fps} />
        ))}
      </svg>

      {/* Left content block */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 80,
          transform: `translateY(-50%)`,
          width: width * 0.55,
        }}
      >
        {/* Eyebrow */}
        <div style={{
          fontSize: 13,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: accentColor,
          marginBottom: 16,
          opacity: eyebrowOp,
        }}>
          {eyebrow}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 46,
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
          margin: "20px 0",
          borderRadius: 1,
        }} />

        {/* Subtitle */}
        <div style={{
          fontSize: 18,
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.5,
          opacity: subOp,
          maxWidth: 460,
        }}>
          {subtitle}
        </div>
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
        <span style={{ fontSize: 11, color: accentColor, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Locations mapped
        </span>
        <span style={{ fontSize: 42, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>
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
        <div style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}>
          Explore the full report
        </div>
        <div style={{
          background: accentColor,
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.05em",
          padding: "8px 18px",
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
