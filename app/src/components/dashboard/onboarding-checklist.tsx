import Link from "next/link";
import type { ReactNode } from "react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { AddToObsButton } from "@/components/dashboard/add-to-obs";

/**
 * Setup steps on the home page, once someone has their first report, until
 * they've done the things that make people come back: the coach in OBS,
 * one stream with it open, and a clip. It used to walk them through
 * syncing VODs (that happens by itself now) and opening the clip editor,
 * and never mentioned OBS, which only 5 of 18 signups had added by
 * 2026-10-11. While it's up it is the home page's OBS pitch, so the OBS
 * card isn't shown next to it.
 *
 * Server component: it does its own counts so the page doesn't thread them.
 */
export async function OnboardingChecklist({ pro = false }: { pro?: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();

  const [{ data: firstReady }, { data: firstClip }, { count: docks }, { count: streams }] = await Promise.all([
    supabase.from("vods").select("id").eq("user_id", user.id).eq("status", "ready").order("analyzed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("clips").select("id").eq("user_id", user.id).eq("status", "ready").limit(1).maybeSingle(),
    admin.from("live_docks").select("user_id", { count: "exact", head: true }).eq("user_id", user.id),
    admin.from("live_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const reported = !!firstReady;
  const streamed = (streams ?? 0) > 0;
  const docked = streamed || (docks ?? 0) > 0;
  const clipped = !!firstClip;
  if (reported && docked && streamed && clipped) return null;

  const steps: Array<{ title: string; note: string; done: boolean; action?: ReactNode }> = [
    { title: "Connected Twitch", note: "Your LevlCast account is your Twitch account.", done: true },
    {
      title: "Get your first report",
      note: "It reads your latest stream and tells you the one thing to fix.",
      done: reported,
      action: (
        <Link href="/dashboard/vods" className="btn btn-primary ob-step-go">
          Pick a stream
        </Link>
      ),
    },
    {
      title: "Add the coach to OBS",
      note: "It sits next to your stream and catches a muted mic, long quiet stretches and new chatters. About 3 minutes.",
      done: docked,
      action: (
        <AddToObsButton className="btn btn-primary ob-step-go" pro={pro}>
          Add to OBS
        </AddToObsButton>
      ),
    },
    {
      title: "Go live with it open",
      note: "Keep the panel open on your next stream. It also shows the fix your next report checks.",
      done: streamed,
    },
    {
      title: "Post your first clip",
      note: "Your best moments are cut with captions, ready for Shorts and TikTok.",
      done: clipped,
      action: (
        <Link href="/dashboard/clips" className="btn btn-ghost ob-step-go">
          See your clips
        </Link>
      ),
    },
  ];
  const next = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="ob-steps" aria-label="Get set up">
      <header className="ob-steps-h">
        <h2>Get set up</h2>
        <span>
          {doneCount} of {steps.length} done
        </span>
      </header>
      <ol>
        {steps.map((s, i) => (
          <li key={s.title} data-state={s.done ? "done" : i === next ? "next" : "later"}>
            <span className="ob-step-mark" aria-hidden="true">
              {s.done ? "✓" : i + 1}
            </span>
            <div className="ob-step-text">
              <p className="ob-step-t">{s.title}</p>
              <p className="ob-step-n">{s.note}</p>
            </div>
            {!s.done && i === next && s.action ? s.action : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
