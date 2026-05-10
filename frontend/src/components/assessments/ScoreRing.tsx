"use client";

import { useEffect, useState } from "react";

interface Props {
  score: number;
  maxScore: number;
  color: string;
  label: string;
}

export function ScoreRing({ score, maxScore, color, label }: Props) {
  const [animated, setAnimated] = useState(0);
  const radius = 70;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(animated / Math.max(maxScore, 1), 1);
  const dashOffset = circumference * (1 - ratio);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(score * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const size = (radius + stroke) * 2;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} role="img" aria-label={`Score ${score} of ${maxScore}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={stroke}
          fill="none"
          className="text-muted-foreground"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 80ms linear" }}
        />
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-serif"
          style={{ fontSize: 32, fill: "currentColor" }}
        >
          {Math.round(animated)}
        </text>
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 13, fill: "currentColor", opacity: 0.6 }}
        >
          / {maxScore}
        </text>
      </svg>
      <p
        className="mt-3 font-serif text-lg"
        style={{ color }}
      >
        {label}
      </p>
    </div>
  );
}
