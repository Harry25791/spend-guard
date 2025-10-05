// src/components/charts/ProviderStackArea.tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { buildProviderStack, type Period } from "@/lib/aggregate";
import { autoPeriod, fmtUsd } from "./utils";
import { chartTheme, rgba } from "./theme";
import ChartPlaceholder from "./ChartPlaceholder";
import { hasMeaningful, sumByKeys } from "./meaningful";

type Entry = { date: string | Date; cost: number; provider?: string };
type Props = {
  entries: Entry[];
  from?: Date;
  to?: Date;
  period?: Period;
  height?: number;
  ariaLabel?: string;
};

export default function ProviderStackArea({
  entries,
  from,
  to,
  period,
  height = 338,
  ariaLabel = "Spend by provider",
}: Props) {
  const per = period ?? autoPeriod(from, to);
  const { rows, providers } = buildProviderStack(entries, {
    period: per,
    from,
    to,
    normalizeProviderName: (s) => (s || "unknown").toLowerCase(),
  });

  // --- Top-4 providers + "Other" bundling (deduped, zero-totals filtered) ---
  const TOP_N = 4;
  const xKey = "key"; // x-axis field

  // Defensive copy
  const allProviders = [...providers];

  // Totals by provider across the whole period
  const totals: Record<string, number> = {};
  for (const r of rows as Array<Record<string, number>>) {
    for (const p of allProviders) {
      totals[p] = (totals[p] ?? 0) + Number(r[p] ?? 0);
    }
  }

  // Sort by total desc and split
  const sorted = allProviders.sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));
  const topProviders = sorted.slice(0, TOP_N);
  const otherProviders = sorted.slice(TOP_N);
  const otherTotal = otherProviders.reduce((s, p) => s + (totals[p] ?? 0), 0);

  // Rebuild rows with only: key + top providers + (optional) Other
  const stackRows = (rows as Array<Record<string, number | string>>).map((r) => {
    const out: Record<string, number | string> = { [xKey]: r[xKey] };
    for (const p of topProviders) out[p] = Number(r[p] ?? 0);
    if (otherProviders.length) {
      let sum = 0;
      for (const p of otherProviders) sum += Number(r[p] ?? 0);
      out["Other"] = sum;
    }
    return out;
  });

  // Providers to render (filter zero totals; "Other" only if > 0)
  const stackProviders = [
    ...topProviders.filter((p) => (totals[p] ?? 0) > 0),
    ...(otherTotal > 0 ? ["Other"] : []),
  ];

  // Color order: 0, 3, 4, 7, 8 (truncate to series count)
  // Make the top provider (first non-"Other") primary color and draw it last (on top)
  const primaryProvider = stackProviders.find((p) => p !== "Other");

  // Draw order: everyone else first, then the primary last so its line is on top
  const drawProviders = primaryProvider
    ? [...stackProviders.filter((p) => p !== primaryProvider), primaryProvider]
    : [...stackProviders];

  // Color map: primary -> series[0], others -> series[3], [4], [7], [8]
  const remainingIdx = [3, 4, 7, 8];
  const colorMap = new Map<string, string>();
  let idx = 0;
  for (const p of drawProviders) {
    if (p === primaryProvider) {
      colorMap.set(p, chartTheme.series[0]); // primary brand color
    } else {
      colorMap.set(p, chartTheme.series[remainingIdx[idx % remainingIdx.length]]);
      idx++;
    }
  }

  // Negligible data threshold (adjust if you like)
  const MIN_RENDER_USD = 0.01;

  // Grand total across the rendered series
  const grandTotal = sumByKeys(stackRows as any[], stackProviders as string[]);

  return (
    <div aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        {hasMeaningful(grandTotal) ? (
        <LineChart data={stackRows} margin={{ top: 8, right: 16, bottom: chartTheme.axis.fontSize * 1, left: 8 }}>
          <CartesianGrid stroke={chartTheme.grid.stroke} />
          <XAxis
            dataKey="key"
            axisLine={{ stroke: chartTheme.axis.line.stroke }}
            tickLine={{ stroke: chartTheme.axis.line.stroke }}
            tick={{ fill: chartTheme.axis.tick.fill, fontSize: chartTheme.axis.fontSize - 1 }}
            tickMargin={8}
            minTickGap={18}
          />
          <YAxis
            axisLine={{ stroke: chartTheme.axis.line.stroke }}
            tickLine={{ stroke: chartTheme.axis.line.stroke }}
            tick={{ fill: chartTheme.axis.tick.fill, fontSize: chartTheme.axis.fontSize }}
            stroke={chartTheme.axis.line.stroke}
            tickFormatter={(v) => fmtUsd(v as number)}
            width={60}
          />
          <Tooltip
            cursor={chartTheme.hoverCursor}
            contentStyle={{
              background: chartTheme.tooltip.bg,
              border: chartTheme.tooltip.border,
              borderRadius: chartTheme.tooltip.radius,
              color: chartTheme.tooltip.color,
            }}
            labelStyle={{ color: chartTheme.tooltip.color }}
            itemStyle={{ color: chartTheme.tooltip.color }}
            formatter={(val: number) => fmtUsd(val)}
          />
          <Legend wrapperStyle={{ color: chartTheme.tooltip.color }} />
          {drawProviders.map((p) => {
            const color = colorMap.get(p)!;
            return (
              <Line
                key={p}
                type="monotone"
                dataKey={p}
                stroke={rgba(color, 0.95)}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 2.5, style: { filter: chartTheme.shadowCss.glowSm } }}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
        ) : (
        <ChartPlaceholder />
      )}
      </ResponsiveContainer>
    </div>
  );
}
