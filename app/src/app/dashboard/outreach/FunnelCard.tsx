"use client";

/**
 * Where DMs drop off: each step from a message sent to an account made,
 * with how many people made it and what share of the step before. Below
 * it, the same for everyone who didn't come from a DM, the links people
 * tried that didn't work, and the DM'd people who clicked, so a reply can
 * be answered knowing what they actually did.
 */

import { useCallback, useEffect, useState } from "react";

type Step = "land" | "preview_start" | "preview_ready" | "cta" | "signin_start" | "signup";
type Counts = Record<Step, number>;

interface FunnelData {
  needsMigration?: boolean;
  error?: string | null;
  days: number;
  dmsSince: string;
  dmsSent: number;
  dm: Counts;
  thread?: Counts;
  other: Counts;
  refused: Array<{ reason: string; count: number }>;
  failed: number;
  people: Array<{ username: string | null; code: string; furthest: Step; previews: number; lastSeen: string; sentAt: string | null }>;
  newAccounts: Array<{ login: string | null; name: string | null; at: string; source: "dm" | "thread" | "preview" | "direct" | "untracked" | "unknown"; dmUsername: string | null }>;
  dmKinds?: Array<{ label: string; sent: number; clicked: number; signedUp: number }>;
  afterSignup?: { signedUp: number; report: number; cameBack: number; obsAdded: number; obsStreamed: number; pro: number };
}

/** What new accounts went on to do, each as a share of everyone who signed up. */
function AfterRow({ a }: { a: NonNullable<FunnelData["afterSignup"]> }) {
  const cells = [
    { label: "Signed up", n: a.signedUp },
    { label: "Got a finished report", n: a.report },
    { label: "Came back another day", n: a.cameBack },
    { label: "Added the OBS panel", n: a.obsAdded },
    { label: "Streamed with the panel", n: a.obsStreamed },
    { label: "Went Pro", n: a.pro },
  ];
  return (
    <div className="fn-row">
      {cells.map((c, i) => {
        const pct = i > 0 && a.signedUp ? Math.round((c.n / a.signedUp) * 100) : null;
        return (
          <div key={c.label} className="fn-cell" data-zero={c.n === 0 ? "1" : "0"}>
            <span className="fn-n">{c.n}</span>
            <span className="fn-l">{c.label}</span>
            {pct !== null && <span className="fn-pct" data-low={pct < 40 ? "1" : "0"}>{pct}%</span>}
          </div>
        );
      })}
    </div>
  );
}

