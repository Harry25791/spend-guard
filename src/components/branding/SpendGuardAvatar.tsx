"use client";

import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useEffect } from "react";

/**
 * SpendGuard avatar — animated SVG (neon sweep + single blink).
 * Honors prefers-reduced-motion.
 */
export default function SpendGuardAvatar({
  size = 420,
  base = "#1E1B2E",
  glow = "#8A4DFF",
  bg = "#0D0B14",
  loopMs = 4200,
  className,
}: {
  size?: number;
  base?: string;
  glow?: string;
  bg?: string;
  loopMs?: number;
  className?: string;
}) {
  const controls = useAnimationControls();
  const eyes = useAnimationControls();
  const reduce = useReducedMotion();

  useEffect(() => {
    let alive = true;
    async function run() {
      await controls.start({ pathOffset: 1, transition: { duration: 0 } });
      controls.start({
        pathOffset: 0,
        transition: { duration: reduce ? 0.01 : loopMs * 0.55 / 1000, ease: [0.22, 1, 0.36, 1] },
      });
      if (!reduce) {
        setTimeout(() => alive && eyes.start({ opacity: [1, 0, 1], transition: { duration: 0.28, times: [0, 0.5, 1] } }), loopMs * 0.62);
      }
    }
    run();
    if (!reduce) {
      const id = setInterval(() => alive && run(), loopMs);
      return () => { alive = false; clearInterval(id); };
    }
    return () => { alive = false; };
  }, [controls, eyes, loopMs, reduce]);

  // Simplified placeholder: draw your full SVG here using <motion.path> etc.
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 420 420"
      className={className}
      role="img" aria-label="SpendGuard avatar"
    >
      <defs>
        <radialGradient id="sg_bg" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.22" />
          <stop offset="100%" stopColor={bg} stopOpacity="0" />
        </radialGradient>
        <filter id="sg_glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={glow} floodOpacity="0.45" />
          <feDropShadow dx="0" dy="0" stdDeviation="14" floodColor={glow} floodOpacity="0.25" />
        </filter>
      </defs>

      <rect x="0" y="0" width="100%" height="100%" fill="url(#sg_bg)" rx="28" />

      {/* Face visor / mask (animated sweep along pathOffset) */}
      <motion.path
        d="M70 220 C120 130, 300 130, 350 220"
        fill="none"
        stroke={glow}
        strokeWidth="6"
        strokeLinecap="round"
        pathLength={1}
        initial={{ pathOffset: 1 }}
        animate={controls}
        filter="url(#sg_glow)"
      />

      {/* Eyes blink */}
      <motion.g initial={{ opacity: 1 }} animate={eyes}>
        <circle cx="160" cy="205" r="6" fill="#F5F7FF" />
        <circle cx="260" cy="205" r="6" fill="#F5F7FF" />
      </motion.g>

      {/* Armor silhouette (static for now; swap in your full paths from the txt file) */}
      <path d="M90 300 C120 260, 300 260, 330 300 L330 340 L90 340 Z" fill={base} opacity="0.75" />
    </svg>
  );
}
