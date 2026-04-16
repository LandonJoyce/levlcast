"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function PanelLinkCopy({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail in older browsers / insecure contexts;
      // fall back silently — user can still select and copy manually.
    }
  }

  return (
    <div className="flex items-center gap-2 bg-[#0a0d14] border border-white/[0.08] rounded-xl px-4 py-3">
      <code className="flex-1 text-sm text-white/85 font-mono truncate">
        {link}
      </code>
      <button
        onClick={copyLink}
        className="flex-shrink-0 inline-flex items-center gap-1.5 bg-white/[0.06] hover:bg-accent/20 border border-white/[0.08] hover:border-accent/40 text-white/80 hover:text-accent-light text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
      >
        {copied ? (
          <>
            <Check size={13} /> Copied
          </>
        ) : (
          <>
            <Copy size={13} /> Copy
          </>
        )}
      </button>
    </div>
  );
}
