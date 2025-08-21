// src/components/dashboard/KPIRow.tsx
import React from "react";

export type KPI = { label: string; value: string; warn?: boolean };

export default function KPIRow({
  items,
  className = "",
}: {
  items: KPI[];
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {items.map((kpi, i) => (
        <div
          key={i}
          className={`sg-card px-4 py-3 ${kpi.warn ? "ring-1 ring-rose-400/30" : ""}`}
        >
          <div className="text-xs text-slate-400">{kpi.label}</div>
          <div className={`mt-1 text-lg font-semibold ${kpi.warn ? "text-rose-200" : ""}`}>
            {kpi.value}
          </div>
        </div>
      ))}
    </div>
  );
}
