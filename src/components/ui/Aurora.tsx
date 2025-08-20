export default function Aurora({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`absolute inset-0 -z-10 overflow-hidden ${className}`}>
      <div
        className="absolute -top-32 left-1/2 h-[60vmax] w-[60vmax] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(139,92,246,.35), transparent)" }}
      />
      <div
        className="absolute top-1/3 -right-24 h-[40vmax] w-[40vmax] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(34,211,238,.28), transparent)" }}
      />
    </div>
  );
}
