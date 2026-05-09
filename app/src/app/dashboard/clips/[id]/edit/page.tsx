import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ClipEditor } from "@/components/dashboard/clip-editor";
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

  const { data: clip } = await supabase
    .from("clips")
    .select("*, vods(id, word_timestamps)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
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

  // Default caption cards — derive from the parent VOD's word timestamps,
  // then fall back to anything the user already saved on this clip.
  const fullDuration = (clip.end_time_seconds as number) - (clip.start_time_seconds as number);
  const vodWords = ((clip.vods as { word_timestamps?: CaptionWord[] | null } | null)?.word_timestamps ?? null);
  let defaultCards: CaptionCard[] = [];
  if (clip.edited_captions) {
    defaultCards = clip.edited_captions as CaptionCard[];
  } else if (vodWords) {
    const sliced = sliceWordsForClip(
      vodWords,
      clip.start_time_seconds as number,
      clip.end_time_seconds as number
    );
    defaultCards = groupWordsIntoCards(sliced);
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
        title={(clip.title as string) ?? ""}
      />
    </>
  );
}
