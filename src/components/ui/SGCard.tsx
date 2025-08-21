// src/components/ui/SGCard.tsx
"use client";

import React from "react";
import { cn } from "@/lib/cn";

type Props = React.PropsWithChildren<{
  className?: string;
  as?: React.ElementType;  // <= was: keyof JSX.IntrinsicElements
  ariaLabel?: string;
}>;

export default function SGCard({ children, className, as = "div", ariaLabel }: Props) {
  const Comp: any = as;
  return (
    <Comp
      aria-label={ariaLabel}
      className={cn(
        "sg-card relative rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
        "hover:border-white/15 transition-colors",
        "p-4 md:p-5",
        className
      )}
    >
      {/* subtle inner glow ring */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/5" />
      {children}
    </Comp>
  );
}
