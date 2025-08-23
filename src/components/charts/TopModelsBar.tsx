"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { chartTheme } from "./theme";
import { fmtUsd } from "./utils";

type Entry = { model?: string; cost: number };

function prepare(entries: Entry[], topN: number) {
  const map = new Map<string, number>();
  for (const e of entries) {
    const key = (e.model || "unknown").trim();
    map.set(key, (map.get(key) || 0) + (Number(e.cost) || 0));
  }
  return Array.from(map.entries())
    .map(([model, cost]) => ({ model, cost: Number(cost.toFixed(2)) }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, topN);
}

const FILL = "rgba(139,92,246,0.38)";   // violet (deeper)
const STROKE = "rgba(139,92,246,0.85)"; // violet outline
const FILL_HOVER = "rgba(139,92,246,0.6)";

export default function TopModelsBar({
  entries, topN = 8, height = 240, ariaLabel = "Top models by cost",
}: { entries: Entry[]; topN?: number; height?: number; ariaLabel?: string; }) {
  const [hi, setHi] = useState<number | null>(null);
  const data = prepare(entries, topN);

  return (
    <div role="img" aria-label={ariaLabel} className="h-[var(--h,240px)]" style={{ ['--h' as any]: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ left: 6, right: 12, top: 8, bottom: 8 }}
          onMouseMove={(s: any) => setHi(typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)}
          onMouseLeave={() => setHi(null)}
        >
          <CartesianGrid stroke={chartTheme.grid.stroke} vertical={false} />
          <XAxis dataKey="model" tick={{ ...chartTheme.axis.tick, fontSize: 11 }} axisLine={{ ...chartTheme.axis.line }} tickMargin={8}/>
          <YAxis tick={chartTheme.axis.tick} axisLine={{ ...chartTheme.axis.line }} width={64}/>
          <Tooltip
            contentStyle={{ background: chartTheme.tooltip.bg, border: chartTheme.tooltip.border, borderRadius: chartTheme.tooltip.radius }}
            labelStyle={{ color: chartTheme.tooltip.color }}
            formatter={(val: number) => fmtUsd(val)}
          />
          <Bar dataKey="cost" stroke={STROKE} strokeWidth={1.4} radius={[6,6,6,6]}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={hi === i ? FILL_HOVER : FILL}
                className={hi === i ? "sg-glow-violet" : ""}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
