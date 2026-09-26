import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { GenerateClipButton } from "@/components/dashboard/generate-clip-button";
import { FailedClipCard } from "@/components/dashboard/failed-clip-card";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";

/*
 * Clips you've made, and the moments you haven't clipped yet.
 *
 * Every detected moment from every stream used to get a tall empty tile
 * with a plus in it, five to a row, so a streamer with eight analyzed
 * streams scrolled past twenty-eight blank boxes to see anything. The
 * clips that exist are still cards, since they're videos. The moments
 * are a list under the stream they came from, the newest few streams
 * open and the rest folded away.
 */

interface Peak {
  title: string;
  start: number;
  end: number;
  score: number;
  category: string;
  reason?: string;
}

function clock(seconds: number | null | undefined): string {
  const t = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function categoryLabel(c: string | null | undefined): string {
  if (!c) return "";
  return c === "funny" ? "Comedy" : c.charAt(0).toUpperCase() + c.slice(1);
}

function vodLinkAt(twitchVodId: string | null | undefined, secs: number): string | null {
  if (!twitchVodId) return null;
  const t = Math.max(0, Math.floor(secs));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `https://www.twitch.tv/videos/${twitchVodId}?t=${h > 0 ? `${h}h${m}m${s}s` : m > 0 ? `${m}m${s}s` : `${s}s`}`;
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** How many streams keep their moments open before the rest fold away. */
const OPEN_STREAMS = 3;

export default async function ClipsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: allClips }, { data: vods }] = await Promise.all([
    supabase
      .from("clips")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["ready", "processing", "failed"])
      .order("created_at", { ascending: false }),
    supabase
      .from("vods")
      .select("id, title, peak_data, stream_date, twitch_vod_id")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .not("peak_data", "is", null)
      .order("stream_date", { ascending: false }),
  ]);

  const clips = allClips ?? [];
  const ready = clips.filter((c) => c.status === "ready");
  const making = clips.filter((c) => c.status === "processing");
  const failed = clips.filter((c) => c.status === "failed");
  const hasProcessing = making.length > 0;

  const readyIds = ready.map((c) => c.id);
  const [{ data: connections }, { data: posts }] = await Promise.all([
    supabase.from("social_connections").select("platform").eq("user_id", user.id),
    readyIds.length > 0
      ? supabase
          .from("social_posts")
          .select("clip_id, platform, platform_url")
          .eq("user_id", user.id)
          .eq("platform", "youtube")
          .in("clip_id", readyIds)
      : Promise.resolve({ data: [] as Array<{ clip_id: string; platform_url: string | null }> }),
  ]);
  const isYouTubeConnected = connections?.some((c) => c.platform === "youtube") ?? false;
  const postedUrl = new Map((posts ?? []).map((p) => [p.clip_id, p.platform_url as string | null]));

  const vodTitle = new Map((vods ?? []).map((v) => [v.id, v.title as string]));
  const toPost = ready.filter((c) => !postedUrl.has(c.id));
  const posted = ready.filter((c) => postedUrl.has(c.id));

  // Moments without a clip, per stream. A clip trimmed in the editor can
  // start a good way after its moment, so anything from a minute before
  // the moment to its end counts as that moment's clip.
  const groups = (vods ?? [])
    .map((v) => {
      const peaks = ((v.peak_data as Peak[] | null) ?? []).map((p, index) => ({ ...p, index }));
      const open = peaks.filter(
        (p) =>
          !clips.some(
            (c) =>
              c.vod_id === v.id &&
              !c.is_highlight_reel &&
              (c.status === "ready" || c.status === "processing") &&
              (c.start_time_seconds as number) >= Math.round(p.start) - 60 &&
              (c.start_time_seconds as number) <= Math.round(p.end) + 5
          )
      );
      return { id: v.id as string, title: v.title as string, date: v.stream_date as string | null, twitchVodId: v.twitch_vod_id as string | null, moments: open };
    })
    .filter((g) => g.moments.length > 0);
  const momentCount = groups.reduce((n, g) => n + g.moments.length, 0);
  const openGroups = groups.slice(0, OPEN_STREAMS);
  const foldedGroups = groups.slice(OPEN_STREAMS);

  const nothing = ready.length === 0 && making.length === 0 && failed.length === 0 && momentCount === 0;

  const renderGroup = (g: (typeof groups)[number]) => (
    <div key={g.id} className="cm-group">
      <p className="cm-stream">
        <Link href={`/dashboard/vods/${g.id}`}>{g.title}</Link>
        <span>{shortDate(g.date)}</span>
      </p>
      <ol className="sp-moments">
        {g.moments.map((m) => {
          const href = vodLinkAt(g.twitchVodId, m.start);
          return (
            <li key={m.index} className="sp-moment">
              {href ? (
                <a className="sp-moment-time" href={href} target="_blank" rel="noopener noreferrer" title="Open this moment on Twitch">
                  {clock(m.start)}
                </a>
              ) : (
                <span className="sp-moment-time">{clock(m.start)}</span>
              )}
              <div className="sp-moment-main">
                <p className="sp-moment-title">
                  {m.title}
                  {m.category && <span className="sp-moment-cat">{categoryLabel(m.category)}</span>}
                </p>
                {m.reason && <p className="sp-moment-why">{m.reason}</p>}
              </div>
              <div className="sp-moment-act">
                <GenerateClipButton vodId={g.id} peakIndex={m.index} hasProcessing={hasProcessing} clipTitle={m.title} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );

  const card = (c: (typeof ready)[number]) => {
    const url = postedUrl.get(c.id);
    const length =
      typeof c.end_time_seconds === "number" && typeof c.start_time_seconds === "number"
        ? clock((c.end_time_seconds as number) - (c.start_time_seconds as number))
        : null;
    return (
      <div key={c.id} className="cl-card" data-posted={postedUrl.has(c.id) ? "yes" : undefined}>
        <Link href={`/dashboard/clips/${c.id}/edit`} className="cl-thumb" aria-label={`Open ${(c.title as string) || "clip"}`}>
          {c.video_url ? (
            <video
              src={c.thumbnail_url ? (c.video_url as string) : `${c.video_url as string}#t=0.5`}
              poster={(c.thumbnail_url as string | null) ?? undefined}
              preload="metadata"
              muted
              playsInline
            />
          ) : c.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.thumbnail_url as string} alt="" loading="lazy" />
          ) : null}
          {length && <span className="cl-len">{length}</span>}
          {c.is_highlight_reel && <span className="cl-reel">Reel</span>}
        </Link>
        <div className="cl-body">
          <Link href={`/dashboard/clips/${c.id}/edit`} className="cl-title">
            {(c.title as string) || (c.is_highlight_reel ? "Highlight reel" : "Untitled clip")}
          </Link>
          <p className="cl-from">
            {categoryLabel(c.peak_category as string | null)}
            {c.peak_category && vodTitle.get(c.vod_id as string) ? " · " : ""}
            {vodTitle.get(c.vod_id as string) ?? ""}
          </p>
          {url ? (
            <a className="cl-posted" href={url} target="_blank" rel="noopener noreferrer">
              On YouTube <ArrowUpRight size={12} aria-hidden="true" />
            </a>
          ) : postedUrl.has(c.id) ? (
            <span className="cl-posted">Posted</span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <VodStatusPoller hasProcessing={hasProcessing} />

      <div className="hm-hello">
        <div>
          <h1 className="page-title">Clips</h1>
          {!nothing && (
            <p className="sl-sum">
              {toPost.length} ready to post · {momentCount} {momentCount === 1 ? "moment" : "moments"} not clipped yet
            </p>
          )}
        </div>
      </div>

      {nothing ? (
        <section className="sl-empty">
          <p className="sl-empty-title">No clips yet.</p>
          <p className="cl-empty-sub">Every stream you analyze comes back with the moments worth clipping. They show up here.</p>
          <Link href="/dashboard/vods" className="btn btn-blue">
            Analyze a stream
          </Link>
        </section>
      ) : (
        <>
          {(toPost.length > 0 || making.length > 0) && (
            <section className="hm-sec">
              <div className="hm-head">
                <h2>Ready to post</h2>
                {toPost.length > 0 && <span className="hm-record">{toPost.length} waiting</span>}
              </div>
              {!isYouTubeConnected && toPost.length > 0 && (
                <p className="uc-connect">
                  Download them from the editor, or connect YouTube and post them as Shorts in one click.{" "}
                  <Link href="/dashboard/settings#connections">Connect YouTube</Link>
                </p>
              )}
              <div className="cl-grid">
                {making.map((c) => (
                  <div key={c.id} className="cl-card" data-making="yes">
                    <div className="cl-thumb">
                      <span className="cl-making">
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        Making it
                      </span>
                    </div>
                    <div className="cl-body">
                      <p className="cl-title">{(c.title as string) || "Clip"}</p>
                      <p className="cl-from">Takes a minute or two</p>
                    </div>
                  </div>
                ))}
                {toPost.map(card)}
              </div>
            </section>
          )}

          {failed.length > 0 && (
            <section className="hm-sec">
              <div className="hm-head">
                <h2>Didn&apos;t render</h2>
                <span className="hm-record">Try again, it usually works</span>
              </div>
              <div className="cl-grid">
                {failed.map((c) => (
                  <FailedClipCard
                    key={c.id}
                    clipId={c.id}
                    vodId={c.vod_id as string}
                    startSeconds={c.start_time_seconds as number}
                    title={(c.title as string) || "Clip"}
                    category={categoryLabel(c.peak_category as string | null) || "Moment"}
                    timestamp={clock(c.start_time_seconds as number | null)}
                  />
                ))}
              </div>
            </section>
          )}

          {momentCount > 0 && (
            <section className="hm-sec">
              <div className="hm-head">
                <h2>Moments to clip</h2>
                <span className="hm-record">
                  {momentCount} from {groups.length} {groups.length === 1 ? "stream" : "streams"}
                </span>
              </div>
              {hasProcessing && (
                <p className="uc-connect">Making one clip right now. The buttons come back when it&apos;s done.</p>
              )}
              {openGroups.map(renderGroup)}
              {foldedGroups.length > 0 && (
                <details className="cm-more">
                  <summary>
                    {foldedGroups.reduce((n, g) => n + g.moments.length, 0)} more from {foldedGroups.length} older{" "}
                    {foldedGroups.length === 1 ? "stream" : "streams"}
                  </summary>
                  {foldedGroups.map(renderGroup)}
                </details>
              )}
            </section>
          )}

          {posted.length > 0 && (
            <section className="hm-sec">
              <details className="cm-more">
                <summary>Posted · {posted.length}</summary>
                <div className="cl-grid">{posted.map(card)}</div>
              </details>
            </section>
          )}
        </>
      )}
    </>
  );
}
