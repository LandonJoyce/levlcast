import { createClient } from "@/lib/supabase/server";
import { FREE_COACH_MINUTES } from "@/lib/live/server";
import LiveSetup from "./LiveSetup";
import "./live-setup.css";

export const dynamic = "force-dynamic";

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  title: string | null;
  game_name: string | null;
  peak_viewers: number;
  viewer_sum: number;
  sample_count: number;
  followers_start: number | null;
  followers_end: number | null;
  last_seen_at: string;
}

function length(r: SessionRow): string {
  const end = Date.parse(r.ended_at ?? r.last_seen_at);
  const m = Math.max(0, Math.round((end - Date.parse(r.started_at)) / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

/**
 * Live: get the private OBS dock set up, and see the streams it watched.
 * The dock itself is /live/<token>; see lib/live/server.ts.
 */
export default async function LivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("live_sessions")
    .select("id, started_at, ended_at, title, game_name, peak_viewers, viewer_sum, sample_count, followers_start, followers_end, last_seen_at")
    .eq("user_id", user!.id)
    .order("started_at", { ascending: false })
    .limit(10);
  const sessions = (data ?? []) as SessionRow[];

  return (
    <div className="lv">
      <div>
        <span className="page-eyebrow">Live</span>
        <h1 className="page-title">Coaching while you stream</h1>
        <p className="page-sub">
          A panel inside OBS that coaches you while you&apos;re live, the way your report does after. Only you can see it.
        </p>
        <p className="lv-plan-line">
          Free coaches the first {FREE_COACH_MINUTES} minutes of every stream. Pro coaches all of it, and adds a coach that
          listens to your stream and gives you tips just for you.
        </p>
      </div>

      <figure className="lv-shot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/live/levlcast-in-obs.webp" width={1600} height={900} alt="The LevlCast panel docked on the right side of OBS during a stream" />
        <figcaption>What it looks like in OBS. It&apos;s part of OBS&apos;s window, not your stream.</figcaption>
      </figure>

      <LiveSetup />

      <section className="card card-pad lv-steps">
        <h3>Add it to OBS, about a minute</h3>
        <ol>
          <li>
            <b>Copy your link</b> above.
          </li>
          <li>
            In OBS, click <b>Docks</b>, then <b>Custom Browser Docks</b>.
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/live/obs-step-docks.webp" width={520} height={420} alt="The Docks menu in OBS, with Custom Browser Docks at the bottom" />
          </li>
          <li>
            Type <b>LevlCast</b> as the name, paste your link next to it, and click <b>Apply</b>. Drag the new panel wherever you
            like.
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/live/obs-step-dialog.webp" width={680} height={227} alt="OBS's Custom Browser Docks window with LevlCast and the link filled in" />
          </li>
          <li>
            For mic and scene coaching, open <b>Tools</b>, then <b>WebSocket Server Settings</b>. Tick <b>Enable WebSocket server</b>,
            click <b>Show Connect Info</b> and copy the password. Then press <b>Connect OBS</b> in the LevlCast panel and paste it.
          </li>
          <li>
            Want it in your ear instead? Open the same link on your phone, put in one earbud and tap <b>Voice</b>. Keep the OBS
            panel open too, so your phone hears about your mic and scenes.
          </li>
        </ol>
        <p className="lv-note">
          The panel is part of OBS, not your stream, so viewers never see it. If you capture your whole screen, keep the panel
          on another monitor.
        </p>
        <p className="lv-note">
          Using Streamlabs or Twitch Studio? Open the link in a browser tab on a second screen. You get viewers, chat and the
          coaching nudges, just not the mic and scene ones.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Streams the panel watched</h3>
        </div>
        {sessions.length === 0 ? (
          <p className="lv-empty">Nothing yet. Keep the panel open during your next stream and it shows up here.</p>
        ) : (
          <table className="lv-table">
            <thead>
              <tr>
                <th>Stream</th>
                <th>Length</th>
                <th>Peak</th>
                <th>Average</th>
                <th>Followers</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((r) => {
                const avg = r.sample_count ? r.viewer_sum / r.sample_count : null;
                const gained = r.followers_start !== null && r.followers_end !== null ? r.followers_end - r.followers_start : null;
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="lv-date">
                        {new Date(r.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        {r.ended_at ? "" : " · live now"}
                      </span>
                      <span className="lv-title">{r.title || r.game_name || "Untitled stream"}</span>
                    </td>
                    <td>{length(r)}</td>
                    <td>{r.peak_viewers}</td>
                    <td>{avg === null ? "-" : avg.toFixed(avg < 10 ? 1 : 0)}</td>
                    <td>{gained === null ? "-" : `${gained >= 0 ? "+" : ""}${gained}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
