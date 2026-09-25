"use client";

import { useId, useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number>(0);
  // Ties each question to its answer, so a screen reader announces whether
  // the question is open and which region it controls.
  const baseId = useId();

  return (
    <div className="faq-grid">
      {items.map((f, i) => {
        const isOpen = open === i;
        const answerId = `${baseId}-a${i}`;
        return (
          <div className={`faq-item${isOpen ? " open" : ""}`} key={i}>
            <button
              type="button"
              className="faq-q"
              aria-expanded={isOpen}
              aria-controls={answerId}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span>{f.q}</span>
              <span className="chev" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </button>
            {isOpen && <div className="faq-a" id={answerId}>{f.a}</div>}
          </div>
        );
      })}
    </div>
  );
}
