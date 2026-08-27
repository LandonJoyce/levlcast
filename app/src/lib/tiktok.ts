const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_REDIRECT_URI = "https://www.levlcast.com/api/auth/tiktok/callback";

export function getTikTokAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    redirect_uri: TIKTOK_REDIRECT_URI,
    response_type: "code",
    scope: "user.info.basic,video.upload,video.publish",
    state,
  });
  return `${TIKTOK_AUTH_URL}?${params}`;
}

export async function exchangeTikTokCode(code: string) {
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: TIKTOK_REDIRECT_URI,
    }),
  });
  return res.json();
}

export async function refreshTikTokToken(refreshToken: string) {
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  return res.json();
}

export async function uploadToTikTok({
  accessToken,
  videoUrl,
  title,
}: {
  accessToken: string;
  videoUrl: string;
  title: string;
}) {
  // Validate videoUrl is from our R2 bucket before passing to TikTok
  const r2Base = process.env.R2_PUBLIC_URL;
  const r2Legacy = "https://pub-2c0927d30b4c41609b6a1076e4d7de01.r2.dev";
  if (!r2Base || (!videoUrl.startsWith(r2Base) && !videoUrl.startsWith(r2Legacy))) {
    throw new Error("Invalid video URL — must be an R2 asset");
  }
  // Rewrite legacy r2.dev URLs to the verified custom domain so TikTok accepts them
  const normalizedUrl = videoUrl.startsWith(r2Legacy)
    ? videoUrl.replace(r2Legacy, r2Base)
    : videoUrl;

  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: title.slice(0, 150),
        privacy_level: process.env.TIKTOK_PUBLIC === "true" ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: normalizedUrl,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TikTok upload failed: ${err}`);
  }

  const data = await res.json();
  if (data.error?.code && data.error.code !== "ok") {
    throw new Error(`TikTok error: ${data.error.message}`);
  }

  return { publishId: data.data?.publish_id as string };
}
