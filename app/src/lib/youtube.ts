/**
 * YouTube Data API v3 helpers
 */

const YOUTUBE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const YOUTUBE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_REDIRECT_URI = "https://www.levlcast.com/api/auth/youtube/callback";

export function getYouTubeAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID!,
    redirect_uri: YOUTUBE_REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${YOUTUBE_AUTH_URL}?${params}`;
}

export async function exchangeYouTubeCode(code: string) {
  const res = await fetch(YOUTUBE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      redirect_uri: YOUTUBE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}

export async function refreshYouTubeToken(refreshToken: string) {
  const res = await fetch(YOUTUBE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  return res.json();
}

export async function uploadToYouTube({
  accessToken,
  videoUrl,
  title,
  description,
}: {
  accessToken: string;
  videoUrl: string;
  title: string;
  description: string;
}) {
  // Fetch the video file
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error("Failed to fetch video file");
  const videoBuffer = await videoRes.arrayBuffer();

  // Step 1: Initialize resumable upload
  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(videoBuffer.byteLength),
      },
      body: JSON.stringify({
        snippet: {
          title: title.slice(0, 100),
          description,
          categoryId: "20", // Gaming
        },
        status: {
          privacyStatus: "public",
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`YouTube init failed: ${err}`);
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("No upload URL from YouTube");

  // Step 2: Upload the video
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoBuffer.byteLength),
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`YouTube upload failed: ${err}`);
  }

  const data = await uploadRes.json();
  return { videoId: data.id, url: `https://youtube.com/watch?v=${data.id}` };
}
