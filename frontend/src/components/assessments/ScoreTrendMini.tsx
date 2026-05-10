"use client";

import { useMemo } from "react";

interface Props {
  points: { date: string; score: number }[];
  maxScore: number;
  color: string;
}

export function ScoreTrendMini({ points, maxScore, color }: Props) {
  const path = useMemo(() => {
    if (!points.length) return { line: "", area: "", dots: [] as { x: number; y: number }[] };
    const w = 240;
    const h = 60;
    const pad = 4;
    const dots = points.map((p, i) => {
      const x =
        points.length === 1
          ? w / 2
          : pad + (i * (w - pad * 2)) / (points.length - 1);
      const y = h - pad - ((p.score / Math.max(maxScore, 1)) * (h - pad * 2));
      return { x, y };
    });
    const line = dots
      .map((d, i) => `${i === 0 ? "M" : "L"}${d.x.toFixed(1)},${d.y.toFixed(1)}`)
      .join(" ");
    const area = `${line} L${dots[dots.length - 1].x.toFixed(1)},${h - pad} L${dots[0].x.toFixed(1)},${h - pad} Z`;
    return { line, area, dots };
  }, [points, maxScore]);

  if (!points.length) return null;
  return (
    <svg viewBox="0 0 240 60" className="h-12 w-full" preserveAspectRatio="none">
      <path d={path.area} fill={color} fillOpacity={0.12} />
      <path d={path.line} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {path.dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={2} fill={color} />
      ))}
    </svg>
  );
}
