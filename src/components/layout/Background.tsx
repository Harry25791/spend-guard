"use client";

export default function Background() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-50"  // <- push way behind
    >
      <div className="absolute inset-0 bg-[#0b1220]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(98,54,255,0.18), transparent 60%)",
        }}
      />
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
