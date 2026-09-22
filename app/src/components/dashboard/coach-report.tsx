"use client";

/**
 * The stream report, rebuilt.
 *
 * The previous version had three type families arguing on every screen —
 * an italic serif for headings, uppercase mono for labels, sans for body —
 * across seven accent colours, with every single item wrapped in its own
 * rounded card with a coloured left rail and a gradient glow. When
 * everything is emphasised nothing is, so the page read as noise and the
 * actual content, which is good, was impossible to skim.
 *
 * This is the same information under three rules:
 *
 *  1. ONE VOICE. System sans for anything you read, mono for numbers and
 *     timestamps only. No serif, no italics as decoration.
 *
 *  2. COLOUR MEANS SOMETHING. Green is better, red is worse, orange is a
 *     link to the VOD. Everything else is one of three greys. A colour
 *     that appears because a section needed a colour is removed.
 *
 *  3. NO BOXES. Sections are separated by space and a hairline. Nested
 *     cards were doing the job that whitespace does better, and they were
 *     what made it look like a slide deck.
 *
 * Prose is capped near 70 characters. The old layout ran paragraphs the
 * full width of a desktop monitor, which is the other half of why it felt
 * like homework.
 */

import type { CoachReport } from "@/lib/analyze";

const INK = "#E9EDF3";
const INK_2 = "#97A2B4";
const INK_3 = "#667286";
const LINE = "rgba(255,255,255,0.075)";
const POS = "#86C97A";
const NEG = "#E08078";
const ACCENT = "#FF7A3D";

const PROSE: React.CSSProperties = {
  fontSize: 14.5,
  lineHeight: 1.65,
  color: INK_2,
  margin: 0,
  maxWidth: "68ch",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: INK_3,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ paddingTop: 28, borderTop: `1px solid ${LINE}`, marginTop: 28 }}>
      <Label>{label}</Label>
      {children}
    </section>
  );
}

/** A timestamp that opens the VOD at that moment. The only orange on the page. */
function Stamp({ time, vodId }: { time: string; vodId?: string }) {
  const style: React.CSSProperties = {
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontSize: 12,
    color: ACCENT,
    textDecoration: "none",
    whiteSpace: "nowrap",
  };
  if (!vodId) return <span style={style}>{time}</span>;
  const t = time.replace(/:/g, "").length >= 4 ? time : time;
  const [m, s] = time.split(":");
  const seconds = (parseInt(m || "0", 10) || 0) * 60 + (parseInt(s || "0", 10) || 0);
  return (
    <a
      href={`https://www.twitch.tv/videos/${vodId}?t=${seconds}s`}
      target="_blank"
      rel="noopener noreferrer"
      style={style}
      title={`Open the VOD at ${t}`}
    >
      {time}
    </a>
  );
}

/**
 * Splits "**Label** — body" into its parts. The model writes items in that
 * shape; the old card parsed it into a bold heading inside a bordered box.
 * Here the label is just bold text at the start of the line.
 */
function parseItem(raw: string): { label: string; body: string } {
  // [\s\S] rather than the /s flag: the build targets an ES version that
  // does not support dotAll, and these strings do contain newlines.
  const bold = raw.match(/^\s*\*\*([\s\S]+?)\*\*\s*[—–:-]?\s*([\s\S]*)$/);
  if (bold) return { label: bold[1].trim(), body: bold[2].trim() };
  const dash = raw.match(/^([\s\S]{3,42}?)\s*[—–]\s*([\s\S]+)$/);
  if (dash) return { label: dash[1].trim(), body: dash[2].trim() };
  return { label: "", body: raw.trim() };
}

function clean(s?: string | null): string {
  return (s ?? "").replace(/\*\*/g, "").trim();
}

