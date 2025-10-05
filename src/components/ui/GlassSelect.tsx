"use client";
import React, { useEffect, useRef, useState } from "react";

// Inline chevron to avoid external icon deps
function ChevronDown({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type Option = { value: string; label: string };

type Props = {
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  menuWidthClass?: string; // e.g., "w-64"
};

export default function GlassSelect({
  value, options, placeholder = "Select…", onChange, className = "", menuWidthClass = "w-56",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-slate-200 shadow-sm"
      >
        <span className={selected ? "" : "text-slate-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="opacity-80" />
      </button>

      {open && (
        <div className={`absolute z-[55] mt-2 ${menuWidthClass} rounded-xl border border-white/10 bg-slate-900/95 p-1 shadow-xl`}>
          <ul className="max-h-64 overflow-auto scrollbar-brand">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  className={`w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 ${opt.value === value ? "text-slate-50" : "text-slate-200"}`}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
