"use client";

export default function Background() {
  return (
    <div aria-hidden className="fixed inset-0 -z-50 pointer-events-none">
      {/* Darker base to better match the avatar artwork */}
      <div className="absolute inset-0 bg-[#070716]" />

      {/* Top radial glow (brand purple tone) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(138,77,255,0.20), transparent 60%)",
        }}
      />

      {/* Gentle diagonal wash tuned for violet theme */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(140deg, rgba(47,29,92,0.24) 0%, rgba(20,16,42,0.0) 45%, rgba(10,8,28,0.0) 65%, rgba(20,10,40,0.28) 100%)",
        }}
      />
    </div>
  );
}
