"use client";
import { useEffect, useRef } from "react";

const DATA = [18,22,30,44,50,38,24,20,18,50,62,55,42,34,24,16,12,18,28,40,96,90,74,56,40,28,8,6,14,22,32,46,54,64,74,80,86,90,76,62];

export default function ChatBarsViz() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const peak = Math.max(...DATA);
    DATA.forEach((v, i) => {
      const bar = document.createElement("i");
      bar.style.height = `${(v / peak) * 100}%`;
      if (v === peak) bar.className = "peak";
      else if (v < 20) bar.className = "dim";
      el.appendChild(bar);
    });
  }, []);

  return <div ref={ref} className="ll-bars" />;
}
