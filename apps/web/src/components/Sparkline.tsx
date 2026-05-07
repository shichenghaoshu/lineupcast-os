"use client";

import { useMemo } from "react";

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
}

/**
 * Minimal pure-SVG sparkline. No external charting library required.
 */
export function Sparkline({
  data,
  color = "var(--accent-blue)",
  width = 80,
  height = 28,
  strokeWidth = 1.5,
  fill = true,
}: SparklineProps) {
  const { linePath, areaPath } = useMemo(() => {
    if (data.length < 2) return { linePath: "", areaPath: "" };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = strokeWidth;

    const w = width - pad * 2;
    const h = height - pad * 2;

    const points = data.map((v, i) => ({
      x: pad + (i / (data.length - 1)) * w,
      y: pad + h - ((v - min) / range) * h,
    }));

    // Smooth cubic bezier through points
    const lineSegments = points.map((p, i) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const prev = points[i - 1];
      const cpx = (prev.x + p.x) / 2;
      return `C ${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
    });

    const lp = lineSegments.join(" ");
    const ap = `${lp} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

    return { linePath: lp, areaPath: ap };
  }, [data, width, height, strokeWidth]);

  if (data.length < 2) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
    >
      {fill && (
        <path
          d={areaPath}
          fill={color}
          fillOpacity={0.12}
          stroke="none"
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
