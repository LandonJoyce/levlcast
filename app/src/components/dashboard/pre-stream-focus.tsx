import type { CoachingArcData } from "@/lib/coaching-arc";

/**
 * Tiny "we noticed" card surfaced at the top of the dashboard when the
 * coaching arc has flagged a recurring pattern. Designed to read as a
 * heads-up note, NOT a mission or checklist — no completion state, no
 * tasks to tick off, single line of advice with one example.
 *
 * The whole point is to give the streamer one specific thing to keep in
 * mind right before they go live, without making them feel assigned
 * homework.
 *
 * Returns null when there's no recurring pattern to surface.
 */
export function PreStreamFocus({ arc }: { arc: CoachingArcData | null }) {
  if (!arc) return null;
  const issue = arc.recurring_improvements[0];
  if (!issue) return null;
  const example = arc.recurring_examples?.[0]?.[0];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 14,
        padding: "14px 18px",
        background: "color-mix(in oklab, var(--blue) 8%, var(--surface))",
        border: "1px solid color-mix(in oklab, var(--blue) 28%, var(--line))",
        borderLeft: "3px solid var(--blue)",
        borderRadius: 10,
        marginBottom: 16,
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 18,
          color: "var(--blue)",
          fontWeight: 700,
          lineHeight: 1,
          marginTop: 2,
        }}
      >
        ◇
      </span>
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--blue)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            margin: "0 0 4px",
          }}
        >
          Heads up before you stream
        </p>
        <p style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.5, margin: 0 }}>
          {issue}
        </p>
        {example && (
          <p
            style={{
              fontSize: 12.5,
              color: "var(--ink-2)",
              lineHeight: 1.5,
              margin: "8px 0 0",
              fontStyle: "italic",
              paddingLeft: 10,
              borderLeft: "2px solid color-mix(in oklab, var(--blue) 40%, var(--line))",
            }}
          >
            Try: &ldquo;{example}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}
