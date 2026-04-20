import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";

// ── Buildings data ───────────────────────────────────────────────────────────
const BUILDINGS: { x: number; w: number; h: number; delay: number; windows: number }[] = [
  { x: 0,   w: 55,  h: 140, delay: 0,  windows: 8 },
  { x: 62,  w: 40,  h: 220, delay: 4,  windows: 14 },
  { x: 109, w: 65,  h: 100, delay: 2,  windows: 6 },
  { x: 182, w: 45,  h: 280, delay: 6,  windows: 18 },
  { x: 234, w: 35,  h: 160, delay: 3,  windows: 10 },
  { x: 276, w: 70,  h: 130, delay: 1,  windows: 8 },
  { x: 354, w: 50,  h: 200, delay: 5,  windows: 12 },
  { x: 412, w: 60,  h: 240, delay: 2,  windows: 16 },
  { x: 480, w: 35,  h: 110, delay: 7,  windows: 6 },
  { x: 523, w: 55,  h: 300, delay: 0,  windows: 20 },
  { x: 586, w: 45,  h: 170, delay: 4,  windows: 10 },
  { x: 638, w: 70,  h: 190, delay: 3,  windows: 12 },
  { x: 716, w: 40,  h: 250, delay: 6,  windows: 16 },
  { x: 764, w: 60,  h: 120, delay: 1,  windows: 8 },
  { x: 832, w: 50,  h: 210, delay: 5,  windows: 14 },
  { x: 889, w: 45,  h: 160, delay: 2,  windows: 10 },
  { x: 941, w: 65,  h: 290, delay: 4,  windows: 18 },
  { x: 1014,w: 40,  h: 140, delay: 3,  windows: 8 },
  { x: 1062,w: 55,  h: 180, delay: 7,  windows: 12 },
  { x: 1125,w: 60,  h: 230, delay: 1,  windows: 16 },
  { x: 1193,w: 50,  h: 150, delay: 5,  windows: 10 },
];

// ── Grid lines ────────────────────────────────────────────────────────────────
const GRID_COLS = 16;
const GRID_ROWS = 9;

// ── Colour palette ────────────────────────────────────────────────────────────
const BG       = "#080e1a";
const BUILDING = "#0e1e36";
const ACCENT   = "#f97316";
const GRID_CLR = "rgba(249,115,22,0.08)";
const WIN_ON   = "rgba(249,115,22,0.55)";
const WIN_OFF  = "rgba(255,255,255,0.04)";

