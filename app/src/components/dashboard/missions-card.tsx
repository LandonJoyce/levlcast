"use client";

import { useState } from "react";
import Link from "next/link";

const ROMAN = ["i.", "ii.", "iii.", "iv.", "v."];

export function MissionsCard({
  missions,
  vodId,
  vodTitle,
  initialChecked,
}: {
  missions: string[];
  vodId: string;
  vodTitle: string;
  initialChecked: number[];
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set(initialChecked));

  async function toggle(i: number) {
    const next = new Set(checked);
    next.has(i) ? next.delete(i) : next.add(i);
    setChecked(next);
    fetch("/api/dashboard/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vod_id: vodId, checked: Array.from(next) }),
    });
  }

  const allDone = missions.length > 0 && checked.size === missions.length;
  const doneCount = checked.size;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-head">
        <div>
          <h3 style={{ margin: 0 }}>Missions</h3>
          <span className="label-mono" style={{ marginTop: 2, display: "block", maxWidth: "36ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            from: {vodTitle}
          </span>
        </div>
        <div className="row gap-sm" style={{ alignItems: "center" }}>
          {allDone ? (
            <span className="chip g">Ready for next stream</span>
          ) : (
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
              {doneCount}/{missions.length} done
            </span>
          )}
          <Link href={`/dashboard/vods/${vodId}`} className="btn-link mono" style={{ fontSize: 11, letterSpacing: ".06em" }}>
            REPORT
          </Link>
        </div>
      </div>

      <div style={{ padding: "4px 0 8px" }}>
        {missions.map((goal, i) => {
          const done = checked.has(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 1fr",
                gap: 12,
                alignItems: "start",
                width: "100%",
                padding: "12px 20px",
                background: "transparent",
                border: "none",
                borderBottom: i < missions.length - 1 ? "1px solid var(--line)" : "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {/* Roman numeral + check state */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                paddingTop: 2,
              }}>
                <span style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: 10,
                  color: done ? "var(--green)" : "var(--ink-3)",
                  letterSpacing: ".04em",
                  transition: "color .15s",
                }}>
                  {ROMAN[i] ?? `${i + 1}.`}
                </span>
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: `1.5px solid ${done ? "var(--green)" : "var(--line)"}`,
                  background: done ? "color-mix(in oklab, var(--green) 15%, transparent)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all .15s",
                }}>
                  {done && (
                    <svg viewBox="0 0 10 8" width="10" height="8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>

              {/* Mission text */}
              <p style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.55,
                color: done ? "var(--ink-3)" : "var(--ink)",
                textDecoration: done ? "line-through" : "none",
                transition: "color .15s",
              }}>
                {goal}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
