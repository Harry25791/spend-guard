// src/components/charts/Timeline.tsx
"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildTimelineSeries, type Period } from "@/lib/aggregate";
import { autoPeriod, fmtUsd } from "./utils";
import { chartTheme } from "./theme";

type Entry = { date: string | Date; cost: number; tokens?: number };
type Props = {
  entries: Entry[];
  from?: Date;
  to?: Date;
  period?: Period;          // optional override
  cumulative?: boolean;     // show running total
  height?: number;          // px
  valueKey?: "cost" | "tokens" | "cumCost" | "cumTokens";
  ariaLabel?: string;
};

export default function Timeline({
  entries,
  from,
  to,
  period,
  cumulative = false,
  height = 260,
  valueKey = "cost",
  ariaLabel = "Spend timeline",
}: Props) {
  const per = period ?? autoPeriod(from, to);
  const data = buildTimelineSeries(entries, { period: per, from, to, cumulative });

  const isCost = valueKey === "cost" || valueKey === "cumCost";

  return (
    <div aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={chartTheme.grid.stroke} />
          <XAxis
            dataKey="key"
            tick={{ ...chartTheme.axis.tick }}
            stroke={chartTheme.axis.line.stroke}
          />
          <YAxis
            tick={{ ...chartTheme.axis.tick }}
            stroke={chartTheme.axis.line.stroke}
            tickFormatter={(v) => (isCost ? fmtUsd(v as number) : String(v))}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: chartTheme.tooltip.bg,
              border: chartTheme.tooltip.border,
              borderRadius: chartTheme.tooltip.radius,
            }}
            labelStyle={{ color: chartTheme.tooltip.color }}
            formatter={(val: number, _name, _p) => (isCost ? fmtUsd(val) : `${Math.round(val)} tk`)}
          />
          <Area
            type="monotone"
            dataKey={valueKey}
            fill="rgba(139,92,246,0.22)"
            stroke="rgba(139,92,246,0.85)"
            strokeWidth={2}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
