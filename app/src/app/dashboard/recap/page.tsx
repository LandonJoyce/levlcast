import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, Download } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { TIER_HEX } from "@/lib/rank";
import { buildRecap, defaultRecapMonth, monthBounds, MONTH_PATTERN, recapMonths } from "@/lib/recap";

export const metadata: Metadata = { title: "Your month" };

/**
 * "Your October": a streamer's month on LevlCast. It shows off the history
 * a copycat can't have (the climb, the fixes they actually did, their best
 * stream) and ends on a card they can post. Opened from the home page in
 * the first week of a month, and from Matches.
 */
export default async function RecapPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { month: asked } = await searchParams;
  const months = await recapMonths(supabase, user.id);
  const wanted = typeof asked === "string" && MONTH_PATTERN.test(asked) ? asked : defaultRecapMonth();
  // An empty month falls back to the newest one with streams in it.
  const month = months.includes(wanted) || !months.length ? wanted : months[0];

  const [r, { data: profile }] = await Promise.all([
    buildRecap(supabase, createAdminClient(), user.id, month),
    supabase.from("profiles").select("twitch_display_name").eq("id", user.id).single(),
  ]);
  const name = (profile?.twitch_display_name as string | null) || "Streamer";
  const next = monthBounds(nextMonth(month)).name;

  return (
    <div className="rc">
      <header className="rc-head">
        <div>
          <p className="rc-who">{name}&apos;s month on LevlCast</p>
          <h1 className="page-title rc-title">
            {r.name}
            {r.current ? <span> so far</span> : null}
          </h1>
        </div>
        {months.length > 1 && (
          <nav className="rc-months" aria-label="Pick a month">
            {months.slice(0, 6).map((m) => (
              <Link key={m} href={`/dashboard/recap?month=${m}`} aria-current={m === month ? "page" : undefined}>
                {monthBounds(m).name.slice(0, 3)}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {r.streams === 0 ? (
        <section className="rc-empty">
          <p>No streams analyzed in {r.name} yet.</p>
          <Link href="/dashboard/vods" className="btn btn-primary rc-go">
            Analyze a stream <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <>
          <dl className="rc-stats">
            <div>
              <dd>{r.streams}</dd>
              <dt>{r.streams === 1 ? "Stream" : "Streams"}</dt>
            </div>
            <div>
              <dd>{r.hours}</dd>
              <dt>Hours</dt>
            </div>
            <div>
              <dd>
                {r.wins}
                <span>W</span> {r.losses}
                <span>L</span>
              </dd>
              <dt>Record</dt>
            </div>
            {r.points !== null && (
              <div>
                <dd data-tone={r.points > 0 ? "up" : r.points < 0 ? "down" : undefined}>
                  {r.points > 0 ? "+" : ""}
                  {r.points}
                </dd>
                <dt>Rank points</dt>
              </div>
            )}
          </dl>

          {r.rankEnd && (
            <section className="rc-climb" aria-label="Your rank this month">
              {r.rankStart && r.rankStart.label !== r.rankEnd.label ? (
                <>
                  <Tier rank={r.rankStart} note={`Start of ${r.name}`} />
                  <ArrowRight className="rc-arrow" size={28} strokeWidth={1.8} aria-hidden="true" />
                  <Tier rank={r.rankEnd} note={r.current ? "Now" : `End of ${r.name}`} />
                </>
              ) : (
                <Tier rank={r.rankEnd} note={r.rankStart ? `Held all ${r.name}` : `Placed in ${r.name}`} />
              )}
            </section>
          )}
          {r.sealed > 0 && (
            <p className="rc-sealed">
              {r.sealed === 1 ? "1 result is" : `${r.sealed} results are`} still sealed. Open {r.sealed === 1 ? "it" : "them"} on{" "}
              <Link href="/dashboard/history">Matches</Link> and {r.sealed === 1 ? "it counts" : "they count"} here.
            </p>
          )}

          <div className="rc-grid">
            <section className="rc-card">
              <p className="rc-k">Did your fix</p>
              {r.fixes.checked === 0 ? (
                <p className="rc-big-t">Your next report checks your fix.</p>
              ) : (
                <>
                  <p className="rc-big">
                    {r.fixes.done}
                    <span> of {r.fixes.checked} {r.fixes.checked === 1 ? "stream" : "streams"}</span>
                  </p>
                  {r.fixes.partly > 0 && <p className="rc-note">Partly on {r.fixes.partly} more.</p>}
                  {r.fixes.lines.length > 0 && (
                    <ul className="rc-lines">
                      {r.fixes.lines.map((f) => (
                        <li key={f.line} data-status={f.status}>
                          <span>{f.status === "fixed" ? "Did it" : "Partly"}</span> {f.line}
                          {f.times > 1 ? <em> · {f.times} streams</em> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>

            {r.best && (
              <section className="rc-card">
                <p className="rc-k">Best stream</p>
                <p className="rc-big" data-tone="up">+{r.best.delta}</p>
                <Link href={`/dashboard/vods/${r.best.id}`} className="rc-link">
                  {r.best.title}
                </Link>
              </section>
            )}

            {r.improved && (
              <section className="rc-card">
                <p className="rc-k">Most improved</p>
                <p className="rc-big">
                  {r.improved.from}
                  <span> to </span>
                  {r.improved.to}
                </p>
                <p className="rc-note">{r.improved.label}, from your first report this month to your last.</p>
              </section>
            )}

            {r.live && (
              <section className="rc-card">
                <p className="rc-k">With the coach in OBS</p>
                <p className="rc-big">
                  {r.live.streams}
                  <span> {r.live.streams === 1 ? "stream" : "streams"}</span>
                </p>
                <p className="rc-note">
                  Biggest crowd {r.live.peak}
                  {r.live.followers ? ` · ${r.live.followers > 0 ? "+" : ""}${r.live.followers} followers` : ""}
                </p>
              </section>
            )}

            {r.clip && (
              <section className="rc-card rc-clip">
                <p className="rc-k">
                  Best clip <span>· {r.clips} this month</span>
                </p>
                <Link href={`/dashboard/clips/${r.clip.id}/edit`} className="rc-clip-link">
                  {r.clip.thumbnail && !r.clip.thumbnail.startsWith("data:") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.clip.thumbnail} alt="" />
                  ) : null}
                  <span>{r.clip.title}</span>
                </Link>
              </section>
            )}
          </div>

          {r.nextFix && (
            <section className="rc-next">
              <p className="rc-k">{r.current ? "Your fix right now" : `Carry into ${next}`}</p>
              <p className="rc-next-t">{r.nextFix}</p>
            </section>
          )}

          <div className="rc-share">
            <a className="btn btn-primary rc-go" href={`/dashboard/recap/card?month=${month}`} download={`levlcast-${month}.png`}>
              <Download size={16} strokeWidth={2.2} aria-hidden="true" /> Download your card
            </a>
            <p>A picture of your month to post on X, Discord or your stories.</p>
          </div>
        </>
      )}
    </div>
  );
}

function Tier({ rank, note }: { rank: { tier: string; label: string }; note: string }) {
  return (
    <div className="rc-tier" style={{ ["--tier" as string]: TIER_HEX[rank.tier] }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/ranks/${rank.tier.toLowerCase()}.png`} alt="" width={96} height={96} />
      <div>
        <p className="rc-tier-l">{rank.label}</p>
        <p className="rc-tier-n">{note}</p>
      </div>
    </div>
  );
}

function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
