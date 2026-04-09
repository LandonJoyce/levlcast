import { createClient } from "@/lib/supabase/server";
import { ArchetypeCard } from "@/components/dashboard/grow/archetype-card";
import { EnergyMatchCard } from "@/components/dashboard/grow/energy-match-card";
import { ConsistencyGrid } from "@/components/dashboard/grow/consistency-grid";
import { TrendingUp } from "lucide-react";
import Link from "next/link";

interface Peak {
  category: string;
  score: number;
  title: string;
  caption: string;
}

export default async function GrowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get all analyzed VODs
  const { data: vods } = await supabase
    .from("vods")
    .select("id, title, stream_date, peak_data")
    .eq("user_id", user!.id)
    .eq("status", "ready")
    .not("peak_data", "is", null)
    .order("stream_date", { ascending: false });

  // Get top clips
  const { data: topClips } = await supabase
    .from("clips")
    .select("id, title, video_url, peak_score, peak_category, caption_text, description")
    .eq("user_id", user!.id)
    .eq("status", "ready")
    .order("peak_score", { ascending: false })
    .limit(3);

  // Count peak categories across all VODs
  const categoryCounts: Record<string, number> = { hype: 0, funny: 0, educational: 0, emotional: 0 };
  for (const vod of vods || []) {
    const peaks = (vod.peak_data as Peak[]) || [];
    for (const peak of peaks) {
      const cat = peak.category?.toLowerCase();
      if (cat && cat in categoryCounts) categoryCounts[cat]++;
    }
  }

  const totalPeaks = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const dominantCategory = totalPeaks > 0
    ? (Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0])
    : null;

  // Stream dates for consistency grid (last 28 days)
  const streamDates = new Set(
    (vods || []).map((v) => v.stream_date?.slice(0, 10)).filter(Boolean)
  );

  const hasData = totalPeaks > 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Growth Playbook</h1>
        <p className="text-sm text-muted">
          Personalized tactics to get more viewers — based on your actual stream data.
        </p>
      </div>

      {!hasData ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
            <TrendingUp size={24} className="text-accent-light" />
          </div>
          <h2 className="text-xl font-bold mb-2">Analyze a VOD first</h2>
          <p className="text-sm text-muted max-w-md mx-auto mb-6">
            Your Growth Playbook is built from your real stream data. Analyze at least one VOD to unlock it.
          </p>
          <Link
            href="/dashboard/vods"
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 text-white font-semibold px-5 py-2.5 rounded-xl transition-opacity text-sm"
          >
            Go to VODs
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Archetype + Category breakdown */}
          <ArchetypeCard
            dominantCategory={dominantCategory}
            categoryCounts={categoryCounts}
            totalPeaks={totalPeaks}
          />

          {/* Viral Energy Match */}
          {topClips && topClips.length > 0 && (
            <EnergyMatchCard clips={topClips} />
          )}

          {/* Growth Tactics */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-3">
              How to Grow
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TacticCard
                emoji="📱"
                title="Go Live on TikTok Too"
                body="TikTok's algorithm pushes you to new people automatically. Twitch doesn't. Use Restream or OBS to stream both at once — zero extra effort."
                tag="Quickest win"
                tagColor="text-green-400 bg-green-500/10"
              />
              <TacticCard
                emoji="✂️"
                title="Post a Clip Every Day"
                body="One clip a day is enough. Short-form video is how people discover you. Your clips are already made — just post them."
                tag="Already built in"
                tagColor="text-accent-light bg-accent/10"
                href="/dashboard/clips"
                cta="See your clips"
              />
              <TacticCard
                emoji="⚡"
                title="Stream Like Your Best Moments"
                body="When someone finds your TikTok clip and comes to Twitch, they expect that same energy. Your peak moments define your brand — match them every stream."
                tag="Long-term growth"
                tagColor="text-yellow-400 bg-yellow-500/10"
              />
            </div>
          </div>

          {/* Stream Consistency */}
          <ConsistencyGrid streamDates={streamDates} />
        </div>
      )}
    </div>
  );
}

function TacticCard({
  emoji,
  title,
  body,
  tag,
  tagColor,
  href,
  cta,
}: {
  emoji: string;
  title: string;
  body: string;
  tag: string;
  tagColor: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="text-2xl">{emoji}</div>
      <div>
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${tagColor}`}>
          {tag}
        </span>
      </div>
      <h3 className="font-bold text-sm leading-snug">{title}</h3>
      <p className="text-xs text-muted leading-relaxed flex-1">{body}</p>
      {href && cta && (
        <Link
          href={href}
          className="text-xs font-semibold text-accent-light hover:underline mt-auto"
        >
          {cta} →
        </Link>
      )}
    </div>
  );
}
