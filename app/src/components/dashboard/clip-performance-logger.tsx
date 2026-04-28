"use client";

import { useState } from "react";

interface Props {
  clipId: string;
  initialViews?: number | null;
  initialFollows?: number | null;
}

export function ClipPerformanceLogger({ clipId, initialViews, initialFollows }: Props) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState(initialViews?.toString() ?? "");
  const [follows, setFollows] = useState(initialFollows?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasData = initialViews !== null && initialViews !== undefined;

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/clips/${clipId}/performance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          views_count: views !== "" ? parseInt(views, 10) : undefined,
          follows_gained: follows !== "" ? parseInt(follows, 10) : undefined,
        }),
      });
      setSaved(true);
      setOpen(false);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          background: "none",
          border: "1px solid var(--line)",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 11,
          fontFamily: "var(--font-geist-mono), monospace",
          letterSpacing: ".05em",
          color: saved ? "var(--green)" : hasData ? "var(--ink-2)" : "var(--ink-3)",
          cursor: "pointer",
          textAlign: "center",
        }}
      >
        {saved ? "✓ saved" : hasData ? `${initialViews?.toLocaleString()} views${initialFollows ? ` · +${initialFollows} follows` : ""}` : "Log performance"}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <input
        type="number"
        min="0"
        placeholder="Views"
        value={views}
        onChange={(e) => setViews(e.target.value)}
        style={{
          width: "100%",
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          borderRadius: 5,
          padding: "5px 8px",
          fontSize: 12,
          color: "var(--ink)",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      <input
        type="number"
        min="0"
        placeholder="Follows gained"
        value={follows}
        onChange={(e) => setFollows(e.target.value)}
        style={{
          width: "100%",
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          borderRadius: 5,
          padding: "5px 8px",
          fontSize: 12,
          color: "var(--ink)",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            flex: 1,
            background: "var(--blue)",
            border: "none",
            borderRadius: 5,
            padding: "5px 0",
            fontSize: 11,
            fontFamily: "var(--font-geist-mono), monospace",
            color: "#fff",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "…" : "Save"}
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: "none",
            border: "1px solid var(--line)",
            borderRadius: 5,
            padding: "5px 10px",
            fontSize: 11,
            color: "var(--ink-3)",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
