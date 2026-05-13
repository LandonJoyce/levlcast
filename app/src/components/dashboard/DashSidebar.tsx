"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FeedbackModal } from "./feedback-modal";

interface DashSidebarProps {
  user: {
    display_name: string;
    avatar_url: string;
    login: string;
  };
  vodCount?: number;
  clipCount?: number;
  isPro?: boolean;
}

const navItems = [
  { id: "dashboard",    label: "Dashboard",   href: "/dashboard" },
  { id: "vods",         label: "VODs",        href: "/dashboard/vods" },
  { id: "clips",        label: "Clips",       href: "/dashboard/clips" },
  { id: "connections",  label: "Connections", href: "/dashboard/connections" },
  { id: "account",      label: "Account",     href: "/dashboard/settings" },
];

const Icons = {
  Logo: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 4l8 8-8 8M13 4l8 8-8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Grid: () => (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
  Vid: () => (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M17 10l4-2v8l-4-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
  Clip: () => (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M20 4L8.5 15.5M20 20L8.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Arrow: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Target: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
    </svg>
  ),
  LogOut: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Home: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Link: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Chat: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

export default function DashSidebar({ user, vodCount, clipCount, isPro }: DashSidebarProps) {
  const pathname = usePathname();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [unreadReplies, setUnreadReplies] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feedback/replies");
        if (!res.ok) return;
        const json = await res.json();
        const list = (json.replies as Array<{ user_seen_reply: boolean }>) ?? [];
        const unread = list.filter((r) => !r.user_seen_reply).length;
        if (!cancelled) setUnreadReplies(unread);
      } catch {
        // Silent: dot just won't appear.
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);
  const active = pathname === "/dashboard"
    ? "dashboard"
    : pathname.startsWith("/dashboard/vods")
    ? "vods"
    : pathname.startsWith("/dashboard/clips")
    ? "clips"
    : pathname.startsWith("/dashboard/connections")
    ? "connections"
    : pathname.startsWith("/dashboard/settings")
    ? "account"
    : "";

  const itemIcon = (id: string) => {
    switch (id) {
      case "dashboard":   return <Icons.Grid />;
      case "vods":        return <Icons.Vid />;
      case "clips":       return <Icons.Clip />;
      case "connections": return <Icons.Link />;
      case "outreach":    return <Icons.Target />;
      case "account":     return <Icons.User />;
      default:            return null;
    }
  };

  const handleLogout = async () => {
    await fetch("/auth/logout", { method: "POST" });
    window.location.href = "/auth/login";
  };

  return (
    <aside className="sb">
      <div className="sb-logo">
        <span>LevlCast</span>
      </div>
      <div className="sb-section">Workspace</div>

      {navItems.map((it) => {
        const isActive = active === it.id;
        const badge = it.id === "vods" && vodCount !== undefined ? String(vodCount)
                    : it.id === "clips" && clipCount !== undefined ? String(clipCount)
                    : null;
        return (
          <Link key={it.id} href={it.href} className={`sb-link ${isActive ? "active" : ""}`}>
            <span className="ico">{itemIcon(it.id)}</span>
            <span>{it.label}</span>
            {badge && <span className="badge">{badge}</span>}
          </Link>
        );
      })}

      <div className="sb-spacer" />

      {!isPro && (
        <div className="upgrade" style={{ margin: "0 0 14px" }}>
          <div className="eb">Founding Member</div>
          <h4>Unlock Pro</h4>
          <p>Full report on every stream + auto-clipping. $9.99/mo locked for life.</p>
          <Link href="/dashboard/settings" className="btn btn-blue" style={{ padding: "7px 12px", fontSize: 12 }}>
            Upgrade <Icons.Arrow />
          </Link>
        </div>
      )}

      <div className="sb-foot">
        <div className="sb-user">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.display_name}
              className="av"
              style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--line)", flexShrink: 0, objectFit: "cover" }}
            />
          ) : (
            <span className="av" />
          )}
          <div className="who">
            <b>{user.display_name}</b>
            <span>@{user.login}</span>
          </div>
        </div>
        <Link href="/" className="sb-link" style={{ fontSize: 12 }}>
          <span className="ico"><Icons.Home /></span>
          <span>Back to home</span>
        </Link>
        <button
          onClick={() => setFeedbackOpen(true)}
          className="sb-link"
          style={{ fontSize: 12, background: "transparent", border: 0, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit", position: "relative" }}
        >
          <span className="ico"><Icons.Chat /></span>
          <span>Send feedback</span>
          {unreadReplies > 0 && (
            <span style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 18,
              height: 18,
              padding: "0 6px",
              borderRadius: 999,
              background: "#F26179",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
            }}>
              {unreadReplies}
            </span>
          )}
        </button>
        <button
          onClick={handleLogout}
          className="sb-link"
          style={{ fontSize: 12, background: "transparent", border: 0, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit" }}
        >
          <span className="ico"><Icons.LogOut /></span>
          <span>Log out</span>
        </button>
      </div>
      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        defaultCategory="general"
        trigger="sidebar"
      />
    </aside>
  );
}
