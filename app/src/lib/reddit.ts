/**
 * lib/reddit.ts — Reddit app-only OAuth for the outreach lead finder.
 *
 * Reddit blocks ALL unauthenticated API access now (public .json endpoints
 * return 403), and the free Arctic Shift mirror we used to fall back to is
 * unreliable (500s). The durable fix is Reddit's own OAuth: register an app
 * once, authenticate app-only, and read subreddit feeds from oauth.reddit.com
 * in real time (no more ~2-week mirror lag).
 *
 * SETUP (one time):
 *   1. Go to https://www.reddit.com/prefs/apps  → "create another app"
 *   2. Type: "script".  Name: levlcast-outreach.  redirect uri: http://localhost
 *   3. Copy the client id (under the app name) and the secret.
 *   4. Add to env:
 *        REDDIT_CLIENT_ID=...
 *        REDDIT_CLIENT_SECRET=...
 *      Optional (more reliable read access, needed if client_credentials is
 *      rate-limited): REDDIT_USERNAME + REDDIT_PASSWORD for password grant.
 *
 * Edge-runtime safe: uses only fetch, btoa, URLSearchParams.
 */

export const REDDIT_UA = "web:levlcast-outreach:1.1 (by /u/BMWDouche)";

// Module-scoped token cache. On edge this lives for the instance lifetime,
// which is enough to avoid re-authing on every request in a burst.
let cachedToken: { token: string; expiresAt: number } | null = null;

export function isRedditConfigured(): boolean {
  return !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

/** Get an app-only (or password-grant) OAuth token, cached until expiry. */
export async function getRedditToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Reddit API not configured. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET (see lib/reddit.ts for setup)."
    );
  }

  const basic = btoa(`${id}:${secret}`);
  // Password grant (needs a script app + your reddit login) is the most
  // reliable for reading. Falls back to app-only client_credentials when
  // username/password aren't set.
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;
  const body =
    username && password
      ? new URLSearchParams({ grant_type: "password", username, password })
      : new URLSearchParams({ grant_type: "client_credentials" });

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": REDDIT_UA,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Reddit auth failed (${res.status}): ${text.slice(0, 140)}`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error("Reddit auth returned no access_token");
  }
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.token;
}

/**
 * GET a Reddit API path (e.g. "/r/TwitchStreamers/new?limit=100") against
 * oauth.reddit.com with the app token. Returns the parsed JSON body.
 */
export async function redditGet(path: string): Promise<any> {
  const token = await getRedditToken();
  const res = await fetch(`https://oauth.reddit.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": REDDIT_UA,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Reddit API ${res.status}: ${text.slice(0, 140)}`);
  }
  return res.json();
}

/**
 * The streamer subreddits we actively work. Reddit supports combined
 * multireddit paths (/r/a+b+c/new), so we pull all of them in one request.
 */
export const OUTREACH_SUBS = [
  "TwitchStreamers",
  "twitchstreaming",
  "Twitch_Startup",
  "SmallStreamers",
  "twitchfollowers",
  "Twitch",
  "streaming",
  "ContentCreators",
  "NewTubers",
  "PartneredYoutube",
];
