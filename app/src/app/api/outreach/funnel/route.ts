/**
 * GET /api/outreach/funnel?days=30
 *
 * Where people drop between an outreach DM and an account, for the
 * outreach page. Counts unique visitors at each step (see lib/funnel.ts),
 * split into people who came from a DM and everyone else, the most common
 * reasons a pasted link was refused, and the DM'd people who clicked,
 * with how far each got, so a reply can be followed up in context.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server";
import { DM_CODES_SINCE, dmRef } from "@/lib/funnel";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === ADMIN_EMAIL;
}

/** The steps, in order. Each visitor counts once at every step they reached. */
const STEPS = ["land", "preview_start", "preview_ready", "cta", "signin_start", "signup"] as const;
type Step = (typeof STEPS)[number];

type Row = { visitor: string; ref: string | null; event: string; detail: string | null; created_at: string };

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const admin = createAdminClient();

  const { data: events, error } = await admin
    .from("funnel_events")
    .select("visitor, ref, event, detail, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(20000);
  if (error) {
    const missing = /funnel_events/.test(error.message) || error.code === "42P01" || error.code === "PGRST205";
    return NextResponse.json({ needsMigration: missing, error: missing ? null : error.message }, { status: missing ? 200 : 500 });
  }

  // Only DMs whose link carried a code: the ones a click can be matched to.
  const dmsSince = since > DM_CODES_SINCE ? since : DM_CODES_SINCE;
  const { count: dmsSent } = await admin
    .from("outreach_contacts")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", dmsSince);

  // Codes back to Reddit accounts, for everyone ever messaged: a click can
  // come days after the DM.
  const { data: contacts } = await admin
    .from("outreach_contacts")
    .select("reddit_username, sent_at")
    .eq("status", "sent")
    .limit(5000);
  const whoByCode = new Map<string, { username: string; sentAt: string | null }>();
  for (const c of (contacts ?? []) as Array<{ reddit_username: string; sent_at: string | null }>) {
    if (c.reddit_username) whoByCode.set(dmRef(c.reddit_username), { username: c.reddit_username, sentAt: c.sent_at });
  }

  // One entry per visitor: where they came from and every step they reached.
  interface Visitor {
    ref: string | null;
    steps: Set<string>;
    previews: Set<string>;
    first: string;
    last: string;
  }
  const visitors = new Map<string, Visitor>();
  const refused = new Map<string, number>();
  let failed = 0;
  for (const e of (events ?? []) as Row[]) {
    let v = visitors.get(e.visitor);
    if (!v) {
      v = { ref: null, steps: new Set(), previews: new Set(), first: e.created_at, last: e.created_at };
      visitors.set(e.visitor, v);
    }
    if (!v.ref && e.ref) v.ref = e.ref;
    v.steps.add(e.event);
    v.last = e.created_at;
    if (e.event === "preview_start" && e.detail) v.previews.add(e.detail);
    if (e.event === "preview_refused") {
      // Group by the first sentence, which is the part that says what was wrong.
      const reason = (e.detail ?? "Unknown").split(/(?<=\.)\s/)[0].slice(0, 120);
      refused.set(reason, (refused.get(reason) ?? 0) + 1);
    }
    if (e.event === "preview_failed") failed++;
  }

  const blank = (): Record<Step, number> => ({ land: 0, preview_start: 0, preview_ready: 0, cta: 0, signin_start: 0, signup: 0 });
  const dm = blank();
  // People who came from a review-thread reply (links tagged ?ref=thread).
  const thread = blank();
  const other = blank();
  const people: Array<{ username: string | null; code: string; furthest: Step; previews: number; lastSeen: string; sentAt: string | null }> = [];

  for (const v of visitors.values()) {
    const fromDm = !!v.ref && v.ref.startsWith("dm-");
    const bucket = fromDm ? dm : v.ref === "thread" ? thread : other;
    let furthest: Step = "land";
    for (const s of STEPS) {
      if (v.steps.has(s)) {
        bucket[s]++;
        furthest = s;
      }
    }
    if (fromDm && v.ref) {
      const who = whoByCode.get(v.ref);
      people.push({
        username: who?.username ?? null,
        code: v.ref,
        furthest,
        previews: v.previews.size,
        lastSeen: v.last,
        sentAt: who?.sentAt ?? null,
      });
    }
  }
  people.sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));

  // Everyone who made an account in the window, newest first, with how
  // they got here where the funnel saw it. Worth a personal hello each.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, twitch_login, twitch_display_name, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);
  const signupBy = new Map<string, Row>();
  for (const e of (events ?? []) as Row[]) if (e.event === "signup" && e.detail) signupBy.set(e.detail, e);
  const newAccounts = ((profiles ?? []) as Array<{ id: string; twitch_login: string | null; twitch_display_name: string | null; created_at: string }>).map(
    (p) => {
      const s = signupBy.get(p.id);
      const v = s ? visitors.get(s.visitor) : undefined;
      const ref = s?.ref ?? v?.ref ?? null;
      // No signup event: either the account is older than tracking, or the
      // sign-in never came back to a browser we saw (the iPhone app, or
      // Twitch finishing it on another device).
      let source: "dm" | "thread" | "preview" | "direct" | "untracked" | "unknown" = p.created_at >= DM_CODES_SINCE ? "untracked" : "unknown";
      if (s) {
        source = ref?.startsWith("dm-") ? "dm" : ref === "thread" ? "thread" : v?.steps.has("preview_start") ? "preview" : "direct";
      }
      return {
        login: p.twitch_login,
        name: p.twitch_display_name || p.twitch_login,
        at: p.created_at,
        source,
        dmUsername: ref?.startsWith("dm-") ? whoByCode.get(ref)?.username ?? null : null,
      };
    }
  );

  return NextResponse.json({
    since,
    days,
    dmsSince,
    dmsSent: dmsSent ?? 0,
    dm,
    thread,
    other,
    refused: [...refused.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, count]) => ({ reason, count })),
    failed,
    people: people.slice(0, 60),
    newAccounts,
  });
}
