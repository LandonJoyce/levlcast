/**
 * What a new streamer sees on the dashboard before their first report.
 *
 * Left: the ladder they're about to land on, every tier's emblem, with
 * "Unranked" where their rank will be. The first report is a placement,
 * and showing where it could put them is the reason to run it.
 *
 * Right, one of three:
 *   analyzing   The first analysis is running (often queued at sign-in).
 *               The page polls and swaps to the real dashboard when done.
 *   no-streams  Twitch has no saved broadcasts. Usually VOD saving is off,
 *               which is Twitch's default, so this says exactly where the
 *               setting is instead of "come back later".
 *   synced      Streams are in. The newest few are listed with Analyze
 *               right there, so the first report is one click away.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TIERS } from "@/lib/rank";
import { getUserUsage } from "@/lib/limits";
import { AnalyzeButton } from "./analyze-button";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export async function OnboardingHero() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: inProgress }, { data: waiting, count }, usage] = await Promise.all([
    supabase
      .from("vods")
      .select("id, title, duration_seconds, status")
      .eq("user_id", user.id)
      .in("status", ["transcribing", "analyzing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vods")
      .select("id, title, duration_seconds, status, stream_date, created_at", { count: "exact" })
      .eq("user_id", user.id)
      .in("status", ["pending", "failed"])
      .order("stream_date", { ascending: false })
      .limit(4),
    getUserUsage(user.id, supabase),
  ]);

  const streams = waiting ?? [];
  const total = count ?? streams.length;

  return (
    <section className="hm-top ob">
      <div className="rp rp-unranked ob-ladder">
        <p className="rp-k">Your rank</p>
        <p className="rp-tier">Unranked</p>
        <ul className="ob-tiers" aria-label="The ladder, lowest to highest">
          {TIERS.map((t, i) => (
            <li key={t.name} style={{ ["--i" as string]: i }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/ranks/${t.name.toLowerCase()}.png`} alt={t.name} width={384} height={384} />
            </li>
          ))}
        </ul>
        <p className="rp-note">Your first analyzed stream places you somewhere on here.</p>
      </div>

      <div className="hm-last ob-main">
        {inProgress ? (
          <>
            <p className="hm-k">Your first report</p>
            <p className="ob-title">Being made right now.</p>
            <p className="ob-sub">
              {inProgress.title || "Your stream"}
              {inProgress.duration_seconds ? ` · ${formatDuration(inProgress.duration_seconds)}` : ""}
            </p>
            <ol className="vp-steps">
              {[
                ["Pulled from Twitch", "done"],
                ["Transcribing the audio", inProgress.status === "transcribing" ? "active" : "done"],
                ["Writing your report", inProgress.status === "transcribing" ? "next" : "active"],
              ].map(([label, state]) => (
                <li key={label} className="vp-step" data-state={state}>
                  <span className="vp-icon" aria-hidden="true">
                    {state === "done" ? "✓" : state === "active" ? <span className="ob-dot" /> : null}
                  </span>
                  <div>
                    <p className="vp-step-label">{label}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="ob-note">You can close this tab. It keeps going, and this page flips to your report when it&apos;s in.</p>
          </>
        ) : total === 0 ? (
          <>
            <p className="hm-k">No saved streams on Twitch</p>
            <p className="ob-title">Turn on VOD saving and you&apos;re set.</p>
            {/* Twitch doesn't save broadcasts unless the streamer turns it
                on, and most small streamers never have. Naming the setting
                turns a dead end into a two minute fix. */}
            <p className="ob-sub">
              Twitch doesn&apos;t keep your broadcasts unless{" "}
              <a href="https://dashboard.twitch.tv/settings/stream" target="_blank" rel="noopener noreferrer">
                Store past broadcasts
              </a>{" "}
              is on, and it&apos;s off by default. Switch it on and your next stream shows up here. Until then you can
              run a report on any stream, even someone else&apos;s.
            </p>
            <div className="hm-actions">
              <Link href="/analyze" className="btn btn-blue">
                Analyze any stream
              </Link>
              <Link href="/dashboard/vods" className="btn btn-ghost">
                Check Twitch again
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="hm-k">
              Pick your first stream
              <span>{total} synced</span>
            </p>
            <ul className="ob-list">
              {streams.map((v) => (
                <li key={v.id}>
                  <div>
                    <p className="ob-row-title">{v.title}</p>
                    <p className="ob-row-meta">
                      {formatDate(v.stream_date ?? v.created_at)}
                      {v.duration_seconds ? ` · ${formatDuration(v.duration_seconds)}` : ""}
                    </p>
                  </div>
                  <AnalyzeButton
                    vodId={v.id}
                    status={v.status}
                    vodTitle={v.title}
                    durationSeconds={v.duration_seconds ?? 0}
                    hasProcessing={false}
                    userPlan={usage.plan}
                  />
                </li>
              ))}
            </ul>
            {total > streams.length && (
              <Link href="/dashboard/vods" className="hm-more ob-all">
                All {total} streams
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