function Items({
  items,
  tone,
  vodId,
}: {
  items: string[];
  tone: "good" | "fix";
  vodId?: string;
}) {
  const dot = tone === "good" ? POS : "#D9A441";
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 18 }}>
      {items.map((raw, i) => {
        const { label, body } = parseItem(clean(raw));
        return (
          <li key={i} style={{ display: "flex", gap: 12, maxWidth: "70ch" }}>
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: dot,
                marginTop: 8,
                flexShrink: 0,
              }}
            />
            <p style={{ ...PROSE, maxWidth: "none" }}>
              {label && <strong style={{ color: INK, fontWeight: 600 }}>{label}. </strong>}
              <Linkify text={body} vodId={vodId} />
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** Turns bare m:ss timestamps in body text into VOD links. */
function Linkify({ text, vodId }: { text: string; vodId?: string }) {
  const parts = text.split(/(\b\d{1,2}:\d{2}\b)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\d{1,2}:\d{2}$/.test(p) ? <Stamp key={i} time={p} vodId={vodId} /> : <span key={i}>{p}</span>
      )}
    </>
  );
}

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.round(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CoachReport({
  report,
  twitchVodId,
  streamDurationSeconds,
  trajectory,
}: {
  report: CoachReport;
  twitchVodId?: string;
  streamDurationSeconds?: number;
  trajectory?: Array<{ score: number; date: string; current?: boolean }>;
}) {
  const strengths = (report.strengths ?? []).filter(Boolean);
  const improvements = (report.improvements ?? []).filter(Boolean);
  const antiPatterns = report.anti_patterns ?? [];
  const rewatch = report.rewatch_moments ?? [];
  const deadZones = report.dead_zones ?? [];
  const duration = streamDurationSeconds ?? 0;

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      {report.stream_story && (
        <section>
          <Label>What happened</Label>
          <p style={PROSE}>
            <Linkify text={clean(report.stream_story)} vodId={twitchVodId} />
          </p>
        </section>
      )}

      {strengths.length > 0 && (
        <Section label="What worked">
          <Items items={strengths} tone="good" vodId={twitchVodId} />
        </Section>
      )}

      {improvements.length > 0 && (
        <Section label="What to change">
          <Items items={improvements} tone="fix" vodId={twitchVodId} />
        </Section>
      )}

      {(report.cold_open?.note || report.closing?.note) && (
        <Section label="How it started and ended">
          <div style={{ display: "grid", gap: 20 }}>
            {report.cold_open?.note && (
              <div>
                <p style={{ ...PROSE, color: INK, fontSize: 13, marginBottom: 4 }}>Opening</p>
                <p style={PROSE}>
                  <Linkify text={clean(report.cold_open.note)} vodId={twitchVodId} />
                </p>
              </div>
            )}
            {report.closing?.note && (
              <div>
                <p style={{ ...PROSE, color: INK, fontSize: 13, marginBottom: 4 }}>Ending</p>
                <p style={PROSE}>
                  <Linkify text={clean(report.closing.note)} vodId={twitchVodId} />
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      {report.best_moment?.description && (
        <Section label="Your best moment">
          <p style={{ marginBottom: 8 }}>
            <Stamp time={report.best_moment.time} vodId={twitchVodId} />
          </p>
          <p style={PROSE}>
            <Linkify text={clean(report.best_moment.description)} vodId={twitchVodId} />
          </p>
        </Section>
      )}

      {rewatch.length > 0 && (
        <Section label="Worth rewatching">
          <div style={{ display: "grid", gap: 16 }}>
            {rewatch.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 12, maxWidth: "70ch" }}>
                <Stamp time={r.time} vodId={twitchVodId} />
                <p style={{ ...PROSE, maxWidth: "none" }}>{clean(r.note)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {antiPatterns.length > 0 && (
        <Section label="Habits that cost you viewers">
          <div style={{ display: "grid", gap: 20 }}>
            {antiPatterns.map((ap, i) => (
              <div key={i} style={{ maxWidth: "70ch" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 6 }}>
                  <Stamp time={ap.time} vodId={twitchVodId} />
                  <span style={{ fontSize: 13, color: NEG, fontWeight: 600 }}>
                    {ap.type.replace(/_/g, " ")}
                  </span>
                </div>
                <p style={{ ...PROSE, color: INK_3, fontStyle: "italic", marginBottom: 6 }}>
                  &ldquo;{clean(ap.quote)}&rdquo;
                </p>
                <p style={PROSE}>{clean(ap.note)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Silence. A single plain track: where you were quiet, on a line
          representing the stream. The old version drew a filled waveform,
          a hatched overlay, a legend and four colours to say the same
          thing. */}
      {duration > 0 && deadZones.length > 0 && (
        <Section label="Where it went quiet">
          <div style={{ maxWidth: 720 }}>
            <div
              aria-hidden="true"
              style={{
                position: "relative",
                height: 26,
                borderRadius: 4,
                background: "rgba(255,255,255,0.05)",
                overflow: "hidden",
              }}
            >
              {deadZones.map((z, i) => {
                const startSec = typeof z.time === "string"
                  ? (parseInt(z.time.split(":")[0] || "0", 10) * 60 + parseInt(z.time.split(":")[1] || "0", 10))
                  : 0;
                const left = Math.max(0, Math.min(100, (startSec / duration) * 100));
                const width = Math.max(0.6, Math.min(100 - left, ((z.duration ?? 0) / duration) * 100));
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: `${left}%`,
                      width: `${width}%`,
                      top: 0,
                      bottom: 0,
                      background: "rgba(224,128,120,0.5)",
                    }}
                  />
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 11,
                color: INK_3,
              }}
            >
              <span>0:00</span>
              <span>
                {deadZones.length} quiet {deadZones.length === 1 ? "stretch" : "stretches"}
                {typeof report.dead_air_seconds === "number" && `, ${mmss(report.dead_air_seconds)} total`}
              </span>
              <span>{mmss(duration)}</span>
            </div>
          </div>
        </Section>
      )}

      {/* Trend line. Bars, no gradient, no glow, current stream in white. */}
      {trajectory && trajectory.length >= 2 && (
        <Section label="Your last few streams">
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 96 }}>
              {trajectory.map((p, i) => {
                const max = Math.max(...trajectory.map((x) => x.score), 1);
                const h = Math.max(4, (p.score / max) * 100);
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                        fontSize: 11,
                        color: p.current ? INK : INK_3,
                        fontWeight: p.current ? 700 : 400,
                      }}
                    >
                      {p.score}
                    </span>
                    <div
                      style={{
                        width: "100%",
                        height: `${h}%`,
                        background: p.current ? INK : "rgba(255,255,255,0.14)",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <p style={{ ...PROSE, fontSize: 12, color: INK_3, marginTop: 10 }}>
              Oldest on the left. This stream is the light bar.
            </p>
          </div>
        </Section>
      )}

      {report.trend_vs_history?.note && report.trend_vs_history.direction !== "first_stream" && (
        <Section label="Across your streams">
          <p style={PROSE}>{clean(report.trend_vs_history.note)}</p>
        </Section>
      )}

      {report.community_note && (
        <Section label="Who this stream is for">
          <p style={PROSE}>{clean(report.community_note)}</p>
        </Section>
      )}
    </div>
  );
}
