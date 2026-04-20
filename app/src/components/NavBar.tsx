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

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
      <div className="max-w-[1080px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <img src="/logo-icon.png" alt="" className="h-9 w-auto" style={{ maxWidth: "36px", objectFit: "cover", objectPosition: "left center" }} />
          <span className="text-xl font-extrabold tracking-tight text-gradient">LevlCast</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth/login"
            className="btn-accent text-sm px-5 py-2.5"
          >
            Get Started Free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-muted hover:text-white transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden glass border-t border-border px-6 py-5 flex flex-col gap-4">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-muted hover:text-white transition-colors py-1"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="border-t border-border pt-4">
            <Link
              href="/auth/login"
              className="btn-accent text-sm text-center py-3 block"
              onClick={() => setOpen(false)}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
