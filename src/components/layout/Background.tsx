"use client";

export default function Background() {
  // One fixed, full-viewport gradient that never scrolls = no seams
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
    >
      {/* Base tint */}
      <div className="absolute inset-0 bg-[#0b1220]" />

      {/* Soft radial glow center-top */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(98,54,255,0.18), transparent 60%)",
        }}
      />

      {/* Aurora sweep bottom-left to top-right */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(140deg, rgba(43,74,119,0.25) 0%, rgba(18,28,53,0.0) 40%, rgba(14,20,44,0.0) 60%, rgba(5,31,46,0.28) 100%)",
        }}
      />
    </div>
  );
}
