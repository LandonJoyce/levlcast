"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Film,
  Scissors,
  BarChart3,
  Link2,
  Settings,
  LogOut,
  ArrowLeft,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { LATEST_CHANGELOG_DATE } from "@/lib/changelog";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/vods", label: "VODs", icon: Film },
  { href: "/dashboard/clips", label: "Clips", icon: Scissors },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/grow", label: "Growth", icon: TrendingUp },
  { href: "/dashboard/connections", label: "Connections", icon: Link2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  user: {
    display_name: string;
    avatar_url: string;
    login: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("changelog_seen");
    setHasUnread(seen !== LATEST_CHANGELOG_DATE);
  }, []);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-surface border-r border-border flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border">
        <Link href="/dashboard" className="text-xl font-extrabold text-gradient">
          LevlCast
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-accent/15 text-white"
                  : "text-muted hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <item.icon
                size={18}
                className={cn(isActive ? "text-accent-light" : "text-muted")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* What's New */}
      <div className="px-3 pb-2">
        <Link
          href="/changelog"
          onClick={() => setHasUnread(false)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
            pathname === "/changelog"
              ? "bg-accent/15 text-white"
              : "text-muted hover:text-white hover:bg-white/[0.04]"
          )}
        >
          <Sparkles size={18} className={cn(pathname === "/changelog" ? "text-accent-light" : "text-muted")} />
          <span className="flex-1">Patch Notes</span>
          {hasUnread && (
            <span className="w-2 h-2 rounded-full bg-accent-light flex-shrink-0" />
          )}
        </Link>
      </div>

      {/* User section */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.display_name}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent-light">
              {user.display_name?.[0] || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {user.display_name}
            </p>
            <p className="text-xs text-muted truncate">@{user.login}</p>
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted hover:text-white hover:bg-white/[0.04] transition-all w-full"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>
        <button
          onClick={async () => {
            await fetch("/auth/logout", { method: "POST" });
            window.location.href = "/auth/login";
          }}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted hover:text-white hover:bg-white/[0.04] transition-all w-full"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </aside>
  );
}
