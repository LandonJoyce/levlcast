"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

interface UnpostedClip {
  id: string;
  title: string | null;
  peak_category: string | null;
}

interface Props {
  clips: UnpostedClip[];
  isYouTubeConnected: boolean;
}

function categoryLabel(c: string): string {
  if (c === "funny") return "Comedy";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/**
 * Clips that are cut and waiting to go out. Without YouTube connected the
 * list still shows, since the clips are still there to download, with a
 * line under it about posting them as Shorts.
 */
export function UnpostedClipsCard({ clips, isYouTubeConnected }: Props) {
  const router = useRouter();
  const [posting, setPosting] = useState<Record<string, "loading" | "done" | "error">>({});

  async function post(clipId: string) {
    setPosting((p) => ({ ...p, [clipId]: "loading" }));
    try {
      const res = await fetch("/api/youtube/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId }),
      });
      if (!res.ok) throw new Error();
      setPosting((p) => ({ ...p, [clipId]: "done" }));
      router.refresh();
    } catch {
      setPosting((p) => ({ ...p, [clipId]: "error" }));
    }
  }

  const shown = clips.slice(0, 3);

  return (
    <>
      <div className="hm-head">
        <h2>Ready to post</h2>
        <span className="hm-record">
          {clips.length} {clips.length === 1 ? "clip" : "clips"} waiting
        </span>
        <Link href="/dashboard/clips?tab=ready" className="hm-more">
          All clips <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>

      <ul className="uc">
        {shown.map((clip) => {
          const state = posting[clip.id];
          return (
            <li key={clip.id} className="uc-row">
              <span className="uc-cat">{categoryLabel(clip.peak_category ?? "hype")}</span>
              <Link href={`/dashboard/clips/${clip.id}/edit`} className="uc-title">
                {clip.title || "Untitled clip"}
              </Link>
              {!isYouTubeConnected ? null : state === "done" ? (
                <span className="uc-done">Posted</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost uc-post"
                  data-state={state}
                  onClick={() => post(clip.id)}
                  disabled={state === "loading"}
                >
                  {state === "loading" ? "Posting..." : state === "error" ? "Retry" : "Post to YouTube"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {!isYouTubeConnected && (
        <p className="uc-connect">
          Connect YouTube and these go out as Shorts in one click.{" "}
          <Link href="/dashboard/settings#connections">Connect YouTube</Link>
        </p>
      )}
    </>
  );
}
