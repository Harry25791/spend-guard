// src/components/charts/TokenLimitUsage.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Props = {
  projectId: string;
  tokensUsed: number;
  defaultRateUsdPer1k?: number;
  modelRateUsdPer1k?: number;
  className?: string;
  compact?: boolean;
  /** NEW: control the bar height (px). Default = 22 */
  barHeightPx?: number;
};

export default function TokenLimitUsage({
  projectId,
  tokensUsed,
  defaultRateUsdPer1k,
  modelRateUsdPer1k,
  className,
  compact,
  barHeightPx = 22,             // ⟵ a bit taller by default
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [limitUsd, setLimitUsd] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("settings");
      const s = raw ? JSON.parse(raw) : {};
      const per = (s?.perProjectLimits || {}) as Record<string, number>;
      const perProj = per?.[projectId];
      setLimitUsd(Number(perProj ?? s?.monthlyLimitUsd ?? 0) || 0);
    } catch {
      setLimitUsd(0);
    }
  }, [projectId]);

  const effectiveRate = useMemo(() => {
    const r = modelRateUsdPer1k ?? defaultRateUsdPer1k;
    return typeof r === "number" && r > 0 ? r : undefined;
  }, [modelRateUsdPer1k, defaultRateUsdPer1k]);

  const limitTokens = useMemo(() => {
    if (!mounted || !limitUsd || !effectiveRate) return 0;
    return Math.floor((limitUsd / effectiveRate) * 1000);
  }, [mounted, limitUsd, effectiveRate]);

  const clampedUsed = Math.max(0, Math.min(tokensUsed, limitTokens || tokensUsed));
  const remainingTokens = Math.max(0, (limitTokens || 0) - clampedUsed);
  const usedPct = limitTokens > 0 ? Math.min(100, (clampedUsed / limitTokens) * 100) : 0;
  const remainingPct = Math.max(0, 100 - usedPct);

  const usedUsd = effectiveRate ? (clampedUsed / 1000) * effectiveRate : 0;
  const remainingUsd = Math.max(0, (limitUsd || 0) - usedUsd);

  if (!mounted) {
    return (
      <div className={["p-4", className].filter(Boolean).join(" ")}>
        <div className="h-5 w-40 rounded bg-white/10 animate-pulse" />
        <div className="mt-3 h-8 w-full rounded bg-white/10 animate-pulse" />
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="h-12 rounded bg-white/10 animate-pulse" />
          <div className="h-12 rounded bg-white/10 animate-pulse" />
        </div>
      </div>
    );
  }

  const noLimit = !limitUsd || limitUsd <= 0;
  const noRate = !effectiveRate || effectiveRate <= 0;

  return (
    <div className={["p-2 md:p-3", className].filter(Boolean).join(" ")}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Token limit usage</h3>
        {!noLimit && !noRate && (
          <div className="text-xs text-slate-400">
            {clampedUsed.toLocaleString()} / {limitTokens.toLocaleString()} tok ({Math.round(usedPct)}%)
          </div>
        )}
      </div>

      {noLimit ? (
        <div className="mt-3 text-sm text-slate-400">
          No monthly limit set.{" "}
          <Link href="/settings" className="text-cyan-300 underline decoration-cyan-500/40">
            Set a limit in Settings
          </Link>.
        </div>
      ) : noRate ? (
        <div className="mt-3 text-sm text-slate-400">
          Set a rate (model or project default) so we can convert your USD limit to tokens.
        </div>
      ) : (
        <>
          {/* PROGRESS BAR — even margins top/bottom + taller bar */}
          <div className="my-4 rounded-lg border border-white/10 bg-white/[0.03] p-1.5">
            <div
              className="relative overflow-hidden rounded-md"
              style={{ height: barHeightPx }}
            >
              <div
                className="absolute left-0 top-0 h-full bg-rose-500/80 transition-[width] duration-500"
                style={{ width: `${usedPct}%` }}
                aria-label="used"
              />
              <div
                className="absolute right-0 top-0 h-full bg-emerald-500/80 transition-[width] duration-500"
                style={{ width: `${remainingPct}%` }}
                aria-label="remaining"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="text-xs text-slate-400">Used (USD)</div>
              <div className="mt-1 font-semibold text-slate-100">${usedUsd.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="text-xs text-slate-400">Remaining (USD)</div>
              <div className="mt-1 font-semibold text-emerald-300">${remainingUsd.toFixed(2)}</div>
            </div>
          </div>

          {!compact && (
            <div className="mt-2 text-[11px] text-slate-400">
              Source: {limitUsd.toLocaleString()} USD monthly limit • Rate ${effectiveRate!.toFixed(2)}/1k
            </div>
          )}
        </>
      )}
    </div>
  );
}
