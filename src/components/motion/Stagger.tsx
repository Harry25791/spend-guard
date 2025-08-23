// src/components/motion/Stagger.tsx
"use client";

import { motion, AnimatePresence, cubicBezier, type Variants } from "framer-motion";

type Props = React.PropsWithChildren<{
  active?: boolean;      // When false, children stay hidden; when true, play the stagger once
  baseDelay?: number;    // Delay before the whole group starts
  itemDelay?: number;    // Per-item stagger delay
  className?: string;    // Optional wrapper className
}>;

export default function Stagger({
  children,
  active = true,
  baseDelay = 0.25,
  itemDelay = 0.12,
  className = "",
}: Props) {
  const container: Variants = {
    hidden: { opacity: 0, y: 6 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        delay: baseDelay,
        when: "beforeChildren",
        staggerChildren: itemDelay,
      },
    },
  };

  // Use a properly-typed easing
  const EASE = cubicBezier(0.22, 1, 0.36, 1);

  const item: Variants = {
    hidden: { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: EASE },
    },
  };

  // Reduce motion users: no movement, just quick fade
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const itemReduced: Variants = prefersReduced
    ? {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.2 } },
      }
    : item;

  return (
    <AnimatePresence initial>
      <motion.div
        className={className}
        variants={container}
        initial="hidden"
        animate={active ? "show" : "hidden"}
      >
        {Array.isArray(children)
          ? children.map((c, i) => (
              <motion.div key={i} variants={itemReduced}>
                {c}
              </motion.div>
            ))
          : <motion.div variants={itemReduced}>{children}</motion.div>}
      </motion.div>
    </AnimatePresence>
  );
}
