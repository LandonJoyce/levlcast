import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClipEditor } from "@/components/dashboard/clip-editor";
import { getUserUsage } from "@/lib/limits";
import { roboto } from "@/app/fonts";
import {
  sliceWordsForClip,
  groupWordsIntoCards,
  type CaptionWord,
  type CaptionCard,
  type CaptionStyle,
} from "@/lib/captions";

/**
 * Clip editor — trim, captions, format and facecam, cover.
 *
 * The editor works against the clip's stored clean source on R2 so re-cuts
 * are fast and don't require Twitch redownload. Bounds are constrained to
 * the original cut window — extending outward isn't supported here.
 */

/** "48 seconds", or "2:05" from a minute up. */
function clipLength(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} seconds`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function CantEdit({ title, body }: { title: string; body: string }) {
  return (
    <>
      <header className="sp-head">
        <Link href="/dashboard/clips" className="sp-back">
          <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" /> Clips
        </Link>
      </header>
      <div className="sp-state">
        <p className="sp-state-title">{title}</p>
        <p>{body}</p>
        <Link href="/dashboard/clips" className="btn btn-ghost">
          Back to clips
        </Link>
      </div>
    </>
  );
}
export default async function ClipEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: clip }, { data: connections }, usage] = await Promise.all([
    supabase
      .from("clips")
      .select("*, vods(id, word_timestamps)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase.from("social_connections").select("platform").eq("user_id", user.id),
    getUserUsage(user.id, supabase),
  ]);
  const isPro = usage.plan === "pro";
  const isYouTubeConnected = (connections ?? []).some((c) => c.platform === "youtube");
  if (!clip) notFound();
  if (!clip.source_video_url) {
    return (
      <CantEdit
        title="This clip can't be edited."
        body="It was made before the editor existed, so there's no clean copy on file. Make a new clip from the same moment and that one can be edited."
      />
    );
  }

  // Reels need per-segment metadata (added in migration 012) to render
  // captions correctly. Older reels generated before this column existed
  // have no segment data and stay locked out — re-generating the reel
  // populates the metadata.
  const isReel = clip.is_highlight_reel === true;
  const reelSegments = (clip.reel_segments as Array<{ vodStart: number; vodEnd: number; reelStart: number; reelEnd: number }> | null) ?? null;
  if (isReel && (!reelSegments || reelSegments.length === 0)) {
    return (
      <CantEdit
        title="Make this reel again to edit it."
        body="It was made before the editor handled reels. Make it again from the stream's page and the new one can be edited."
      />
    );
  }

  // Default caption cards. For regular clips: slice the VOD's words once.
  // For reels: walk each stitched segment, slice that segment's words from
  // the VOD, and remap the timestamps to reel-local time before grouping.
  const fullDuration = (clip.end_time_seconds as number) - (clip.start_time_seconds as number);
  const vodWords = ((clip.vods as { word_timestamps?: CaptionWord[] | null } | null)?.word_timestamps ?? null);
  let defaultCards: CaptionCard[] = [];
  if (clip.edited_captions) {
    defaultCards = clip.edited_captions as CaptionCard[];
  } else if (vodWords) {
    if (isReel && reelSegments) {
      // Per-segment slice + reel-local remap, then group across the full reel.
      // sliceWordsForClip rebases each word so t=0 = segment.vodStart, so we
      // add segment.reelStart to land it at the right reel-local position.
      const remapped: CaptionWord[] = [];
      for (const seg of reelSegments) {
        const segWords = sliceWordsForClip(vodWords, seg.vodStart, seg.vodEnd);
        for (const w of segWords) {
          remapped.push({
            word: w.word,
            start: w.start + seg.reelStart,
            end: w.end + seg.reelStart,
            speaker: w.speaker,
          });
        }
      }
      defaultCards = groupWordsIntoCards(remapped);
    } else {
      const sliced = sliceWordsForClip(
        vodWords,
        clip.start_time_seconds as number,
        clip.end_time_seconds as number
      );
      defaultCards = groupWordsIntoCards(sliced);
    }
  }

  const videoUrl = (clip.source_video_url as string) ?? (clip.video_url as string);

  return (
    <div className={`${roboto.variable} ce-page`}>
      <header className="sp-head">
        <Link href="/dashboard/clips" className="sp-back">
          <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" /> Clips
        </Link>
        <div className="sp-head-row">
          <div className="sp-head-main">
            <h1 className="page-title sp-title">{(clip.title as string) || "Edit clip"}</h1>
            <p className="sp-meta">
              {isReel ? "Highlight reel" : "Clip"} · {clipLength(fullDuration)}
            </p>
          </div>
        </div>
      </header>

      {/* Keyed on the source so going back to the original cut starts the
          editor over on it. */}
      <ClipEditor
        key={videoUrl}
        clipId={clip.id as string}
        videoUrl={videoUrl}
        capturedThumbnailUrl={(clip.thumbnail_url as string | null) ?? null}
        candidateFrames={(clip.candidate_frames as string[] | null) ?? []}
        fullDuration={fullDuration}
        defaultCards={defaultCards}
        captionStyle={(clip.caption_style as CaptionStyle) ?? "bold"}
        isPro={isPro}
        isYouTubeConnected={isYouTubeConnected}
        isReel={isReel}
        hasOriginal={!!clip.original_video_url}
        title={(clip.title as string) ?? ""}
      />
    </div>
  );
}
