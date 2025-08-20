export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-slate-100 sg-noise">
      <main className="mx-auto max-w-6xl px-6 py-6 relative">
        {children}
      </main>
    </div>
  );
}
