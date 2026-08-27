"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * CollabSetup — full-page opt-in flow shown on /dashboard/collabs when the
 * user hasn't opted in yet. Same component is also used (in compact mode)
 * by opted-in users to update their Discord handle and preferences.
 *
 * GATES (enforced both here for UX and server-side for security):
 *   1. user must have ≥1 ready coach report (passed in as `hasReadyVod`)
 *   2. user must set a Discord handle before they can flip the opt-in toggle
 *
 * The toggle is intentionally NOT a soft control: flipping it triggers a
 * server roundtrip that re-validates the gates. If they're not met, the
 * server rejects and we surface the error inline.
 */

const COLLAB_TYPES = [
  { id: "co_stream", label: "Co-stream", desc: "Stream together at the same time" },
  { id: "variety_swap", label: "Variety swap", desc: "Play each other's games / formats" },
  { id: "podcast", label: "Podcast / convo", desc: "Voice or video chat content" },
] as const;

type CollabType = typeof COLLAB_TYPES[number]["id"];

interface Props {
  initialDiscordHandle: string | null;
  initialOptIn: boolean;
  initialCollabTypes: CollabType[];
  hasReadyVod: boolean;
}

// Discord usernames (post-2023): 2-32 chars, lowercase letters/digits/underscores/dots.
// We accept uppercase from the user and normalize on save. The DB CHECK constraint
// only accepts lowercase so the server normalizes too as defense-in-depth.
const DISCORD_RE = /^[a-zA-Z0-9._]{2,32}$/;

export function CollabSetup({
  initialDiscordHandle,
  initialOptIn,
  initialCollabTypes,
  hasReadyVod,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [discordHandle, setDiscordHandle] = useState(initialDiscordHandle ?? "");
  const [optIn, setOptIn] = useState(initialOptIn);
  const [types, setTypes] = useState<Set<CollabType>>(new Set(initialCollabTypes));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const trimmed = discordHandle.trim();
  const handleValid = trimmed.length === 0 || DISCORD_RE.test(trimmed);
  const canOptIn = hasReadyVod && trimmed.length > 0 && DISCORD_RE.test(trimmed);

  async function save(nextOptIn?: boolean) {
    setError(null);
    const finalOptIn = nextOptIn ?? optIn;
    const payload = {
      discord_handle: trimmed.length > 0 ? trimmed.toLowerCase() : null,
      collab_opt_in: finalOptIn,
      collab_types: Array.from(types),
    };

    if (finalOptIn) {
      if (!hasReadyVod) {
        setError("You need at least one analyzed VOD with a coach report before you can opt in.");
        return;
      }
      if (!payload.discord_handle) {
        setError("Add your Discord handle so accepted collabs can actually reach you.");
        return;
      }
    }

    try {
      const res = await fetch("/api/collab/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || `Could not save (HTTP ${res.status})`);
        return;
      }
      setOptIn(finalOptIn);
      setSavedAt(Date.now());
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  }

  function toggleType(t: CollabType) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div className="col" style={{ gap: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: "var(--ink)" }}>
            Collab Finder
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>
            Get discovered by other streamers on LevlCast. Both sides have to accept before any contact info is shared.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        {/* Discord handle */}
        <div className="col" style={{ gap: 6 }}>
          <label htmlFor="discord-handle" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
            Discord username
          </label>
          <input
            id="discord-handle"
            type="text"
            value={discordHandle}
            onChange={(e) => setDiscordHandle(e.target.value)}
            placeholder="your.handle"
            autoComplete="off"
            spellCheck={false}
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: 14,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${handleValid ? "var(--line)" : "var(--danger)"}`,
              background: "var(--surface-2)",
              color: "var(--ink)",
              outline: "none",
              maxWidth: 320,
            }}
          />
          <span style={{ fontSize: 11.5, color: handleValid ? "var(--ink-3)" : "var(--danger)" }}>
            {!handleValid
              ? "Use 2-32 characters: letters, digits, dots, underscores. No spaces or #1234 suffix."
              : "Stays private. Only shared after both sides accept a collab interest."}
          </span>
        </div>

        {/* Preferences */}
        <div className="col" style={{ gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
            Open to (optional)
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {COLLAB_TYPES.map((t) => {
              const active = types.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleType(t.id)}
                  style={{
                    textAlign: "left",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                    background: active ? "var(--surface-2)" : "transparent",
                    color: "var(--ink)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "border-color .12s ease, background .12s ease",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{t.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Opt-in row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--surface-2)",
          }}
        >
          <div className="col" style={{ gap: 2, maxWidth: 420 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
              Show me in the Collab Finder
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>
              {hasReadyVod
                ? "Other opted-in streamers can find you and send a one-shot interest."
                : "Analyze at least one VOD first. Your card needs a coach score to appear."}
            </span>
          </div>
          <button
            type="button"
            disabled={pending || (!optIn && !canOptIn)}
            onClick={() => save(!optIn)}
            aria-pressed={optIn}
            style={{
              position: "relative",
              width: 46,
              height: 26,
              borderRadius: 999,
              border: 0,
              background: optIn ? "var(--ink)" : "var(--line)",
              cursor: pending || (!optIn && !canOptIn) ? "not-allowed" : "pointer",
              opacity: pending || (!optIn && !canOptIn) ? 0.5 : 1,
              transition: "background .15s ease, opacity .15s ease",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: optIn ? 23 : 3,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "var(--bg)",
                transition: "left .15s ease",
              }}
            />
          </button>
        </div>

        {error && (
          <div style={{ fontSize: 12.5, color: "var(--danger)", padding: "8px 12px", borderRadius: 8, background: "color-mix(in oklab, var(--danger-soft) 30%, transparent)" }}>
            {error}
          </div>
        )}

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
            {savedAt ? "Saved." : ""}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={() => save()}
            style={{ padding: "8px 14px", fontSize: 12.5 }}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
