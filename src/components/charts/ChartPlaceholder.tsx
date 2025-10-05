import React from "react";

export default function ChartPlaceholder({ message = "Negligible spend so far — add more usage to see trends" }: { message?: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
      {message}
    </div>
  );
}
