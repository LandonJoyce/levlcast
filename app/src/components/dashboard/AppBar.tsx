"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { FeedbackModal } from "./feedback-modal";
import { UpgradeModal } from "./upgrade-modal";

/**
 * The bar across the top of every signed-in page. It replaced a left
 * sidebar (with a "Workspace" heading, a Pro card and a user block) and a
 * breadcrumb bar, so the app now sits under the same kind of bar as
 * levlcast.com: the wordmark, the pages, and on the right the plan and
 * the account menu.
 *
 * The free plan's weekly allowance used to be a banner at the top of every
 * page. It's the chip on the right now; pressing it opens the same upgrade
 * window, with the pitch built from the streamer's own reports.
 */

const LINKS = [
  { href: "/dashboard", label: "Home", active: (p: string) => p === "/dashboard" },
  { href: "/dashboard/vods", label: "Streams", active: (p: string) => p.startsWith("/dashboard/vods") },
  { href: "/dashboard/clips", label: "Clips", active: (p: string) => p.startsWith("/dashboard/clips") },
  { href: "/dashboard/history", label: "Matches", active: (p: string) => p.startsWith("/dashboard/history") },
  { href: "/leaderboard", label: "Leaderboard", active: () => false },
];

export interface AppBarProps {
  user: { display_name: string; avatar_url: string; login: string };
  isPro: boolean;
  /** Present on the free plan: what's left of this week's allowance. */
  trial: { analysesLeft: number; clipsLeft: number } | null;
  upgradeReason: string | null;
  collabPendingCount: number;
}

export default function AppBar({ user, isPro, trial, upgradeReason, collabPendingCount }: AppBarProps) {
  const pathname = usePathname();
  const [menu, setMenu] = useState<"account" | "sheet" | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [unreadReplies, setUnreadReplies] = useState(0);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMenu(null), [pathname]);

  // Replies from Landon to the streamer's feedback, marked on the menu.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feedback/replies");
        if (!res.ok) return;
        const json = await res.json();
        const list = (json.replies as Array<{ user_seen_reply: boolean }>) ?? [];
        if (!cancelled) setUnreadReplies(list.filter((r) => !r.user_seen_reply).length);
      } catch {
        // No badge, nothing else lost.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const onDown = (e: PointerEvent) => {
      if (menu === "account" && !accountRef.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [menu]);

  useEffect(() => {
    if (menu !== "sheet") return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [menu]);

  const logout = async () => {
    await fetch("/auth/logout", { method: "POST" });
    window.location.href = "/auth/login";
  };

  const left = trial?.analysesLeft ?? 0;
  const planLabel = isPro
    ? "Pro"
    : trial
      ? left === 0
        ? "Free · none left, resets Monday"
        : `Free · ${left} ${left === 1 ? "report" : "reports"} left`
      : "Free";

  const accountLinks = (
    <>
      <Link href="/dashboard/settings" className="ab-item">Account</Link>
      <Link href="/dashboard/collabs" className="ab-item">
        Collabs
        {collabPendingCount > 0 && <span className="ab-count">{collabPendingCount}</span>}
      </Link>
      <button
        type="button"
        className="ab-item"
        onClick={() => {
          setMenu(null);
          setFeedbackOpen(true);
        }}
      >
        Send feedback
        {unreadReplies > 0 && <span className="ab-count">{unreadReplies}</span>}
      </button>
      <Link href="/" className="ab-item">LevlCast homepage</Link>
      <button type="button" className="ab-item ab-item-quiet" onClick={logout}>
        Log out
      </button>
    </>
  );

  return (
    <header className="ab">
      <div className="ab-in">
        <Link href="/dashboard" className="ab-mark">LevlCast</Link>

        <nav className="ab-nav" aria-label="App">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.active(pathname) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ab-right">
          {isPro ? (
            <span className="ab-plan ab-plan-pro">Pro</span>
          ) : (
            <button
              type="button"
              className="ab-plan"
              data-empty={trial && left === 0 ? "yes" : undefined}
              onClick={() => setUpgradeOpen(true)}
            >
              {planLabel}
            </button>
          )}

          <div className="ab-account" ref={accountRef}>
            <button
              type="button"
              className="ab-avatar"
              aria-label="Account menu"
              aria-expanded={menu === "account"}
              onClick={() => setMenu((m) => (m === "account" ? null : "account"))}
            >
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt="" width={32} height={32} />
              ) : (
                <span>{user.display_name.slice(0, 1)}</span>
              )}
              {(unreadReplies > 0 || collabPendingCount > 0) && <i className="ab-dot" aria-hidden="true" />}
            </button>
            {menu === "account" && (
              <div className="ab-menu">
                <div className="ab-who">
                  <b>{user.display_name}</b>
                  <span>@{user.login}</span>
                </div>
                {accountLinks}
              </div>
            )}
          </div>

          <button type="button" className="ab-burger" aria-label="Open menu" onClick={() => setMenu("sheet")}>
            <Menu size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      {menu === "sheet" && (
        <div className="ab-sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="ab-sheet-top">
            <Link href="/dashboard" className="ab-mark">LevlCast</Link>
            <button type="button" className="ab-burger" aria-label="Close menu" onClick={() => setMenu(null)} autoFocus>
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <nav className="ab-sheet-nav" aria-label="App">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={l.active(pathname) ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ab-sheet-account">
            <div className="ab-who">
              <b>{user.display_name}</b>
              <span>@{user.login}</span>
            </div>
            {accountLinks}
          </div>
        </div>
      )}

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} defaultCategory="general" trigger="sidebar" />
      {!isPro && (
        <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason={upgradeReason ?? ""} />
      )}
    </header>
  );
}
