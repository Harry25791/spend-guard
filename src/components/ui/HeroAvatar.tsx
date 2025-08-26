// src/components/ui/HeroAvatar.tsx
"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

/** Extend CSSProperties with our custom CSS vars to satisfy TS */
type CSSVarStyle = CSSProperties & {
  ["--ty"]?: string | number;
  ["--ty-md"]?: string | number;
  ["--ty-lg"]?: string | number;
};

/**
 * Reusable hero avatar wrapper (Option B: CSS vars for Y offset)
 * - Sized/aspect box via inline styles (no dynamic Tailwind)
 * - Bottom mask fade
 * - Vertical offset via CSS vars + .sg-hero-ty utilities
 * - Renders either next/image (via `src`) or a custom child (via `render`)
 */
export default function HeroAvatar({
  src,
  alt = "Hero image",
  widthPx = 860,
  aspectRatio = "4/5",
  /** Units are “tailwind quarters”: 1 = 0.25rem ≈ 4px */
  translateY,
  maskStartPct = 55,
  maskEndPct = 88,
  sizes = "(min-width: 1024px) 60vw, 92vw",
  objectFit = "contain",
  className,
  style,
  render,
  priority = true,
}: {
  src?: string;
  alt?: string;
  widthPx?: number;
  aspectRatio?: string; // e.g. "4/5" or "16/9"
  translateY?: { base?: number; md?: number; lg?: number };
  maskStartPct?: number;
  maskEndPct?: number;
  sizes?: string;
  objectFit?: "contain" | "cover";
  className?: string;
  style?: CSSVarStyle;
  render?: () => ReactNode;
  priority?: boolean;
}) {
  // Convert quarter-rem units to px for CSS vars
  const toPx = (q: number) => `${q * 4}px`;

  // Supply CSS vars if translateY prop is used
  const tyVars: CSSVarStyle = {};
  if (translateY?.base !== undefined) tyVars["--ty"] = toPx(translateY.base);
  if (translateY?.md !== undefined) tyVars["--ty-md"] = toPx(translateY.md);
  if (translateY?.lg !== undefined) tyVars["--ty-lg"] = toPx(translateY.lg);

  // Use our translate utilities so CSS vars take effect
  const outerClass = [className, "sg-hero-ty", "md:sg-hero-ty", "lg:sg-hero-ty"]
    .filter(Boolean)
    .join(" ");

  // Normalize "4/5" → "4 / 5" for CSS aspect-ratio (both often work; this is safer)
  const aspect = aspectRatio?.includes("/") ? aspectRatio.replace("/", " / ") : aspectRatio;

  // Inline sizing + mask fade (no Tailwind dynamic classes)
  const wrapperStyle: CSSProperties = {
    position: "relative",
    width: `min(${widthPx}px, 60vw)`,
    maxWidth: "100%",
    aspectRatio: aspect,
    WebkitMaskImage: `linear-gradient(to bottom, black ${maskStartPct}%, rgba(0,0,0,0) ${maskEndPct}%)`,
    maskImage: `linear-gradient(to bottom, black ${maskStartPct}%, rgba(0,0,0,0) ${maskEndPct}%)`,
  };

  return (
    <div className={outerClass} style={{ ...tyVars, ...(style ?? {}) }}>
      <div style={wrapperStyle}>
        {render ? (
          render()
        ) : src ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            className={objectFit === "cover" ? "object-cover" : "object-contain"}
            priority={priority}
          />
        ) : null}
      </div>
    </div>
  );
}
