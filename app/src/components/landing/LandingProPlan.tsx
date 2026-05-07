"use client";

import { useState } from "react";
import Link from "next/link";

const FEATURES = [
  "15 VOD analyses / month",
  "Streams up to 10 hours",
  "20 clips per month",
  "Post to YouTube Shorts",
  "Priority processing",
  "Everything in Free",
];

const CheckIcon = () => (
  <svg className="ll-plan-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ll-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
  </svg>
);

const ArrowIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

export default function LandingProPlan() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="ll-plan-pro-outer">
      <article className="ll-plan ll-plan-pro">
        {/* Toggle */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          gap: 0, padding: "4px",
          background: "rgba(255,255,255,0.06)",
          borderRadius: 10,
          marginBottom: 16,
          alignSelf: "flex-start",
        }}>
          <button
            onClick={() => setAnnual(false)}
            style={{
              padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
              background: !annual ? "rgba(255,255,255,0.12)" : "transparent",
              color: !annual ? "#fff" : "rgba(255,255,255,0.45)",
              transition: "all 150ms",
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            style={{
              position: "relative",
              padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
              background: annual ? "rgba(255,255,255,0.12)" : "transparent",
              color: annual ? "#fff" : "rgba(255,255,255,0.45)",
              transition: "all 150ms",
            }}
          >
            Annual
            <span style={{
              position: "absolute", top: -8, right: -4,
              fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
              padding: "2px 6px", borderRadius: 4,
              background: "#A3E635", color: "#0b1c10",
            }}>SAVE 17%</span>
          </button>
        </div>
        <div>
          <div className="ll-plan-name">Pro</div>
          <div className="ll-plan-cycle">{annual ? "billed yearly" : "billed monthly"}</div>
        </div>

        <div className="ll-plan-price" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          {annual ? (
            <>
              <span>$99 <small>/ year</small></span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "line-through", fontWeight: 400 }}>$119.88</span>
            </>
          ) : (
            <span>$9.99 <small>/ month</small></span>
          )}
        </div>

        {annual && (
          <div style={{
            fontSize: 12, color: "#A3E635", fontWeight: 600,
            marginTop: -8, marginBottom: 4, letterSpacing: "0.02em",
          }}>
            Equivalent to $8.25/mo
          </div>
        )}

        <hr className="ll-plan-sep" />

        <ul className="ll-plan-feats">
          {FEATURES.map((f) => (
            <li key={f}>
              <CheckIcon />
              {f}
            </li>
          ))}
        </ul>

        <Link href="/auth/login" className="ll-btn ll-btn-grad ll-btn-arrow">
          {annual ? "Get Pro — $99/year" : "Get Pro"}
          <span className="ll-btn-arrow-circle"><ArrowIcon /></span>
        </Link>

        {!annual && (
          <button
            onClick={() => setAnnual(true)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 11, color: "#A3E635", letterSpacing: "0.04em",
              marginTop: 10, textAlign: "center", width: "100%",
              textDecoration: "underline", textUnderlineOffset: 3,
            }}
          >
            Switch to annual and save $20.88
          </button>
        )}
      </article>
    </div>

  );
}
