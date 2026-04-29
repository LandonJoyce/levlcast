import webpush from "web-push";

let _initialized = false;

function init() {
  if (_initialized) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return; // silently skip at build time
  webpush.setVapidDetails("mailto:support@levlcast.com", pub, priv);
  _initialized = true;
}

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  init();
  await webpush.sendNotification(subscription as webpush.PushSubscription, JSON.stringify(payload));
}
