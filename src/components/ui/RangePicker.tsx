"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SCOPE_OPTIONS, type ViewScope } from "@/lib/io";

export default function RangePicker({
  value,
  onChange,
  className = "",
  label = "Range",
}: {
  value: ViewScope;
  onChange: (v: ViewScope) => void;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const idxByValue = useMemo(
    () => SCOPE_OPTIONS.findIndex((o) => o.value === value),
    [value]
  );
  const selected = SCOPE_OPTIONS[idxByValue];

  // Close on outside click / ESC
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const openMenu = () => {
    setOpen(true);
    setActiveIndex(idxByValue >= 0 ? idxByValue : 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => ((i ?? 0) + 1) % SCOPE_OPTIONS.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => ((i ?? 0) - 1 + SCOPE_OPTIONS.length) % SCOPE_OPTIONS.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activeIndex != null) {
        onChange(SCOPE_OPTIONS[activeIndex].value as ViewScope);
        setOpen(false);
      }
    }
  };

  return (
    <div
      ref={wrapRef}
      className={`inline-flex items-center gap-2 text-sm text-slate-300 ${className}`}
    >
      <span>{label}:</span>

      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-slate-100
                     hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 shadow-glow"
        >
          <span className="whitespace-nowrap">{selected?.label ?? "Select range"}</span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"/>
          </svg>
        </button>

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-2 w-48 overflow-hidden rounded-2xl border border-white/10
                       bg-[#0b1023]/95 backdrop-blur-md shadow-card"
          >
            {SCOPE_OPTIONS.map((opt, i) => {
              const active = i === activeIndex;
              const selected = opt.value === value;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => {
                    onChange(opt.value as ViewScope);
                    setOpen(false);
                  }}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm
                              ${active ? "bg-white/10 text-white" : "text-slate-200 hover:bg-white/10"}`}
                >
                  <span>{opt.label}</span>
                  {selected && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-cyan-300">
                      <path d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
