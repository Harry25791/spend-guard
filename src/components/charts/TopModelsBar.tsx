"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Line } from "recharts";
import { chartTheme, rgba, formatMetricName } from "./theme";
import { fmtUsd } from "./utils";
import ChartPlaceholder from "./ChartPlaceholder";
import { hasMeaningful } from "./meaningful";

type TickProps = { x: number; y: number; payload: { value: string } };

// Wrap into max 2 lines; add ellipsis ONLY if text overflows the 2nd line
function TwoLineTick({ x, y, payload }: TickProps) {
  const maxCharsPerLine = 12; // wider lines than before (reduce truncation)
  const text = String(payload?.value ?? '').trim();
  if (!text) return null;

  const words = text.split(/[\s/_-]+/); // split on spaces + common separators
  const lines: string[] = [''];         // start with first line
  let idx = 0;

  for (const w of words) {
    const tryAdd = lines[idx] ? `${lines[idx]} ${w}` : w;
    if (tryAdd.length <= maxCharsPerLine) {
      lines[idx] = tryAdd;              // fits current line
      continue;
    }
    // doesn't fit current line
    if (idx === 0) {
      idx = 1;
      lines[idx] = w;                   // move to second line
      continue;
    }
    // overflow on the second line -> ellipsize and stop
    const second = (lines[1] ? `${lines[1]} ${w}` : w).slice(0, maxCharsPerLine - 1) + '…';
    lines[1] = second;
    break;
  }

  // If the full text fit within two lines, DO NOT add ellipsis
  // (above logic only adds '…' when a word causes overflow)

  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fontSize={chartTheme.axis.fontSize}>
        <tspan x={0} dy="0.71em" fill={chartTheme.axis.tick.fill}>
          {lines[0]}
        </tspan>
        {lines[1] && (
          <tspan x={0} dy={chartTheme.axis.fontSize} fill={chartTheme.axis.tick.fill}>
            {lines[1]}
          </tspan>
        )}
      </text>
    </g>
  );
}

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

const BASE = chartTheme.series[0];      // violet-600 '#7C3AED'
const FILL = rgba(BASE, 0.10);          // normal fill
const STROKE = rgba(BASE, 0.95);        // outline
const FILL_HOVER = rgba(BASE, 0.60);    // hover fill

export default function TopModelsBar({
  entries, topN = 8, height = 340, ariaLabel = "Top models by cost",
}: { entries: Entry[]; topN?: number; height?: number; ariaLabel?: string; }) {
  const [hi, setHi] = useState<number | null>(null);
  const data = prepare(entries, Math.min(topN, 4));

  const total = data.reduce((s, d: any) => s + Number(d.usd ?? d.cost ?? 0), 0);


  const MIN_RENDER_USD = 0.01;
  const grandTotal = data.reduce((sum, d: any) => sum + Number(d.usd ?? d.cost ?? 0), 0);

  return (
    <div role="img" aria-label={ariaLabel} className="h-[var(--h,240px)]" style={{ ['--h' as any]: `${height}px` }}>
      <ResponsiveContainer width="100%" height={height}>
        {hasMeaningful(grandTotal) ? (
        <BarChart
          data={data}
          margin={{ left: 8, right: 16, top: 16, bottom: -8 }}
          onMouseMove={(s: any) => setHi(typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)}
          onMouseLeave={() => setHi(null)}
        >
          <CartesianGrid stroke={chartTheme.grid.stroke} vertical={false} />
          <XAxis
            dataKey="model"
            axisLine={{ stroke: chartTheme.axis.line.stroke }}
            tickLine={{ stroke: chartTheme.axis.line.stroke }}
            tick={(props: any) => <TwoLineTick {...props} />} // custom two-line tick
            height={chartTheme.axis.fontSize * 5}
            tickMargin={8}
            minTickGap={-40}                 // <-- more spacing before Recharts hides ticks
            interval="preserveStartEnd"     // <-- keep first/last; hide middle if needed
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
            formatter={(val: number | string, name: string) => [fmtUsd(Number(val)), formatMetricName(name)]}
          />
          <Bar dataKey="cost" stroke={STROKE} strokeWidth={1.4} radius={[6,6,6,6]}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={hi === i ? FILL_HOVER : FILL}
                className={hi === i ? "sg-glow-violet" : ""}
                strokeWidth={3}
              />
            ))}
          </Bar>
        </BarChart>
          ) : (
        <ChartPlaceholder />
      )}
      </ResponsiveContainer>
    </div>
  );
}
