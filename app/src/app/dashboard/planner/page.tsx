import { createClient } from "@/lib/supabase/server";
import { PlannerForm } from "@/components/dashboard/planner/planner-form";
import { CalendarDays, Lock } from "lucide-react";
import Link from "next/link";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function getContentLabel(title: string): string {
  const raw = title.replace(/\s*[-|:!]\s*.*/g, "").trim();
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  // Keep "Just Chatting" intact
  if (
    words[0]?.toLowerCase() === "just" &&
    words[1]?.toLowerCase() === "chatting"
  ) {
    return "Just Chatting";
  }

  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function deriveContentOptions(vods: Array<{ title: string }>): string[] {
  const seen = new Map<string, string>(); // key → display label
  const counts = new Map<string, number>();

  for (const vod of vods) {
    const label = getContentLabel(vod.title);
    if (!label || label.length < 2) continue;
    const key = label.toLowerCase().split(" ")[0]; // first word as dedup key
    if (!seen.has(key)) seen.set(key, label);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([key]) => seen.get(key)!);
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
    .select("title, stream_date, coach_report, peak_data")
    .eq("user_id", user!.id)
    .eq("status", "ready")
    .not("coach_report", "is", null)
    .order("stream_date", { ascending: false })
    .limit(20);

  const analyzedVods = vods || [];

  // Derive content options from VOD titles
  const contentOptions = deriveContentOptions(analyzedVods);

  // Build day performance map (avg score by day of week)
  const dayScores: Record<string, number[]> = {};
  for (const vod of analyzedVods) {
    const score = (vod.coach_report as any)?.overall_score as
      | number
      | undefined;
    if (!score || !vod.stream_date) continue;
    const day = DAYS[new Date(vod.stream_date).getDay()];
    if (!dayScores[day]) dayScores[day] = [];
    dayScores[day].push(score);
  }

  const dayPerformance: Record<string, { avgScore: number; count: number }> =
    {};
  for (const [day, scores] of Object.entries(dayScores)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    dayPerformance[day] = { avgScore: avg, count: scores.length };
  }

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

  const streamerIdentity = {
    streamerType: dominantStreamerType,
    dominantCategory,
    totalStreams: analyzedVods.length,
  };

  const hasVodData = analyzedVods.length > 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">
          Stream Planner
        </h1>
        <p className="text-sm text-muted">
          Pick what you're streaming this week and get a schedule + title
          recommendations tailored to your data.
        </p>
      </div>

      {!isPro ? (
        <div className="bg-surface border border-accent/20 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Lock size={20} className="text-accent-light" />
          </div>
          <h2 className="text-lg font-bold mb-2">Pro Feature</h2>
          <p className="text-sm text-muted max-w-sm mx-auto mb-6">
            The Stream Planner uses your stream history to recommend optimal
            days, times, and title ideas personalized to you.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 text-white font-semibold px-5 py-2.5 rounded-xl transition-opacity text-sm"
          >
            Upgrade to Pro
          </Link>
        </div>
      ) : !hasVodData ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <CalendarDays size={28} className="text-muted mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">No stream data yet</h2>
          <p className="text-sm text-muted max-w-sm mx-auto mb-6">
            Analyze at least one VOD to unlock personalized scheduling and title
            recommendations.
          </p>
          <Link
            href="/dashboard/vods"
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 text-white font-semibold px-5 py-2.5 rounded-xl transition-opacity text-sm"
          >
            Go to VODs
          </Link>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl p-6">
          <PlannerForm
            contentOptions={contentOptions}
            dayPerformance={dayPerformance}
            streamerIdentity={streamerIdentity}
          />
        </div>
      )}
    </div>
  );
}
