"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** PNG icons expected under /public/rail/ */
const NAV = [
  { href: "/",         label: "Dashboard", icon: "/rail/ShieldIcon.png" },
  { href: "/projects", label: "Projects",  icon: "/rail/ProjectsIcon.png" },
  { href: "/reports",  label: "Reports",   icon: "/rail/ReportsIcon.png" },
  { href: "/settings", label: "Settings",  icon: "/rail/SettingsIcon.png" },
];

// Single knob for icon size (you can also set this globally in :root)
const ICON_SIZE = "40px"; // change to "22px", "24px", etc.

export default function LeftRail() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // persist collapsed state
  useEffect(() => {
    const saved = localStorage.getItem("ui.leftrail.collapsed");
    if (saved) setCollapsed(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("ui.leftrail.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div
      role="complementary"
      aria-label="Primary"
      className={cn(
        // NOTE: AppShell wraps this in a fixed <aside>; no sticky/fixed here
        "h-[100dvh] border-r border-white/10 bg-black/30 backdrop-blur",
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
                  title={n.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/40",
                    active ? "bg-white/10 text-white" : "hover:bg-white/5 text-white/90"
                  )}
                >
                  {/* icon box controls the rendered PNG size */}
                  <span
                    className="relative shrink-0"
                    style={{ width: ICON_SIZE, height: ICON_SIZE }}
                    aria-hidden
                  >
                    <Image
                      src={n.icon}
                      alt=""
                      fill
                      className={cn(
                        "object-contain",
                        active
                          ? "opacity-100 drop-shadow-[0_0_10px_rgba(139,92,246,.45)]"
                          : "opacity-80 group-hover:opacity-95"
                      )}
                      priority={n.href === "/"}
                    />
                  </span>

                  {!collapsed && (
                    <span className="text-sm font-medium">{n.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
