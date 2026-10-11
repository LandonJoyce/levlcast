"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The public pages' top bar. It sits flat over the page at the top, and
 * once you scroll it sticks as a floating frosted bar (home-ranked.css,
 * `.v3-bar[data-float]`), the way Adobe's does.
 */
export default function FloatBar({ children }: { children: ReactNode }) {
  const [float, setFloat] = useState(false);
  useEffect(() => {
    const check = () => setFloat(window.scrollY > 24);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
  return (
    <header className="v3-bar" data-float={float ? "1" : undefined}>
      {children}
    </header>
  );
}
