"use client";

import { motion } from "framer-motion";
import Image from "next/image";

type Props = {
  src?: string;
  size?: number;     // px
  alt?: string;
};

export default function GuardianBadge({ src="/guardian.png", size=128, alt="SpendGuardian" }: Props) {
  return (
    <motion.div
      className="relative inline-block"
      style={{ width: size, height: size }}
      whileHover={{ rotate: 1.5, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      {/* Aura */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(59,130,246,.35), rgba(168,85,247,.25) 45%, transparent 70%)"
        }}
      />

      {/* Glowing ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(56,189,248,.6), rgba(147,51,234,.6), rgba(56,189,248,.6))",
          WebkitMask:
            "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)",
          filter: "blur(0.3px)"
        }}
      />

      {/* Slow rotating runes */}
      <motion.div
        className="absolute inset-0 rounded-full mix-blend-screen opacity-50"
        style={{
          background:
            "repeating-conic-gradient(from 0deg, rgba(168,85,247,.25) 0 6deg, transparent 6deg 12deg)"
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* Image */}
      <div className="relative z-10 rounded-full overflow-hidden border border-white/10 bg-black/30">
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="object-contain"
          priority
        />
      </div>

      {/* Subtle bottom glow */}
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[70%] h-2 blur-lg opacity-70"
        style={{ background: "radial-gradient(50% 100% at 50% 0%, rgba(56,189,248,.35), transparent)" }}
      />
    </motion.div>
  );
}
