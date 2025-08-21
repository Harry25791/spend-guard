// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { 900: "#0b1023", 800: "#0e1330", 700: "#111827" },
        neon: { violet: "#8b5cf6", purple: "#7c3aed", cyan: "#22d3ee", teal: "#06b6d4" },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,92,246,.35), 0 0 30px rgba(34,211,238,.12)",
        card: "0 10px 30px rgba(2,6,23,.35)",
        innerGlow: "inset 0 1px 0 0 rgba(255,255,255,0.05)",
      },
      borderRadius: {
        xl2: "1.25rem", // custom step between xl and 2xl
      },
      backgroundImage: {
        "aurora-soft":
          "radial-gradient(ellipse at top left, rgba(139,92,246,0.15), transparent 60%), radial-gradient(ellipse at bottom right, rgba(34,211,238,0.12), transparent 60%)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s linear infinite",
        floaty: "floaty 4s ease-in-out infinite",
        fadeInUp: "fadeInUp 180ms ease-out both",
      },
      transitionTimingFunction: {
        "ease-soft": "cubic-bezier(0.22, 1, 0.36, 1)", // gentle spring-like ease
      },
    },
  },
  plugins: [],
} satisfies Config;
