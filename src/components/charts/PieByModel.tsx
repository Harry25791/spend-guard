// src/components/charts/PieByModel.tsx
"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { fmtUsd } from "./utils";
import { chartTheme } from "./theme";

type Entry = { model?: string; cost: number };

function prepare(entries: Entry[], topN: number) {
  const map = new Map<string, number>();
  for (const e of entries) {
    const key = (e.model || "unknown").trim();
    map.set(key, (map.get(key) || 0) + (Number(e.cost) || 0));
  }
  const rows = Array.from(map.entries())
    .map(([name, cost]) => ({ name, value: Number(cost.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);

  const top = rows.slice(0, topN);
  const rest = rows.slice(topN);
  const other = rest.reduce((s, r) => s + r.value, 0);
  if (other > 0) top.push({ name: "Other", value: Number(other.toFixed(2)) });
  return top;
}

const colorAt = (i: number) => `hsl(${(i * 39) % 360} 92% 58% / 0.9)`;

export default function PieByModel({
  entries,
  topN = 8,
  height = 260,
  ariaLabel = "Model share (cost)",
}: {
  entries: Entry[];
  topN?: number;
  height?: number;
  ariaLabel?: string;
}) {
  const data = prepare(entries, topN);

  return (
    <div aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart margin={{ top: 6, right: 12, left: 12, bottom: 0 }}>
          <Tooltip
            contentStyle={{
              background: chartTheme.tooltip.bg,
              border: chartTheme.tooltip.border,
              borderRadius: chartTheme.tooltip.radius,
            }}
            labelStyle={{ color: chartTheme.tooltip.color }}
            formatter={(val: number, name: string, props: any) => {
              const total = data.reduce((s, r) => s + r.value, 0) || 1;
              const pct = ((val / total) * 100).toFixed(1) + "%";
              return [fmtUsd(val), `${name} · ${pct}`];
            }}
          />
          <Legend wrapperStyle={{ color: "rgba(255,255,255,0.7)" }} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colorAt(i)} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
