// src/components/charts/TopModelsBar.tsx
"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartTheme } from "./theme";
import { fmtUsd } from "./utils";

type Entry = { model?: string; cost: number };

function prepare(entries: Entry[], topN: number) {
  const map = new Map<string, number>();
  for (const e of entries) {
    const key = (e.model || "unknown").trim();
    map.set(key, (map.get(key) || 0) + (Number(e.cost) || 0));
  }
  const rows = Array.from(map.entries())
    .map(([model, cost]) => ({ model, cost: Number(cost.toFixed(2)) }))
    .sort((a, b) => b.cost - a.cost);

  const top = rows.slice(0, topN);
  const rest = rows.slice(topN);
  const otherSum = rest.reduce((s, r) => s + r.cost, 0);
  if (otherSum > 0) top.push({ model: "Other", cost: Number(otherSum.toFixed(2)) });
  return top.reverse(); // smallest at top for nicer labels
}

type Props = {
  entries: Entry[];
  topN?: number;
  height?: number;
  ariaLabel?: string;
};

export default function TopModelsBar({ entries, topN = 5, height = 260, ariaLabel = "Top models" }: Props) {
  const data = prepare(entries, topN);

  return (
    <div aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 6, right: 12, left: 12, bottom: 0 }}>
          <CartesianGrid stroke={chartTheme.grid.stroke} />
          <XAxis
            type="number"
            tick={{ ...chartTheme.axis.tick }}
            stroke={chartTheme.axis.line.stroke}
            tickFormatter={(v) => fmtUsd(v as number)}
          />
          <YAxis
            dataKey="model"
            type="category"
            tick={{ ...chartTheme.axis.tick }}
            stroke={chartTheme.axis.line.stroke}
            width={120}
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
          <Bar dataKey="cost" fill="rgba(34,211,238,0.35)" stroke="rgba(34,211,238,0.9)" strokeWidth={1.5} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
