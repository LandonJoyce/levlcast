"use client";

import { useEffect, useRef, useState } from "react";

/** One-click copy. The label flips to "Copied" for a moment so the click is visibly done. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="pk-copy"
      data-copied={copied ? "yes" : undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked (old browser, insecure context). The text is
          // on screen and selectable, so there is nothing to recover.
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

/**
 * The partner's overlay, shown as itself with a download button.
 *
 * The old kit linked a "Download" box without ever showing the image, so
 * a partner had to download it to find out what it was. If the file isn't
 * uploaded yet the image fails to load and the note takes its place.
 */
export function OverlayPreview({ src, code }: { src: string; code: string }) {
  const [missing, setMissing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // A 404 that lands before hydration never reaches onError, so check once
  // on mount whether the image already finished loading as nothing.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setMissing(true);
  }, []);

  if (missing) {
    return (
      <p className="pk-note">
        Your overlay isn&apos;t uploaded yet. Email Landon and it&apos;ll be with you within the day.
      </p>
    );
  }

  return (
    <div className="pk-overlay">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt={`LevlCast overlay with the code ${code}`} onError={() => setMissing(true)} />
      <a className="lv2-cta lv2-cta-ghost" href={src} download={`levlcast-${code.toLowerCase()}.png`}>
        Download PNG
      </a>
    </div>
  );
}
