"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";

const navLinks = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-border-soft"
      style={{ background: "rgba(6, 8, 15, 0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
    >
      <div className="max-w-[1180px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-ink-cyan/10 border border-border-cyan flex items-center justify-center">
            <span className="font-mono font-bold text-ink-cyan text-sm">L</span>
          </div>
          <span className="text-lg font-extrabold tracking-tight">LevlCast</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/55">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/auth/login" className="text-sm font-medium text-white/55 hover:text-white transition-colors px-3">
            Sign in
          </Link>
          <Link
            href="/auth/login"
            className="btn-cyan inline-flex items-center gap-2 text-sm py-2.5 px-5 group"
          >
            Start free
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-border-soft px-6 py-5 flex flex-col gap-4" style={{ background: "rgba(6, 8, 15, 0.95)" }}>
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-white/60 hover:text-white transition-colors py-1"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="border-t border-border-soft pt-4 flex flex-col gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors py-1"
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
            <Link
              href="/auth/login"
              className="btn-cyan text-sm text-center py-3 block"
              onClick={() => setOpen(false)}
            >
              Start free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
