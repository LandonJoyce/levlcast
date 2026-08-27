/**
 * lib/push.ts — Expo push notification sender.
 *
 * Uses the Expo Push API (free, no API key needed) to send push notifications
 * to the LevlCast mobile app. Tokens are stored in profiles.expo_push_token.
 */

export interface PushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Send a push notification via the Expo Push API.
 * Silently no-ops if the token is null/undefined.
 */
export async function sendPush(token: string | null | undefined, payload: Omit<PushPayload, "to">) {
  if (!token) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ to: token, ...payload }),
    });
  } catch (err) {
    // Non-fatal — push delivery failure should never break the main flow
    console.error("[push] Failed to send notification:", err);
  }
}
