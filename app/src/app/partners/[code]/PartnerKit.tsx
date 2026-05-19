"use client";

import { useState } from "react";

interface PartnerKitProps {
  data: {
    code: string;
    couponName: string | null;
    percentOff: number | null;
    duration: string | null;
  };
}

const REV_SHARE_PCT = 30;
const HELV = '"Helvetica Neue", "Helvetica", "Arial", system-ui, sans-serif';
const SERIF = '"Instrument Serif", Georgia, serif';
const GRAD = "linear-gradient(135deg, rgb(255,88,0) 0%, rgb(242,97,121) 100%)";

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      style={{
        fontFamily: HELV,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "7px 12px",
        borderRadius: 7,
        border: copied
          ? "1px solid rgba(163,230,53,0.5)"
          : "1px solid rgba(255,255,255,0.18)",
        background: copied ? "rgba(163,230,53,0.12)" : "rgba(255,255,255,0.04)",
        color: copied ? "#A3E635" : "rgba(255,255,255,0.85)",
        cursor: "pointer",
        transition: "all 150ms ease",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function SectionLabel({ children, accent = "#FF5800" }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        fontFamily: HELV,
        fontSize: 10, fontWeight: 700,
        letterSpacing: "0.28em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.5)",
        marginBottom: 16,
      }}
    >
      <span style={{ width: 22, height: 1, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      {children}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <p
        style={{
          fontFamily: HELV, fontSize: 10, fontWeight: 700,
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)", margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: SERIF, fontSize: 28, lineHeight: 1.1, fontWeight: 400,
          margin: "8px 0 0", letterSpacing: "-0.01em",
          color: accent ?? "#ECF1FA",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function ChatLine({ text }: { text: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex", alignItems: "flex-start", gap: 14,
      }}
    >
      <p
        style={{
          flex: 1, margin: 0,
          fontFamily: HELV, fontSize: 13.5, lineHeight: 1.55,
          color: "rgba(255,255,255,0.85)",
        }}
      >
        {text}
      </p>
      <CopyButton value={text} />
    </div>
  );
}

export function PartnerKit({ data }: PartnerKitProps) {
  const { code } = data;
  // Resolve display percent from Stripe coupon, fall back to inferred suffix
  // (CHRYSTA20 → 20%) so the page never shows a missing-data feel.
  const numericSuffix = code.match(/(\d{1,2})$/);
  const discountPct = data.percentOff ?? (numericSuffix ? parseInt(numericSuffix[1], 10) : 20);
  const referralUrl = `https://www.levlcast.com/r/${code}`;
  const bioCopy = `LevlCast | ${code} for ${discountPct}% off → levlcast.com/r/${code}`;

  const chatLines = [
    `AI coach report on your VOD. ${discountPct}% off forever with my code → levlcast.com/r/${code}`,
    `If you stream and want an actual coach report on your last VOD, levlcast.com/r/${code} gets you ${discountPct}% off forever. Score, dead spots, hype moments, clips it found from the best parts.`,
    `levlcast.com/r/${code} — AI coach report for streamers, ${discountPct}% off forever with my code`,
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08080d",
        color: "#ECF1FA",
        fontFamily: HELV,
        paddingBottom: 80,
      }}
    >
      {/* Brand glow header */}
      <div
        style={{
          position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)",
          width: 800, height: 480, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(255,88,0,0.18) 0%, rgba(242,97,121,0.08) 40%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", maxWidth: 720, margin: "0 auto", padding: "48px 24px 0" }}>

        {/* Nav row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 56 }}>
          <a
            href="/"
            style={{
              fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", textDecoration: "none",
              background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            LevlCast
          </a>
          <span
            style={{
              fontFamily: HELV, fontSize: 10, fontWeight: 700,
              letterSpacing: "0.24em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Partner Kit
          </span>
        </div>

        {/* Hero */}
        <header className="pk-hero" style={{ marginBottom: 56 }}>
          <p
            style={{
              fontFamily: HELV, fontSize: 11, fontWeight: 700,
              letterSpacing: "0.28em", textTransform: "uppercase",
              color: "#FF5800", margin: "0 0 14px",
            }}
          >
            Welcome aboard
          </p>
          <h1
            className="pk-hero-h1"
            style={{
              fontFamily: SERIF, fontSize: 52, lineHeight: 1.05, fontWeight: 400,
              letterSpacing: "-0.02em", margin: "0 0 18px",
              wordBreak: "break-word",
            }}
          >
            Your <em style={{ ...{ background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" } }}>{code}</em> kit.
          </h1>
          <p
            style={{
              fontFamily: HELV, fontSize: 16, lineHeight: 1.6, fontWeight: 400,
              color: "rgba(255,255,255,0.7)", margin: 0, maxWidth: 540,
            }}
          >
            Everything you need to push LevlCast to your community is on this page. Your link auto-applies the discount at checkout, so viewers don&apos;t have to type anything.
          </p>
        </header>

        {/* Mobile responsive overrides for the kit. Inline styles + media
            queries don't mix, so a tiny scoped style block handles the
            mobile-only adjustments instead of dragging in a CSS module. */}
        <style>{`
          @media (max-width: 600px) {
            .pk-hero-h1 { font-size: 36px !important; }
            .pk-deal-grid { grid-template-columns: 1fr !important; }
            .pk-banner-grid { grid-template-columns: 1fr 1fr !important; }
            .pk-link-row { flex-direction: column !important; align-items: stretch !important; }
            .pk-link-row > button { width: 100% !important; }
          }
        `}</style>

        {/* Deal numbers */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>The deal</SectionLabel>
          <div className="pk-deal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <StatTile label="Viewer discount" value={`${discountPct}% off`} accent="#A3E635" />
            <StatTile label="Your cut" value={`${REV_SHARE_PCT}%`} accent="#FFB08C" />
          </div>
          <p
            style={{
              fontFamily: HELV, fontSize: 13, lineHeight: 1.6,
              color: "rgba(255,255,255,0.55)", margin: "16px 0 0",
            }}
          >
            Your viewers lock in {discountPct}% off Pro forever as long as they stay subscribed. You take {REV_SHARE_PCT}% of every Pro signup that comes through your code, every month they keep paying. Cancellations stop the payout. Renewals keep it going.
          </p>
        </section>

        {/* Link + code box */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>Your link</SectionLabel>
          <div
            className="pk-link-row"
            style={{
              background: "linear-gradient(180deg, rgba(255,88,0,0.08) 0%, rgba(255,255,255,0.025) 100%)",
              border: "1px solid rgba(255,88,0,0.35)",
              borderRadius: 14,
              padding: 20,
              display: "flex", alignItems: "center", gap: 14,
            }}
          >
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 17, fontWeight: 600,
                letterSpacing: "-0.005em", flex: 1, wordBreak: "break-all",
                color: "#ECF1FA",
              }}
            >
              levlcast.com/r/{code}
            </span>
            <CopyButton value={referralUrl} label="Copy link" />
          </div>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 14,
              marginTop: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "14px 18px",
            }}
          >
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontFamily: HELV, fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.45)", margin: 0,
                }}
              >
                Code (if anyone prefers typing)
              </p>
              <p
                style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 18, fontWeight: 700,
                  margin: "4px 0 0", color: "#ECF1FA",
                }}
              >
                {code}
              </p>
            </div>
            <CopyButton value={code} label="Copy code" />
          </div>
        </section>

        {/* Bio template */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>Drop this in your bio / Linktree</SectionLabel>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "16px 18px",
              display: "flex", alignItems: "center", gap: 14,
            }}
          >
            <code
              style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 13.5, lineHeight: 1.5,
                color: "rgba(255,255,255,0.85)", flex: 1, wordBreak: "break-all",
              }}
            >
              {bioCopy}
            </code>
            <CopyButton value={bioCopy} />
          </div>
        </section>

        {/* Chat one-liners */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>Pick one for your chat / pinned message</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {chatLines.map((line, i) => (
              <ChatLine key={i} text={line} />
            ))}
          </div>
        </section>

        {/* Pricing urgency */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel accent="#FFB08C">Heads up for your community</SectionLabel>
          <div
            style={{
              background: "linear-gradient(180deg, rgba(255,176,140,0.08) 0%, rgba(255,255,255,0.02) 100%)",
              border: "1px solid rgba(255,176,140,0.25)",
              borderRadius: 12,
              padding: "18px 20px",
            }}
          >
            <p
              style={{
                fontFamily: HELV, fontSize: 14, lineHeight: 1.6,
                color: "rgba(255,255,255,0.85)", margin: 0,
              }}
            >
              The founding $9.99/mo price ends <strong style={{ color: "#FFB08C" }}>May 31</strong>. After that, new subs pay $14.99/mo. Anyone using your code before then keeps the $9.99 rate forever. Real urgency for your community.
            </p>
          </div>
        </section>

        {/* Banner assets */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>Banner overlays</SectionLabel>
          <p
            style={{
              fontFamily: HELV, fontSize: 14, lineHeight: 1.6,
              color: "rgba(255,255,255,0.65)", margin: "0 0 18px",
            }}
          >
            Drop into OBS as an image source, or use as a pinned chat image. If you need a different format (Twitch panel, story-sized, etc.) just ask.
          </p>
          <div className="pk-banner-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { size: "320 × 209", path: `/partners/${code.toLowerCase()}/overlay-320.png` },
              { size: "400 × 262", path: `/partners/${code.toLowerCase()}/overlay-400.png` },
              { size: "480 × 314", path: `/partners/${code.toLowerCase()}/overlay-480.png` },
            ].map(({ size, path }) => (
              <a
                key={size}
                href={path}
                download
                style={{
                  display: "block",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10,
                  padding: "16px 14px",
                  textAlign: "center",
                  textDecoration: "none",
                  transition: "all 150ms ease",
                }}
              >
                <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: "#ECF1FA", margin: "0 0 8px", fontWeight: 600 }}>
                  {size}
                </p>
                <p style={{ fontFamily: HELV, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FF5800", margin: 0 }}>
                  Download ↓
                </p>
              </a>
            ))}
          </div>
          <p
            style={{
              fontFamily: HELV, fontSize: 11.5, lineHeight: 1.55,
              color: "rgba(255,255,255,0.35)", margin: "12px 0 0",
            }}
          >
            Banners are generated per partner. If yours aren&apos;t uploaded yet, reply to the email this kit came from and Landon will send them within the day.
          </p>
        </section>

        {/* Attribution explainer */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>How attribution works</SectionLabel>
          <ol
            style={{
              listStyle: "decimal",
              paddingLeft: 22,
              margin: 0,
              display: "flex", flexDirection: "column", gap: 10,
              fontFamily: HELV, fontSize: 14, lineHeight: 1.65,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <li>Viewer clicks your link. The {discountPct}% off applies automatically at Stripe checkout.</li>
            <li>Their subscription gets tagged with <code style={{ fontFamily: '"JetBrains Mono", monospace', background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4, fontSize: 13 }}>referral_code: {code}</code> in metadata.</li>
            <li>Each month, Landon pulls active subscribers tagged with your code and pays you {REV_SHARE_PCT}% of net revenue.</li>
            <li>Cancellations stop your payouts. Renewals keep them going.</li>
            <li>First payout clears after Stripe&apos;s 7-day chargeback window on the initial subscription.</li>
          </ol>
        </section>

        {/* Contact */}
        <section
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "22px 24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: HELV, fontSize: 11, fontWeight: 700,
              letterSpacing: "0.24em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)", margin: "0 0 10px",
            }}
          >
            Questions / format requests
          </p>
          <p
            style={{
              fontFamily: HELV, fontSize: 15, lineHeight: 1.55,
              color: "rgba(255,255,255,0.85)", margin: 0,
            }}
          >
            Reply to the email this came on, or write to{" "}
            <a
              href="mailto:Landon@LevlCast.com"
              style={{ color: "#FFB08C", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Landon@LevlCast.com
            </a>
            .
          </p>
        </section>

      </div>
    </div>
  );
}
