// src/components/charts/ModelStackArea.tsx
"use client";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildModelStack, type Period } from "@/lib/aggregate";
import { autoPeriod, fmtUsd } from "./utils";
import { chartTheme } from "./theme";

type Entry = { date: string | Date; cost: number; model?: string };
type Props = {
  entries: Entry[];
  from?: Date;
  to?: Date;
  period?: Period;
  height?: number;
  ariaLabel?: string;
};

export default function ModelStackArea({
  entries,
  from,
  to,
  period,
  height = 260,
  ariaLabel = "Spend by model",
}: Props) {
  const per = period ?? autoPeriod(from, to);
  const { rows, models } = buildModelStack(entries, {
    period: per,
    from,
    to,
    normalizeModelName: (s) => (s || "unknown").toLowerCase(),
  });

  return (
    <div aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={chartTheme.grid.stroke} />
          <XAxis dataKey="key" tick={{ ...chartTheme.axis.tick }} stroke={chartTheme.axis.line.stroke} />
          <YAxis
            tick={{ ...chartTheme.axis.tick }}
            stroke={chartTheme.axis.line.stroke}
            tickFormatter={(v) => fmtUsd(v as number)}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: chartTheme.tooltip.bg,
              border: chartTheme.tooltip.border,
              borderRadius: chartTheme.tooltip.radius,
            }}
            labelStyle={{ color: chartTheme.tooltip.color }}
            formatter={(val: number) => fmtUsd(val)}
          />
          <Legend wrapperStyle={{ color: "rgba(255,255,255,0.7)" }} />
          {models.map((m, i) => (
            <Area
              key={m}
              type="monotone"
              dataKey={m}
              stackId="cost"
              fill={`hsl(${(i * 37) % 360} 90% 55% / 0.22)`}
              stroke={`hsl(${(i * 37) % 360} 90% 60% / 0.9)`}
              strokeWidth={2}
              activeDot={{ r: 2.5 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
