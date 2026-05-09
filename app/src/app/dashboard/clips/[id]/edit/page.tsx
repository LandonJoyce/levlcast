import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ClipEditor } from "@/components/dashboard/clip-editor";
import { getUserUsage } from "@/lib/limits";
import {
  sliceWordsForClip,
  groupWordsIntoCards,
  type CaptionWord,
  type CaptionCard,
  type CaptionStyle,
} from "@/lib/captions";

/**
 * Clip editor — trim, caption text, hook frame.
 *
 * The editor works against the clip's stored clean source on R2 so re-cuts
 * are fast and don't require Twitch redownload. Bounds are constrained to
 * the original cut window — extending outward isn't supported here.
 */
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
      <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>
          This clip can't be edited
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 16px" }}>
          It was generated before the editor existed and doesn't have a clean source on file. Generate a new clip from the same moment to edit.
        </p>
        <Link href="/dashboard/clips" className="btn btn-ghost" style={{ fontSize: 12 }}>
          Back to clips
        </Link>
      </div>
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
      <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>
          Re-generate this reel to edit it
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 16px" }}>
          This highlight reel was made before the editor supported reels. Regenerate it from the stream's report and the new copy will be editable.
        </p>
        <Link href="/dashboard/clips" className="btn btn-ghost" style={{ fontSize: 12 }}>
          Back to clips
        </Link>
      </div>
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

  return (
    <>
      <div>
        <Link href="/dashboard/clips" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12, marginBottom: 8 }}>
          ← Back to clips
        </Link>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 6px", color: "var(--ink)" }}>
        Edit clip
      </h1>
      <p className="page-sub" style={{ marginBottom: 24 }}>
        Trim the moment, fix any caption typos, and pick a hook frame. Re-edits don't cost a clip from your quota.
      </p>

      <ClipEditor
        clipId={clip.id as string}
        videoUrl={(clip.source_video_url as string) ?? (clip.video_url as string)}
        capturedThumbnailUrl={(clip.thumbnail_url as string | null) ?? null}
        candidateFrames={(clip.candidate_frames as string[] | null) ?? []}
        fullDuration={fullDuration}
        defaultCards={defaultCards}
        captionStyle={(clip.caption_style as CaptionStyle) ?? "bold"}
        isPro={isPro}
        isYouTubeConnected={isYouTubeConnected}
        isReel={isReel}
        title={(clip.title as string) ?? ""}
      />
    </>
  );
}
