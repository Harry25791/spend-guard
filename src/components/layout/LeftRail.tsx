"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/projects", label: "Projects", icon: "🗂️" },
  { href: "/reports",  label: "Reports",  icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function LeftRail() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem("ui.leftrail.collapsed");
    if (saved) setCollapsed(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("ui.leftrail.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <aside
      aria-label="Primary"
      className={cn(
        "sticky top-0 h-[100dvh] border-r border-white/10 bg-black/30 backdrop-blur",
        "px-2 py-3",
        collapsed ? "w-[68px]" : "w-56",
        "transition-[width] duration-200"
      )}
    >
      <button
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        className="mb-2 w-full rounded-lg border border-white/10 px-2 py-2 text-xs hover:border-white/20"
        onClick={() => setCollapsed((v) => !v)}
      >
        {collapsed ? "›" : "‹ Collapse"}
      </button>

      <nav role="navigation" aria-label="Main">
        <ul className="space-y-1">
          {NAV.map((n) => {
            const active =
              pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/40",
                    active ? "bg-white/10" : "hover:bg-white/5"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="text-lg">{n.icon}</span>
                  {!collapsed && <span className="text-sm">{n.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
