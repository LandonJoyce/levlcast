import { ImageResponse } from "next/og";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { buildRecap, defaultRecapMonth, MONTH_PATTERN } from "@/lib/recap";
import { OG, ogFonts, emblemSrc } from "@/lib/og";
import { TIER_HEX } from "@/lib/rank";

/**
 * The recap as a picture to post: 1080x1350, the size X, Discord and
 * stories all show without cropping. Downloaded from the recap page.
 */
export const runtime = "nodejs";

const SIZE = { width: 1080, height: 1350 };

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in first", { status: 401 });

  const asked = new URL(request.url).searchParams.get("month") ?? "";
  const month = MONTH_PATTERN.test(asked) ? asked : defaultRecapMonth();
  const [r, { data: profile }, fonts] = await Promise.all([
    buildRecap(supabase, createAdminClient(), user.id, month),
    supabase.from("profiles").select("twitch_display_name, twitch_avatar_url").eq("id", user.id).single(),
    ogFonts(),
  ]);
  const name = (profile?.twitch_display_name as string | null) || "Streamer";
  const avatarUrl = profile?.twitch_avatar_url as string | null;
  const avatar = avatarUrl && /^https:\/\/static-cdn\.jtvnw\.net\//.test(avatarUrl) ? avatarUrl : null;
  const [fromSrc, toSrc] = await Promise.all([
    r.rankStart && r.rankEnd && r.rankStart.label !== r.rankEnd.label ? emblemSrc(r.rankStart.tier) : Promise.resolve(null),
    r.rankEnd ? emblemSrc(r.rankEnd.tier) : Promise.resolve(null),
  ]);

  const stat = (value: string, label: string, color: string = OG.fg) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ display: "flex", fontFamily: "Numbers", fontSize: 104, lineHeight: 0.9, color }}>{value}</div>
      <div style={{ display: "flex", fontFamily: "Body", fontSize: 28, color: OG.faint, marginTop: 12 }}>{label}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: OG.bg, padding: "72px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontFamily: "Display", fontSize: 40, color: OG.fg, letterSpacing: -0.8 }}>LevlCast</div>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 26, color: OG.faint }}>levlcast.com</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 84 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} width={60} height={60} style={{ borderRadius: 30 }} alt="" />
          ) : null}
          <div style={{ display: "flex", fontFamily: "Body", fontSize: 34, color: OG.mute }}>{name}</div>
        </div>
        <div style={{ display: "flex", fontFamily: "Display", fontSize: 132, lineHeight: 1, letterSpacing: -4, color: OG.fg, marginTop: 14 }}>
          {r.current ? `${r.name} so far` : r.name}
        </div>

        {r.rankEnd ? (
          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 64 }}>
            {fromSrc && r.rankStart ? (
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fromSrc} width={120} height={120} alt="" />
                <div style={{ display: "flex", fontFamily: "Numbers", fontSize: 56, color: TIER_HEX[r.rankStart.tier], textTransform: "uppercase" }}>
                  {r.rankStart.label}
                </div>
                <div style={{ display: "flex", fontFamily: "Body", fontSize: 56, color: OG.faint, marginLeft: 8, marginRight: 8 }}>→</div>
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {toSrc ? <img src={toSrc} width={150} height={150} alt="" /> : null}
              <div style={{ display: "flex", fontFamily: "Numbers", fontSize: 76, color: TIER_HEX[r.rankEnd.tier], textTransform: "uppercase" }}>
                {r.rankEnd.label}
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 28, marginTop: 72, paddingTop: 40, borderTop: `2px solid ${OG.line}` }}>
          {stat(String(r.streams), r.streams === 1 ? "stream" : "streams")}
          {stat(String(r.hours), "hours")}
          {stat(`${r.wins}-${r.losses}`, "wins-losses")}
          {r.points !== null ? stat(`${r.points > 0 ? "+" : ""}${r.points}`, "rank points", r.points > 0 ? OG.good : r.points < 0 ? "#F87171" : OG.fg) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 56 }}>
          {r.fixes.checked > 0 ? (
            <div style={{ display: "flex", fontFamily: "Body", fontSize: 36, color: OG.mute }}>
              {r.fixes.done > 0
                ? `Worked on ${r.fixes.checked} fixes from my coach and nailed ${r.fixes.done}`
                : `Worked on ${r.fixes.checked} fixes from my coach`}
            </div>
          ) : null}
          {r.best ? (
            <div style={{ display: "flex", fontFamily: "Body", fontSize: 36, color: OG.mute }}>
              {`Best stream: +${r.best.delta}, ${r.best.title.length > 34 ? `${r.best.title.slice(0, 32)}...` : r.best.title}`}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", fontFamily: "Body", fontSize: 30, color: OG.faint }}>Coached on LevlCast. Get a free report at levlcast.com</div>
      </div>
    ),
    {
      ...SIZE,
      fonts,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
