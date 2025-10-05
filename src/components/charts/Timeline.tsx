// src/components/charts/Timeline.tsx
"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildTimelineSeries, type Period } from "@/lib/aggregate";
import { autoPeriod, fmtUsd } from "./utils";
import { chartTheme, rgba, formatMetricName } from "./theme";
import ChartPlaceholder from "./ChartPlaceholder";
import { hasMeaningful } from "./meaningful";

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
  height = 340,
  valueKey = "cost",
  ariaLabel = "Spend timeline",
}: Props) {
  const per = period ?? autoPeriod(from, to);
  const data = buildTimelineSeries(entries, { period: per, from, to, cumulative });

  const isCost = valueKey === "cost" || valueKey === "cumCost";
  const BASE = chartTheme.series[0]; // brand primary (#C277FF)

  const MIN_RENDER_USD = 0.01;
  const MIN_RENDER_TOKENS = 5;
  const isTokens = valueKey === "tokens" || valueKey === "cumTokens";
  const grandTotal = Array.isArray(data)
    ? data.reduce((sum, d: any) => sum + Number(d[valueKey] ?? 0), 0)
    : 0;

  return (
    <div aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        {hasMeaningful(grandTotal, isTokens ? MIN_RENDER_TOKENS : MIN_RENDER_USD) ? (
        <AreaChart data={data} margin={{ top: 6, right: 16, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="sgTimelineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={rgba(BASE, 0.38)} />
              <stop offset="100%" stopColor={rgba(BASE, 0.06)} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chartTheme.grid.stroke} />
          <XAxis
            dataKey="key"
            axisLine={{ stroke: chartTheme.axis.line.stroke }}
            tickLine={{ stroke: chartTheme.axis.line.stroke }}
            tick={{ fill: chartTheme.axis.tick.fill, fontSize: chartTheme.axis.fontSize - 2 }}
            angle={-45}
            textAnchor="end"
            height={chartTheme.axis.fontSize * 5}  // extra room for rotated labels
            tickMargin={8}
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
            formatter={(val: number | string, name: string) => [
              isCost ? fmtUsd(Number(val)) : `${Math.round(Number(val))} tk`,
              formatMetricName(name),
            ]}
          />
          <Area
            type="monotone"
            dataKey={valueKey}
            fill="url(#sgTimelineFill)"
            stroke={rgba(BASE, 0.85)}
            strokeWidth={3}
            strokeLinecap="round"
            activeDot={{ r: 3, style: { filter: chartTheme.shadowCss.glowSm } }}
          />
        </AreaChart>
        ) : (
        <ChartPlaceholder />
      )}
      </ResponsiveContainer>
    </div>
  );
}
