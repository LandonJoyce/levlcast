"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default function NavBarLanding() {
  const [open, setOpen] = useState(false);

  return (
    <div className="nav-wrap">
      <div className="container nav">
        <Link href="/" className="logo">
          <span>LevlCast</span>
        </Link>

        <nav className="nav-links nav-desktop">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/auth/login" className="nav-cta nav-desktop">
            Get Started Free
          </Link>

          <button
            className="nav-mobile-toggle"
            style={{ background: "transparent", border: 0, padding: 8, color: "var(--ink-2)", cursor: "pointer" }}
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="nav-mobile-menu" style={{ borderTop: "1px solid var(--line)", padding: "16px 32px", flexDirection: "column", gap: 14, background: "color-mix(in oklab, var(--bg) 95%, transparent)", display: "flex" }}>
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              style={{ fontSize: 14, color: "var(--ink-2)", padding: "4px 0" }}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/auth/login"
            className="nav-cta"
            style={{ marginTop: 8, justifyContent: "center" }}
            onClick={() => setOpen(false)}
          >
            Get Started Free
          </Link>
        </div>
      )}

      <style>{`
        .landing-v2 .nav-desktop { display: none; }
        .landing-v2 .nav-mobile-toggle { display: inline-flex; align-items: center; }
        @media (min-width: 768px) {
          .landing-v2 .nav-desktop { display: inline-flex; align-items: center; }
          .landing-v2 .nav-links.nav-desktop { display: flex; }
          .landing-v2 .nav-mobile-toggle { display: none; }
          .landing-v2 .nav-mobile-menu { display: none !important; }
        }
      `}</style>
    </div>
  );
}
