// src/components/charts/MiniLine.tsx
"use client";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { buildTimelineSeries, type Period } from "@/lib/aggregate";
import { autoPeriod, fmtUsd } from "./utils";
import { chartTheme } from "./theme";

type Entry = { date: string | Date; cost: number; tokens?: number };

type Props = {
  entries: Entry[];
  from?: Date;
  to?: Date;
  period?: Period;
  height?: number;
  showGrid?: boolean;
  valueKey?: "cost" | "tokens";
  ariaLabel?: string;
};

export default function MiniLine({
  entries,
  from,
  to,
  period,
  height = 140,
  showGrid = false,
  valueKey = "cost",
  ariaLabel = "Mini timeline",
}: Props) {
  const per = period ?? autoPeriod(from, to);
  const data = buildTimelineSeries(entries, { period: per, from, to });
  const isCost = valueKey === "cost";

  return (
    <div aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          {showGrid && <CartesianGrid stroke={chartTheme.grid.stroke} />}
          <XAxis dataKey="key" hide tick={{ ...chartTheme.axis.tick }} stroke={chartTheme.axis.line.stroke} />
          <YAxis hide tick={{ ...chartTheme.axis.tick }} stroke={chartTheme.axis.line.stroke} />
          <Tooltip
            contentStyle={{
              background: chartTheme.tooltip.bg,
              border: chartTheme.tooltip.border,
              borderRadius: chartTheme.tooltip.radius,
            }}
            labelStyle={{ color: chartTheme.tooltip.color }}
            formatter={(val: number) => (isCost ? fmtUsd(val) : `${Math.round(val)} tk`)}
          />
          <Line
            type="monotone"
            dataKey="cost"
            stroke="rgba(139,92,246,0.9)"      // visible stroke
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4, className: "sg-glow-violet", style: { filter: "drop-shadow(0 0 10px rgba(139,92,246,.6))" } }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
