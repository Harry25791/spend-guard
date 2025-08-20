// src/components/layout/AppShell.tsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Aurora from "@/components/ui/Aurora";

function Brand() {
  // Non-blocking image: if the svg/png isn’t there yet, you still get text.
  return (
    <Link href="/" className="flex items-center gap-2">
      {/* <img src="/brand/guardian-badge.svg" alt="" className="h-6 w-6" /> */}
      <span className="text-sm md:text-base font-semibold tracking-tight">Spend Guard</span>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0b1023] via-[#0e1330] to-[#111827] text-slate-100">
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/0 border-b border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-3">
            <span className="text-xs md:text-sm text-slate-400">v0.2</span>
          </div>
        </div>
      </header>

      {/* Main content with aurora background layer */}
      <main className="relative mx-auto max-w-5xl px-6 py-8 overflow-hidden">
        {/* Background glow layer */}
        <Aurora />

        {/* Foreground content */}
        <div className="relative z-10" suppressHydrationWarning>
          {mounted ? children : null}
        </div>
      </main>
    </div>
  );
}
