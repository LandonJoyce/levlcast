import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/collab/profile
 * Updates the caller's collab settings: Discord handle, opt-in flag,
 * preferred collab types. Enforces ALL gates server-side regardless of
 * what the client sends:
 *   1. Authenticated user only
 *   2. To opt IN: must have ≥1 ready VOD with a coach_report set
 *   3. To opt IN: must have a Discord handle (provided here or already set)
 *   4. Discord handle must match the format the DB CHECK constraint enforces
 */

const DISCORD_RE = /^[a-z0-9._]{2,32}$/;
const COLLAB_TYPES = new Set(["co_stream", "variety_swap", "podcast"]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as {
    discord_handle?: string | null;
    collab_opt_in?: boolean;
    collab_types?: string[];
  };

  // Normalize + validate Discord handle.
  let normalizedHandle: string | null = null;
  if (typeof b.discord_handle === "string") {
    const trimmed = b.discord_handle.trim().toLowerCase();
    if (trimmed.length === 0) {
      normalizedHandle = null;
    } else if (!DISCORD_RE.test(trimmed)) {
      return NextResponse.json(
        { error: "Invalid Discord username. Use 2-32 characters: letters, digits, dots, underscores." },
        { status: 400 }
      );
    } else {
      normalizedHandle = trimmed;
    }
  } else if (b.discord_handle === null) {
    normalizedHandle = null;
  }

  // Validate collab types — accept only known IDs, dedupe, cap at 3.
  const types: string[] = Array.isArray(b.collab_types)
    ? Array.from(new Set(b.collab_types.filter((t): t is string => typeof t === "string" && COLLAB_TYPES.has(t)))).slice(0, 3)
    : [];

  const wantsOptIn = b.collab_opt_in === true;

  // Pull current profile state — we need handle (in case caller didn't pass one)
  // and the current opt-in state for the auto-opt-out-on-handle-clear case.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, discord_handle, collab_opt_in")
    .eq("id", user.id)
    .single();

  // Effective handle = the one we'll save. If caller passed discord_handle, use
  // their value (already validated above). If they didn't pass it, keep the
  // existing one. If they explicitly passed null, clear it.
  const effectiveHandle =
    b.discord_handle === undefined ? (profile?.discord_handle as string | null | undefined) ?? null : normalizedHandle;

  // Safety net: clearing the Discord handle while opted in is a foot-gun
  // (accepted collabs wouldn't be able to reach you). Force opt-out in that
  // case so the UI state stays consistent with what's actually reachable.
  const isClearingHandle = b.discord_handle === null || (typeof b.discord_handle === "string" && b.discord_handle.trim().length === 0);
  const wasOptedIn = profile?.collab_opt_in === true;
  const forceOptOut = isClearingHandle && wasOptedIn && b.collab_opt_in !== false;

  if (wantsOptIn) {
    if (!effectiveHandle) {
      return NextResponse.json(
        { error: "Add your Discord handle so accepted collabs can actually reach you." },
        { status: 400 }
      );
    }
    // Re-check the coach-report gate server-side.
    const { count: readyVodCount } = await supabase
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "ready")
      .not("coach_report", "is", null);
    if (!readyVodCount || readyVodCount < 1) {
      return NextResponse.json(
        { error: "You need at least one analyzed VOD with a coach report before you can opt in." },
        { status: 400 }
      );
    }
  }

  // Build the patch — only set fields actually provided so a partial save
  // (toggle only) doesn't accidentally wipe preferences.
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (b.discord_handle !== undefined) {
    patch.discord_handle = normalizedHandle;
  }
  if (typeof b.collab_opt_in === "boolean") {
    patch.collab_opt_in = b.collab_opt_in;
    patch.collab_opt_in_at = b.collab_opt_in ? new Date().toISOString() : null;
  } else if (forceOptOut) {
    patch.collab_opt_in = false;
    patch.collab_opt_in_at = null;
  }
  if (Array.isArray(b.collab_types)) {
    patch.collab_preferences = { collab_types: types };
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