// ── Helpers ───────────────────────────────────────────────────────────────────
function easeOut(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

// ── Building component ────────────────────────────────────────────────────────
const Building: React.FC<{
  data: typeof BUILDINGS[number];
  frame: number;
  fps: number;
  groundY: number;
}> = ({ data, frame, fps, groundY }) => {
  const riseProgress = spring({
    fps,
    frame: frame - data.delay,
    config: { damping: 18, stiffness: 80, mass: 0.6 },
    from: 0,
    to: 1,
    durationInFrames: 35,
  });

  const currentH = data.h * riseProgress;
  const y = groundY - currentH;

  const windowRows = Math.floor(data.windows / 2);
  const windowCols = 2;
  const winW = (data.w - 12) / windowCols;
  const winH = 8;
  const winGapX = 4;
  const winGapY = 10;

  return (
    <g>
      {/* building body */}
      <rect
        x={data.x}
        y={y}
        width={data.w}
        height={currentH}
        fill={BUILDING}
        rx={2}
      />
      {/* subtle left highlight */}
      <rect
        x={data.x}
        y={y}
        width={3}
        height={currentH}
        fill="rgba(255,255,255,0.04)"
      />
      {/* windows */}
      {riseProgress > 0.6 &&
        Array.from({ length: windowRows }, (_, row) =>
          Array.from({ length: windowCols }, (_, col) => {
            const lit = Math.sin(data.x * 1.7 + row * 3.1 + col * 7.3) > 0.15;
            return (
              <rect
                key={`${row}-${col}`}
                x={data.x + 6 + col * (winW + winGapX)}
                y={y + 10 + row * (winH + winGapY)}
                width={winW}
                height={winH}
                fill={lit ? WIN_ON : WIN_OFF}
                rx={1}
                opacity={interpolate(riseProgress, [0.6, 0.9], [0, 1])}
              />
            );
          })
        )}
      {/* rooftop accent line */}
      <rect
        x={data.x}
        y={y}
        width={data.w}
        height={2}
        fill={ACCENT}
        opacity={interpolate(riseProgress, [0.8, 1], [0, 0.6])}
      />
    </g>
  );
};

// ── Grid overlay ──────────────────────────────────────────────────────────────
const GridOverlay: React.FC<{ progress: number; width: number; height: number }> = ({
  progress,
  width,
  height,
}) => {
  const lines: React.ReactNode[] = [];
  for (let i = 0; i <= GRID_COLS; i++) {
    const x = (width / GRID_COLS) * i;
    const lineProgress = easeOut(
      interpolate(progress, [i / GRID_COLS * 0.6, i / GRID_COLS * 0.6 + 0.4], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    );
    lines.push(
      <line
        key={`v${i}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height * lineProgress}
        stroke={GRID_CLR}
        strokeWidth={1}
      />
    );
  }
  for (let j = 0; j <= GRID_ROWS; j++) {
    const y = (height / GRID_ROWS) * j;
    const lineProgress = easeOut(
      interpolate(progress, [j / GRID_ROWS * 0.6, j / GRID_ROWS * 0.6 + 0.4], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    );
    lines.push(
      <line
        key={`h${j}`}
        x1={0}
        y1={y}
        x2={width * lineProgress}
        y2={y}
        stroke={GRID_CLR}
        strokeWidth={1}
      />
    );
  }
  return <svg style={{ position: "absolute", inset: 0 }} width={width} height={height}>{lines}</svg>;
};

// ── Main composition ──────────────────────────────────────────────────────────
export const CityIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const groundY = height * 0.78;

  // Grid draws in over first 30 frames
  const gridProgress = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Title springs in starting frame 55
  const titleSpring = spring({
    fps,
    frame: frame - 55,
    config: { damping: 14, stiffness: 70, mass: 0.8 },
    from: 0,
    to: 1,
    durationInFrames: 40,
  });
  const titleY    = interpolate(titleSpring, [0, 1], [40, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Tagline fades in at frame 90
  const tagOpacity = interpolate(frame, [90, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Accent underline grows from frame 95
  const lineWidth = interpolate(frame, [95, 130], [0, 320], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Data badge counter (0 → 2.4M)
  const counter = interpolate(frame, [110, 155], [0, 2.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const badgeOpacity = interpolate(frame, [110, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ground fog gradient fade-in
  const fogOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>

      {/* Grid overlay */}
      <GridOverlay progress={gridProgress} width={width} height={height} />

      {/* SVG layer: buildings + ground */}
      <svg
        style={{ position: "absolute", inset: 0 }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* ground plane */}
        <rect
          x={0}
          y={groundY}
          width={width}
          height={2}
          fill={ACCENT}
          opacity={0.3}
        />

        {/* buildings */}
        {BUILDINGS.map((b, i) => (
          <Building
            key={i}
            data={b}
            frame={frame - 12}
            fps={fps}
            groundY={groundY}
          />
        ))}

        {/* ground fog */}
        <defs>
          <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BG} stopOpacity={0} />
            <stop offset="100%" stopColor={BG} stopOpacity={0.9} />
          </linearGradient>
        </defs>
        <rect
          x={0}
          y={groundY - 60}
          width={width}
          height={height - groundY + 60}
          fill="url(#fog)"
          opacity={fogOpacity}
        />
      </svg>

      {/* Title block */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, calc(-50% + ${titleY}px))`,
          opacity: titleOpacity,
          textAlign: "center",
          userSelect: "none",
        }}
      >
        {/* eyebrow */}
        <div
          style={{
            fontSize: 13,
            letterSpacing: "0.35em",
            color: ACCENT,
            textTransform: "uppercase",
            marginBottom: 12,
            opacity: tagOpacity,
          }}
        >
          Urban Intelligence
        </div>

        {/* main title */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          City
          <span style={{ color: ACCENT }}> Anatomy</span>
        </div>

        {/* accent line */}
        <div
          style={{
            height: 3,
            width: lineWidth,
            background: `linear-gradient(90deg, ${ACCENT}, transparent)`,
            margin: "18px auto 0",
            borderRadius: 2,
          }}
        />

        {/* tagline */}
        <div
          style={{
            marginTop: 20,
            fontSize: 19,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.08em",
            fontWeight: 400,
            opacity: tagOpacity,
          }}
        >
          Mapping the layers of urban life
        </div>
      </div>

      {/* Data badge — bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: 60,
          opacity: badgeOpacity,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span style={{ fontSize: 11, color: ACCENT, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Data points
        </span>
        <span style={{ fontSize: 36, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
          {counter.toFixed(1)}M+
        </span>
      </div>

      {/* Coordinates badge — bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          right: 60,
          opacity: badgeOpacity,
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span style={{ fontSize: 11, color: ACCENT, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Location
        </span>
        <span style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", fontFamily: "monospace" }}>
          30.2672° N, 97.7431° W
        </span>
      </div>

    </AbsoluteFill>
  );
};
