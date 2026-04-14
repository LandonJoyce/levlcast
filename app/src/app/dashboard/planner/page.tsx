import { createClient } from "@/lib/supabase/server";
import { PlannerForm } from "@/components/dashboard/planner/planner-form";
import { Lock, Type } from "lucide-react";
import Link from "next/link";
import Anthropic from "@anthropic-ai/sdk";

async function deriveContentOptions(titles: string[]): Promise<string[]> {
  if (titles.length === 0) return [];

  const anthropic = new Anthropic();

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system:
        "You categorize Twitch stream titles into content types. Be specific and use real names (game titles, content formats). Never return generic labels.",
      messages: [
        {
          role: "user",
          content: `These are recent stream titles from a Twitch streamer:
${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Group these into 3-6 distinct content categories that make sense to this streamer.
Use specific names — if they stream a specific game, name the game. Distinguish modes if they do multiple (e.g. "TERA PVP" vs "TERA PVE"). If they do variety content, use recognizable format names.
Do not use generic labels like "Gaming" or "Stream 1".

Respond with ONLY a JSON array of strings, no markdown:
["Category 1", "Category 2", ...]`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const options = JSON.parse(cleaned);
    if (Array.isArray(options) && options.every((o) => typeof o === "string")) {
      return options.slice(0, 6);
    }
  } catch (err) {
    console.error("[planner] Failed to derive content options:", err);
  }

  // Fallback: dedupe first word of each title
  const seen = new Set<string>();
  const fallback: string[] = [];
  for (const title of titles) {
    const word = title.split(/\s+/)[0];
    if (word && !seen.has(word.toLowerCase())) {
      seen.add(word.toLowerCase());
      fallback.push(word);
    }
  }
  return fallback.slice(0, 6);
}

export default async function PlannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check plan
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_expires_at")
    .eq("id", user!.id)
    .single();

  const isExpired =
    profile?.plan === "pro" &&
    profile?.subscription_expires_at &&
    new Date(profile.subscription_expires_at) < new Date();

  const isPro = profile?.plan === "pro" && !isExpired;

  // Fetch analyzed VODs
  const { data: vods } = await supabase
    .from("vods")
    .select("title, coach_report, peak_data")
    .eq("user_id", user!.id)
    .eq("status", "ready")
    .not("coach_report", "is", null)
    .order("stream_date", { ascending: false })
    .limit(20);

  const analyzedVods = vods || [];
  const hasVodData = analyzedVods.length > 0;

  let contentOptions: string[] = [];
  let streamerIdentity = {
    streamerType: null as string | null,
    dominantCategory: null as string | null,
    totalStreams: 0,
  };

  if (isPro && hasVodData) {
    const titles = [...new Set(analyzedVods.map((v) => v.title))];
    contentOptions = await deriveContentOptions(titles);

    // Streamer identity
    const typeCounts: Record<string, number> = {};
    const catCounts: Record<string, number> = {
      hype: 0,
      funny: 0,
      educational: 0,
      emotional: 0,
    };

    for (const vod of analyzedVods) {
      const report = vod.coach_report as any;
      if (report?.streamer_type) {
        typeCounts[report.streamer_type] =
          (typeCounts[report.streamer_type] ?? 0) + 1;
      }
      const peaks = (vod.peak_data as any[]) || [];
      for (const peak of peaks) {
        const cat = peak?.category?.toLowerCase();
        if (cat && cat in catCounts) catCounts[cat]++;
      }
    }

    const dominantStreamerType =
      Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
    const totalCats = Object.values(catCounts).reduce((a, b) => a + b, 0);
    const dominantCategory =
      totalCats > 0
        ? Object.entries(catCounts).sort(([, a], [, b]) => b - a)[0][0]
        : null;

    streamerIdentity = {
      streamerType: dominantStreamerType,
      dominantCategory,
      totalStreams: analyzedVods.length,
    };
  }

  return (
    <div>
      <div className="mb-8">
        <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3 py-1 rounded-full mb-3 block w-fit">Pro feature</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
          Title Generator
        </h1>
        <p className="text-sm text-muted">
          Pick what you're streaming and get title ideas matched to your style.
        </p>
      </div>

      {!isPro ? (
        <div className="bg-surface border border-accent/20 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Lock size={20} className="text-accent-light" />
          </div>
          <h2 className="text-lg font-bold mb-2">Pro Feature</h2>
          <p className="text-sm text-muted max-w-sm mx-auto mb-6">
            The Title Generator creates stream titles personalized to your
            content and streaming style.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 text-white font-semibold px-5 py-2.5 rounded-full transition-all duration-300 hover:-translate-y-px text-sm"
          >
            Upgrade to Pro
          </Link>
        </div>
      ) : !hasVodData ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <Type size={28} className="text-muted mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">No stream data yet</h2>
          <p className="text-sm text-muted max-w-sm mx-auto mb-6">
            Analyze at least one VOD so we can learn your style and generate
            titles that match.
          </p>
          <Link
            href="/dashboard/vods"
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 text-white font-semibold px-5 py-2.5 rounded-full transition-all duration-300 hover:-translate-y-px text-sm"
          >
            Go to VODs
          </Link>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl p-6">
          <PlannerForm
            contentOptions={contentOptions}
            streamerIdentity={streamerIdentity}
          />
        </div>
      )}
    </div>
  );
}
