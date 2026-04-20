"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Video,
  Wand2,
  CircleUser,
  LogOut,
  ArrowLeft,
} from "lucide-react";

const navGroups = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/vods", label: "VODs", icon: Video },
      { href: "/dashboard/clips", label: "Clips", icon: Wand2 },
      { href: "/dashboard/settings", label: "Account", icon: CircleUser },
    ],
  },
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

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-[#090d15] border-r border-white/[0.06] flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
            <Wand2 size={12} className="text-accent-light" />
          </span>
          <span className="text-[17px] font-bold tracking-[-0.04em] text-gradient">LevlCast</span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="text-[10px] font-medium text-muted/40 px-3 mb-1">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-white/[0.07] text-white"
                        : "text-muted hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    <item.icon
                      size={16}
                      className={cn(isActive ? "text-accent-light" : "text-muted/60")}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-white/[0.06]">
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
