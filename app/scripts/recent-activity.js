#!/usr/bin/env node
/**
 * scripts/recent-activity.js
 *
 * Show recent VOD analyses with who ran them, plan tier, duration, and score.
 * Used to triage Inngest run logs without round-tripping through the Supabase
 * SQL editor.
 *
 * Usage:
 *   node --env-file=.env.local scripts/recent-activity.js              # last 24h
 *   node --env-file=.env.local scripts/recent-activity.js --hours 6
 *   node --env-file=.env.local scripts/recent-activity.js --hours 48 --limit 25
 *   node --env-file=.env.local scripts/recent-activity.js --user 7a91c9d4-80bc-462a-b42d-0e52599aaed1
 *   node --env-file=.env.local scripts/recent-activity.js --vod ccf72e0c-1a65-4328-8c4c-a7f22be9fb8e
 *
 * Output columns: when · who · plan · vod_id · minutes · score · title
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--") && !argv[i + 1]?.startsWith("--")) {
    args[argv[i].slice(2)] = argv[i + 1];
    i++;
  } else if (argv[i].startsWith("--")) {
    args[argv[i].slice(2)] = true;
  }
}

const hours = parseInt(args.hours ?? "24", 10);
const limit = parseInt(args.limit ?? "30", 10);
const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) {
    console.error(`REST ${path} -> ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  return res.json();
}

async function main() {
  // Build the vods query. PostgREST embeds profiles via FK on user_id.
  // Filters get appended based on whether --user or --vod is passed.
  let query =
    `vods?select=id,title,duration_seconds,analyzed_at,status,user_id,coach_report,profiles:user_id(twitch_display_name,plan,founding_member)` +
    `&status=eq.ready` +
    `&order=analyzed_at.desc` +
    `&limit=${limit}`;

  if (args.user) {
    query += `&user_id=eq.${args.user}`;
  } else if (args.vod) {
    query += `&id=eq.${args.vod}`;
  } else {
    query += `&analyzed_at=gte.${sinceIso}`;
  }

  const vods = await rest(query);

  if (vods.length === 0) {
    console.log("No matching analyses.");
    return;
  }

  // Format as fixed-width columns for readability.
  const rows = vods.map((v) => {
    const minutes = v.duration_seconds ? (v.duration_seconds / 60).toFixed(1) : "?";
    const score = v.coach_report?.overall_score ?? "?";
    const when = v.analyzed_at ? v.analyzed_at.replace("T", " ").slice(0, 16) + " UTC" : "unknown";
    const who = v.profiles?.twitch_display_name ?? "(unknown)";
    const plan = v.profiles
      ? v.profiles.founding_member
        ? `${v.profiles.plan}+f`
        : v.profiles.plan
      : "?";
    const title = (v.title || "").slice(0, 50);
    return { when, who, plan, vod_id: v.id, minutes, score, title };
  });

  const widths = {
    when: Math.max(20, ...rows.map((r) => r.when.length)),
    who: Math.max(15, ...rows.map((r) => r.who.length)),
    plan: Math.max(6, ...rows.map((r) => r.plan.length)),
    vod_id: 36,
    minutes: Math.max(7, ...rows.map((r) => r.minutes.length)),
    score: Math.max(5, ...rows.map((r) => String(r.score).length)),
  };

  const pad = (s, w, align = "left") => {
    s = String(s);
    if (s.length >= w) return s.slice(0, w);
    return align === "right" ? s.padStart(w) : s.padEnd(w);
  };

  console.log(
    [
      pad("when", widths.when),
      pad("who", widths.who),
      pad("plan", widths.plan),
      pad("vod_id", widths.vod_id),
      pad("min", widths.minutes, "right"),
      pad("score", widths.score, "right"),
      "title",
    ].join("  ")
  );
  console.log("-".repeat(120));
  for (const r of rows) {
    console.log(
      [
        pad(r.when, widths.when),
        pad(r.who, widths.who),
        pad(r.plan, widths.plan),
        pad(r.vod_id, widths.vod_id),
        pad(r.minutes, widths.minutes, "right"),
        pad(r.score, widths.score, "right"),
        r.title,
      ].join("  ")
    );
  }
  console.log(`\n${rows.length} analyses${args.user ? ` for user ${args.user}` : args.vod ? ` matching vod ${args.vod}` : ` in the last ${hours}h`}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
