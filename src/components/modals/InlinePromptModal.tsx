"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Buttons";

type Props = {
  open: boolean;
  title?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
};

export default function InlinePromptModal({
  open,
  title = "Enter value",
  placeholder,
  initialValue = "",
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  onClose,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => { if (open) setValue(initialValue ?? ""); }, [open, initialValue]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop, same as AlertsModal */}
      <button aria-label="Close" className="absolute inset-0 bg-black/55" onClick={onClose} />
      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[#0f172a]/95 p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
        </div>

        <div className="space-y-3">
          {/* keep the white outline look */}
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl bg-transparent border border-white/20 px-3 py-2 text-slate-100 placeholder-slate-400"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>{cancelLabel}</Button>
            <Button
              size="sm"
              onClick={() => {
                const v = value.trim();
                if (!v) return;
                onSubmit(v);              // parent decides whether to open the next step or close
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
