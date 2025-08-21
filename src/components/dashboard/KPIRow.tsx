import SGCard from "@/components/ui/SGCard";

type KPI = { label: string; value: string; sub?: string; warn?: boolean };

export default function KPIRow({ items }: { items: KPI[] }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {items.map((k) => (
        <SGCard
          key={k.label}
          ariaLabel={k.label}
          className={k.warn ? "ring-1 ring-red-500/30" : ""}
        >
          <div className="text-xs/4 text-white/60">{k.label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{k.value}</div>
          {k.sub && <div className="mt-1 text-xs text-white/50">{k.sub}</div>}
        </SGCard>
      ))}
    </section>
  );
}
