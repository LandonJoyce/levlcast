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
  // No OAuth app configured? Read anyway.
  //
  // Reddit serves every public listing as JSON with no credentials at all
  // — /r/name/new.json is open to anyone sending a real User-Agent. OAuth
  // is only genuinely required for WRITING (sending messages). Falling
  // back here means lead discovery, filtering and drafting all keep
  // working on an account that cannot create an API app, which is a real
  // situation and used to take the whole feature down with it.
  //
  // The tradeoff is a lower rate limit and no access to anything private,
  // neither of which matters for pulling ten public subreddits every few
  // hours.
  if (!isRedditConfigured()) {
    return redditGetPublic(path);
  }

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
 * Credential-free read of a public Reddit listing.
 *
 * Takes the same path shape as redditGet ("/r/a+b/new?limit=100") and
 * rewrites it for the public host, which needs ".json" on the path segment
 * rather than the OAuth host's bare path.
 *
 * The User-Agent is not optional. Reddit blocks default agents outright,
 * which is the usual reason this approach is reported as "not working".
 */
export async function redditGetPublic(path: string): Promise<any> {
  const [rawPath, query] = path.split("?");
  const jsonPath = rawPath.endsWith(".json") ? rawPath : `${rawPath}.json`;
  const suffix = `${jsonPath}${query ? `?${query}` : ""}`;

  // Reddit refuses credential-free reads from datacenter IP ranges, which
  // is every request made from Vercel. The block is not uniform across
  // their hosts: old.reddit.com is served by older infrastructure and is
  // routinely reachable when www returns a 403 HTML page. Try the hosts
  // most-permissive first and keep the last error if they all refuse.
  const hosts = [
    "https://old.reddit.com",
    "https://www.reddit.com",
  ];

  let lastError = "";
  for (const host of hosts) {
    try {
      const res = await fetch(`${host}${suffix}`, {
        headers: {
          "User-Agent": REDDIT_UA,
          Accept: "application/json",
        },
      });

      if (res.ok) {
        // A 200 carrying HTML is Reddit's block page, not data. Parsing it
        // as JSON throws an unhelpful syntax error, so check first.
        const body = await res.text();
        if (body.trimStart().startsWith("<")) {
          lastError = `${host} returned an HTML block page`;
          continue;
        }
        return JSON.parse(body);
      }

      lastError = `${host} ${res.status}`;
    } catch (err) {
      lastError = `${host} ${err instanceof Error ? err.message : "failed"}`;
    }
  }

  throw new Error(
    `Reddit refused credential-free access (${lastError}). Reddit blocks datacenter IPs without an OAuth app, so this needs REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to work from the server.`
  );
}

/**
 * The streamer subreddits we actively work. Reddit supports combined
 * multireddit paths (/r/a+b+c/new), so we pull all of them in one request.
 */
/**
 * Send a Reddit private message.
 *
 * Needs a user-context token, so REDDIT_USERNAME and REDDIT_PASSWORD must
 * be set: an app-only client_credentials token cannot send. Throws with
 * Reddit's own error text so a caller can record exactly why a send failed
 * instead of retrying blindly into a rate limit.
 */
export async function redditSendMessage(
  to: string,
  subject: string,
  text: string
): Promise<void> {
  if (!process.env.REDDIT_USERNAME || !process.env.REDDIT_PASSWORD) {
    throw new Error(
      "Reddit sending needs REDDIT_USERNAME and REDDIT_PASSWORD (app-only tokens cannot send messages)."
    );
  }

  const token = await getRedditToken();
  const res = await fetch("https://oauth.reddit.com/api/compose", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": REDDIT_UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      api_type: "json",
      to,
      subject: subject.slice(0, 100),
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Reddit compose ${res.status}: ${body.slice(0, 200)}`);
  }

  // Reddit answers 200 with errors nested in the body, so the status code
  // alone does not tell you the message actually went out.
  const json = await res.json().catch(() => null);
  const errors = json?.json?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(`Reddit compose rejected: ${JSON.stringify(errors).slice(0, 200)}`);
  }
}

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
