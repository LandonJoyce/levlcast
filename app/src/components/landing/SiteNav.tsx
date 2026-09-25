"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  AudioWaveform,
  BookOpen,
  ChevronDown,
  ChevronsUp,
  ClipboardPaste,
  Mail,
  Medal,
  Menu,
  Scissors,
  Smartphone,
  Swords,
  Tag,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import { APP_STORE_URL, AppleIcon } from "./site-links";

/**
 * The links in the top bar, with a Product menu that opens a panel of
 * everything LevlCast does (the kind of menu OpusClip has, in this site's
 * colours). On a phone the same links open as a full-screen sheet.
 *
 * Opens on hover where there's a mouse and on click or tap everywhere.
 * Closes on Escape, a click outside, or picking something.
 */

interface Item {
  href: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  tag?: string;
  /** Leaves the site (App Store, email), so it's a plain <a>. */
  external?: boolean;
}

const FEATURES: Item[] = [
  { href: "/analyze", title: "Free stream report", blurb: "Paste any VOD. No account needed.", icon: ClipboardPaste },
  { href: "/twitch-vod-analyzer", title: "VOD analyzer", blurb: "Dead air, slow starts and what landed, with timestamps.", icon: AudioWaveform },
  { href: "/twitch-clip-generator", title: "Clip generator", blurb: "Finds the moments worth posting and cuts them.", icon: Scissors },
  { href: "/twitch-stream-coach", title: "Stream coach", blurb: "One fix per stream, checked next time.", icon: Target },
  { href: "/#ladder", title: "Rank ladder", blurb: "Iron to Grandmaster, on your own progress.", icon: ChevronsUp },
  { href: "/#ranked", title: "Weekly leagues", blurb: "Race the streamers nearest your rank.", icon: Swords, tag: "New" },
];

/** In the bar on desktop, so only the phone sheet lists it. */
const PRICING: Item = { href: "/#pricing", title: "Pricing", blurb: "Free, or Pro at $14.99 a month.", icon: Tag };

const MORE: Item[] = [
  { href: "/leaderboard", title: "Leaderboard", blurb: "The top 50 streamers right now.", icon: Medal },
  { href: APP_STORE_URL, title: "iPhone app", blurb: "LevlCast on your iPhone.", icon: Smartphone, external: true },
  { href: "/how-to-grow-on-twitch", title: "Growth guide", blurb: "What actually grows a channel.", icon: BookOpen },
  { href: "mailto:Landon@LevlCast.com", title: "Talk to Landon", blurb: "Questions, bugs or ideas.", icon: Mail, external: true },
];

function MenuItem({ item, onPick }: { item: Item; onPick: () => void }) {
  const Icon = item.icon;
  const body = (
    <>
      <span className="nv-ico" aria-hidden="true">
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <span>
        <span className="nv-t">
          {item.title}
          {item.tag && <span className="nv-tag">{item.tag}</span>}
        </span>
        <span className="nv-b">{item.blurb}</span>
      </span>
    </>
  );
  if (item.external) {
    const newTab = item.href.startsWith("http");
    return (
      <a
        className="nv-item"
        href={item.href}
        onClick={onPick}
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {body}
      </a>
    );
  }
  return (
    <Link className="nv-item" href={item.href} onClick={onPick}>
      {body}
    </Link>
  );
}

export default function SiteNav() {
  const [open, setOpen] = useState<"product" | "sheet" | null>(null);
  const pathname = usePathname();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const panelId = useId();
  const close = () => setOpen(null);

  // A new page closes whatever was open.
  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(null);
      triggerRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (open === "product" && !wrapRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // The sheet covers the page, so the page underneath shouldn't scroll.
  useEffect(() => {
    if (open !== "sheet") return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [open]);

  // Hover only where there is a real hover; on touch the tap does it.
  const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
  const hoverIn = () => {
    window.clearTimeout(closeTimer.current);
    if (canHover()) setOpen("product");
  };
  const hoverOut = () => {
    if (!canHover()) return;
    closeTimer.current = window.setTimeout(() => setOpen((o) => (o === "product" ? null : o)), 180);
  };

  return (
    <nav className="v3-nav" aria-label="Main">
      <div
        className="nv-wrap"
        ref={wrapRef}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        onBlur={(e) => {
          // Tabbing past the last item closes the panel.
          if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen((o) => (o === "product" ? null : o));
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          className="nv-trigger"
          aria-expanded={open === "product"}
          aria-controls={panelId}
          onClick={() => setOpen((o) => (o === "product" ? null : "product"))}
        >
          Product
          <ChevronDown size={13} strokeWidth={2.2} aria-hidden="true" />
        </button>
        {open === "product" && (
          <div className="nv-drop" id={panelId}>
            <div className="nv-panel">
              <div>
                <p className="nv-h">What it does</p>
                <div className="nv-grid">
                  {FEATURES.map((item) => (
                    <MenuItem key={item.title} item={item} onPick={close} />
                  ))}
                </div>
              </div>
              <div className="nv-side">
                <p className="nv-h">More</p>
                <div className="nv-list">
                  {MORE.map((item) => (
                    <MenuItem key={item.title} item={item} onPick={close} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <Link href="/#pricing" className="v3-nav-extra">Pricing</Link>
      <Link href="/leaderboard" className="nv-desk">Leaderboard</Link>
      <a className="v3-ios" href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
        <AppleIcon />
        iOS
      </a>
      <Link href="/auth/login" className="v3-signin">Sign in</Link>
      <button type="button" className="nv-burger" aria-label="Open menu" onClick={() => setOpen("sheet")}>
        <Menu size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      {open === "sheet" && (
        <div className="nv-sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="nv-sheet-top">
            <Link href="/" className="v3-mark" onClick={close}>LevlCast</Link>
            <button type="button" className="nv-burger nv-close" aria-label="Close menu" onClick={close} autoFocus>
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <p className="nv-h">What it does</p>
          <div className="nv-grid">
            {FEATURES.map((item) => (
              <MenuItem key={item.title} item={item} onPick={close} />
            ))}
          </div>
          <p className="nv-h nv-h-gap">More</p>
          <div className="nv-list">
            <MenuItem item={PRICING} onPick={close} />
            {MORE.map((item) => (
              <MenuItem key={item.title} item={item} onPick={close} />
            ))}
          </div>
          <Link href="/auth/login" className="v3-btn nv-sheet-cta" onClick={close}>
            Sign in with Twitch
          </Link>
        </div>
      )}
    </nav>
  );
}
