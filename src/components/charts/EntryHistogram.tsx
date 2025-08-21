// src/components/charts/EntryHistogram.tsx
"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartTheme } from "./theme";
import { fmtUsd, fmtTokens } from "./utils";

type Entry = { tokens?: number; cost: number };

function niceStep(max: number, targetBins: number) {
  if (max <= 0) return 1;
  const raw = max / targetBins;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / pow;
  const nice =
    m >= 7.5 ? 10 :
    m >= 3   ? 5  :
    m >= 1.5 ? 2  : 1;
  return nice * pow;
}

function bucketize(values: number[], bins = 10) {
  const max = Math.max(0, ...values);
  const step = niceStep(max, bins) || 1;
  const edges: number[] = [];
  for (let v = 0; v <= max + step; v += step) edges.push(v);

  const counts = new Array(Math.max(1, edges.length - 1)).fill(0);
  for (const val of values) {
    let idx = Math.floor(val / step);
    if (idx >= counts.length) idx = counts.length - 1;
    counts[idx]++;
  }

  const rows = counts.map((c, i) => {
    const lo = edges[i];
    const hi = edges[i + 1];
    return {
      bucket: `${Math.round(lo)}–${Math.round(hi)}`,
      count: c,
      lo,
      hi,
    };
  });
  return rows;
}

export default function EntryHistogram({
  entries,
  metric = "tokens", // "tokens" | "cost"
  bins = 10,
  height = 220,
  ariaLabel = "Entry size distribution",
}: {
  entries: Entry[];
  metric?: "tokens" | "cost";
  bins?: number;
  height?: number;
  ariaLabel?: string;
}) {
  const values =
    metric === "tokens"
      ? entries.map((e) => Math.max(0, Number(e.tokens || 0)))
      : entries.map((e) => Math.max(0, Number(e.cost || 0)));

  const data = bucketize(values, bins);
  const isCost = metric === "cost";

  return (
    <div aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 6, right: 12, left: 12, bottom: 0 }}>
          <CartesianGrid stroke={chartTheme.grid.stroke} />
          <XAxis
            type="number"
            tick={{ ...chartTheme.axis.tick }}
            stroke={chartTheme.axis.line.stroke}
            allowDecimals={false}
          />
          <YAxis
            dataKey="bucket"
            type="category"
            width={120}
            tick={{ ...chartTheme.axis.tick }}
            stroke={chartTheme.axis.line.stroke}
          />
          <Tooltip
            contentStyle={{
              background: chartTheme.tooltip.bg,
              border: chartTheme.tooltip.border,
              borderRadius: chartTheme.tooltip.radius,
            }}
            labelStyle={{ color: chartTheme.tooltip.color }}
            formatter={(val: number, _name: string, p: any) => {
              const { payload } = p || {};
              const range = isCost
                ? `$${payload?.lo.toFixed(2)}–$${payload?.hi.toFixed(2)}`
                : `${Math.round(payload?.lo ?? 0)}–${Math.round(payload?.hi ?? 0)} tk`;
              return [val, `Entries in ${range}`];
            }}
          />
          <Bar
            dataKey="count"
            fill="rgba(124,58,237,0.35)"
            stroke="rgba(124,58,237,0.9)"
            strokeWidth={1.5}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