const SOURCE: Record<FunnelData["newAccounts"][number]["source"], string> = {
  dm: "from your DM",
  thread: "from your review thread",
  preview: "after a free report",
  direct: "signed in directly",
  untracked: "no website visit recorded (iPhone app or another device)",
  unknown: "before tracking started",
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const LABEL: Record<Step, string> = {
  land: "Clicked the link",
  preview_start: "Started a free report",
  preview_ready: "Saw the report",
  cta: "Pressed Get my full report",
  signin_start: "Pressed Continue with Twitch",
  signup: "Signed up",
};
const ORDER: Step[] = ["land", "preview_start", "preview_ready", "cta", "signin_start", "signup"];

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function Row({
  first,
  firstLabel,
  counts,
  landLabel,
}: {
  first: number | null;
  firstLabel: string | null;
  counts: Counts;
  landLabel?: string;
}) {
  const cells: Array<{ label: string; n: number }> = [];
  if (first !== null && firstLabel) cells.push({ label: firstLabel, n: first });
  for (const s of ORDER) cells.push({ label: s === "land" && landLabel ? landLabel : LABEL[s], n: counts[s] });
  return (
    <div className="fn-row">
      {cells.map((c, i) => {
        const prev = i > 0 ? cells[i - 1].n : null;
        const pct = prev ? Math.round((c.n / prev) * 100) : null;
        return (
          <div key={c.label} className="fn-cell" data-zero={c.n === 0 ? "1" : "0"}>
            <span className="fn-n">{c.n}</span>
            <span className="fn-l">{c.label}</span>
            {pct !== null && <span className="fn-pct" data-low={pct < 40 ? "1" : "0"}>{pct}%</span>}
          </div>
        );
      })}
    </div>
  );
}

export function FunnelCard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<FunnelData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/outreach/funnel?days=${d}`);
      const json = (await res.json()) as FunnelData;
      if (!res.ok) throw new Error(json.error ?? "Couldn't load the funnel.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the funnel.");
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  return (
    <div className="card fn" style={{ marginBottom: 20 }}>
      <div className="card-head">
        <h3>Where DMs drop off</h3>
        <div className="right">
          {[7, 30].map((d) => (
            <button key={d} type="button" className="fn-range" data-on={days === d ? "1" : "0"} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      <div className="fn-body">
        {error ? (
          <p className="fn-note">{error}</p>
        ) : !data ? (
          <p className="fn-note">Loading…</p>
        ) : data.needsMigration ? (
          <p className="fn-note">
            Tracking starts once migration <b>033_funnel_events.sql</b> is run in the Supabase SQL editor.
          </p>
        ) : (
          <>
            <p className="fn-k">From your DMs</p>
            <Row first={data.dmsSent} firstLabel={`DMs sent since ${shortDate(data.dmsSince)}`} counts={data.dm} />
            {data.dmKinds && data.dmKinds.length > 0 && (
              <>
                <p className="fn-k">Which DMs get clicked</p>
                <ul className="fn-list">
                  {data.dmKinds.map((k) => (
                    <li key={k.label}>
                      <span>
                        {k.label} · {k.clicked} of {k.sent} clicked
                        {k.signedUp > 0 ? ` · ${k.signedUp} signed up` : ""}
                      </span>
                      <b>{k.sent ? Math.round((k.clicked / k.sent) * 100) : 0}%</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {data.thread && data.thread.land > 0 && (
              <>
                <p className="fn-k">From your review threads</p>
                <Row first={null} firstLabel={null} counts={data.thread} landLabel="Opened their report" />
              </>
            )}
            <p className="fn-k">Everyone else</p>
            <Row first={null} firstLabel={null} counts={data.other} landLabel="Opened the analyzer" />
            {data.afterSignup && data.afterSignup.signedUp > 0 && (
              <>
                <p className="fn-k">After they sign up</p>
                <AfterRow a={data.afterSignup} />
              </>
            )}

            {(data.refused.length > 0 || data.failed > 0) && (
              <>
                <p className="fn-k">Links that didn&apos;t work</p>
                <ul className="fn-list">
                  {data.refused.map((r) => (
                    <li key={r.reason}>
                      <span>{r.reason}</span>
                      <b>{r.count}</b>
                    </li>
                  ))}
                  {data.failed > 0 && (
                    <li>
                      <span>Started, then failed while reading the stream</span>
                      <b>{data.failed}</b>
                    </li>
                  )}
                </ul>
              </>
            )}

            {data.newAccounts.length > 0 && (
              <>
                <p className="fn-k">New accounts, worth a personal hello</p>
                <ul className="fn-list">
                  {data.newAccounts.map((a, i) => (
                    <li key={`${a.login}-${i}`}>
                      <span>
                        {a.login ? (
                          <a href={`https://www.twitch.tv/${a.login}`} target="_blank" rel="noopener noreferrer">
                            {a.name}
                          </a>
                        ) : (
                          a.name
                        )}{" "}
                        · {SOURCE[a.source]}
                        {a.dmUsername ? ` to u/${a.dmUsername}` : ""}
                      </span>
                      <b>{ago(a.at)}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {data.people.length > 0 && (
              <>
                <p className="fn-k">People you messaged who clicked</p>
                <ul className="fn-list">
                  {data.people.map((p) => (
                    <li key={p.code}>
                      <span>
                        {p.username ? (
                          <a href={`https://www.reddit.com/user/${p.username}`} target="_blank" rel="noopener noreferrer">
                            u/{p.username}
                          </a>
                        ) : (
                          <em>{p.code}</em>
                        )}{" "}
                        · {LABEL[p.furthest].toLowerCase()}
                        {p.previews > 1 ? ` · ${p.previews} previews` : ""}
                      </span>
                      <b>{ago(p.lastSeen)}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="fn-fine">
              Unique visitors in the last {data.days} days. Each step shows the share of the step before it. DMs sent
              before {shortDate(data.dmsSince)} had no tracking code, so clicks from them count under Everyone else, and
              so does a sign-in that Twitch finished in a different browser. After they sign up counts every account
              made in these {data.days} days, wherever it came from, as a share of those signups. Came back another day means
              they opened LevlCast on the website or streamed with the panel on a later day; website visits count from
              Oct 7, and the iPhone app isn&apos;t counted.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
