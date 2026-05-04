"use client";
import { useEffect, useRef } from "react";

export default function HeatmapViz() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const buckets = ["","","","","","","","","","","","","warm","warm","hot","hot","cold","cold","cold","hot","warm","warm","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","",""];
    for (let i = 0; i < 120; i++) {
      const cell = document.createElement("i");
      const b = buckets[Math.floor(i / 2)] ?? "";
      if (b) cell.className = b;
      el.appendChild(cell);
    }
  }, []);

  return <div ref={ref} className="ll-heatmap" />;
}
