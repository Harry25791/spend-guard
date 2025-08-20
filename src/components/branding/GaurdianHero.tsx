"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import GuardianBadge from "./GaurdianBadge"; // ← relative import (same folder)
import Image from "next/image";

export default function GuardianHero({ src = "/guardian.png" }: { src?: string }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useTransform(my, [-50, 50], [8, -8]);
  const rotateY = useTransform(mx, [-50, 50], [-8, 8]);

  return (
    <motion.div
      className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0b1023]/60 via-[#0e1330]/60 to-[#111827]/60 p-8"
      onMouseMove={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        mx.set(e.clientX - rect.left - rect.width / 2);
        my.set(e.clientY - rect.top - rect.height / 2);
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      style={{ perspective: 1000 }}
    >
      {/* background bloom */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-24 w-80 h-80 rounded-full blur-3xl opacity-40"
             style={{ background: "radial-gradient(circle, rgba(59,130,246,.3), transparent 60%)" }} />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full blur-3xl opacity-40"
             style={{ background: "radial-gradient(circle, rgba(168,85,247,.3), transparent 60%)" }} />
      </div>

      <motion.div style={{ rotateX, rotateY }} className="relative grid md:grid-cols-[auto,1fr] gap-8 items-center">
        <GuardianBadge src={src} size={168} />
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-semibold">SpendGuardian</h2>
          <p className="text-slate-300">
            Your neon-knight of budget control. Interactive, minimal, and right at home with the blue-violet theme.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
