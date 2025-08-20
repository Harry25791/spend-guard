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
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
} satisfies Config;
