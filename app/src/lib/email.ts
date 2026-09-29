import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/*
 * Every email LevlCast sends, in one look: the site's (warm near-black, flat
 * white button, no gradients), with a plain-text copy alongside. They used
 * to be three generations of design, most of them the old purple one, one
 * with a gradient button, and several put names and stream titles into the
 * HTML unescaped.
 */

const SITE = "https://levlcast.com";
const FROM_LEVLCAST = "LevlCast <hello@levlcast.com>";
const FROM_LANDON = "Landon @ LevlCast <hello@levlcast.com>";
/** Replies to anything signed by Landon land here, and reach him. */
const REPLY_TO = "support@levlcast.com";

const C = {
  bg: "#100d0e",
  ink: "#fffaf7",
  body: "#e4dad7",
  muted: "#a69897",
  faint: "#928688",
  line: "rgba(255,238,230,0.12)",
  box: "rgba(255,238,230,0.05)",
};
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Block =
  /** A paragraph of plain text. */
  | { p: string }
  /** A boxed line: a stream title, a clip, a Discord handle, a quoted message. */
  | { quote: string; label?: string; mono?: boolean }
  /** Short labelled lines, like what a plan includes. */
  | { list: Array<{ title: string; note?: string }> }
  | { button: string; href: string }
  /** A quieter line under the main text. */
  | { small: string };

interface EmailSpec {
  /** The inbox preview line. */
  preheader: string;
  /** The small line above the heading ("Hey Landon"). */
  eyebrow?: string;
  heading?: string;
  blocks: Block[];
  /** Ends on Landon's name, for the ones he writes. */
  signed?: boolean;
  footer?: { label: string; href: string };
}

function renderEmail(spec: EmailSpec): { html: string; text: string } {
  const footer = spec.footer ?? { label: "Your account", href: `${SITE}/dashboard/settings` };
  const parts: string[] = [];
  const text: string[] = [];

  if (spec.eyebrow) {
    parts.push(
      `<p style="margin:0 0 10px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};font-family:${MONO};">${escapeHtml(spec.eyebrow)}</p>`
    );
  }
  if (spec.heading) {
    parts.push(
      `<h1 style="margin:0 0 14px;font-size:28px;font-weight:800;color:${C.ink};line-height:1.15;">${escapeHtml(spec.heading)}</h1>`
    );
    text.push(spec.heading, "");
  }
  for (const b of spec.blocks) {
    if ("p" in b) {
      parts.push(
        `<p style="margin:0 0 16px;font-size:15px;color:${C.body};line-height:1.6;">${escapeHtml(b.p).replace(/\n/g, "<br>")}</p>`
      );
      text.push(b.p, "");
    } else if ("quote" in b) {
      parts.push(
        `<div style="margin:4px 0 22px;padding:14px 16px;border:1px solid ${C.line};border-radius:10px;background:${C.box};">` +
          (b.label
            ? `<p style="margin:0 0 6px;font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};font-family:${MONO};">${escapeHtml(b.label)}</p>`
            : "") +
          `<p style="margin:0;font-size:${b.mono ? 17 : 15}px;color:${C.ink};line-height:1.5;${b.mono ? `font-family:${MONO};font-weight:600;` : ""}">${escapeHtml(b.quote).replace(/\n/g, "<br>")}</p>` +
          `</div>`
      );
      text.push(b.label ? `${b.label}: ${b.quote}` : `> ${b.quote}`, "");
    } else if ("list" in b) {
      parts.push(
        `<table width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;border-top:1px solid ${C.line};">` +
          b.list
            .map(
              (item) =>
                `<tr><td style="padding:11px 0;border-bottom:1px solid ${C.line};">` +
                `<p style="margin:0;font-size:14px;font-weight:700;color:${C.ink};">${escapeHtml(item.title)}</p>` +
                (item.note ? `<p style="margin:3px 0 0;font-size:13px;color:${C.muted};line-height:1.5;">${escapeHtml(item.note)}</p>` : "") +
                `</td></tr>`
            )
            .join("") +
          `</table>`
      );
      for (const item of b.list) text.push(`- ${item.title}${item.note ? `: ${item.note}` : ""}`);
      text.push("");
    } else if ("button" in b) {
      parts.push(
        `<table cellpadding="0" cellspacing="0" style="margin:6px 0 24px;"><tr><td style="background:${C.ink};border-radius:9px;">` +
          `<a href="${escapeHtml(b.href)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:${C.bg};text-decoration:none;">${escapeHtml(b.button)}</a>` +
          `</td></tr></table>`
      );
      text.push(`${b.button}: ${b.href}`, "");
    } else {
      parts.push(`<p style="margin:0 0 14px;font-size:13px;color:${C.muted};line-height:1.6;">${escapeHtml(b.small)}</p>`);
      text.push(b.small, "");
    }
  }
  if (spec.signed) {
    parts.push(`<p style="margin:8px 0 0;font-size:15px;font-weight:700;color:${C.ink};">Landon</p>`);
    text.push("Landon", "");
  }
  text.push(`${footer.label}: ${footer.href}`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(spec.heading ?? spec.preheader)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${SANS};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(spec.preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding-bottom:28px;">
          <span style="font-size:18px;font-weight:800;color:${C.ink};letter-spacing:-0.5px;">LevlCast</span>
        </td></tr>
        <tr><td style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};padding:34px 0 20px;">
          ${parts.join("\n          ")}
        </td></tr>
        <tr><td style="padding-top:22px;">
          <p style="margin:0;font-size:11px;color:${C.faint};">LevlCast · <a href="${escapeHtml(footer.href)}" style="color:${C.faint};text-decoration:underline;">${escapeHtml(footer.label)}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { html, text: text.join("\n").trim() + "\n" };
}

/**
 * Sent when the auto-sync cron finds new streams for someone who already
 * has a report. (Someone without one yet doesn't get this: their first
 * report starts by itself, see rescueUnactivatedSignups.)
 */
export async function sendNewVodEmail(
  to: string,
  name: string,
  vodTitle: string,
  vodCount: number,
  hasPriorAnalyses: boolean
): Promise<void> {
  const subject = vodCount === 1 ? "Your latest stream is ready to analyze" : `${vodCount} new streams ready to analyze`;
  const { html, text } = renderEmail({
    preheader: hasPriorAnalyses ? "See how it went next to your last one." : "Get your first report and your placement.",
    eyebrow: `Hey ${name}`,
    heading: vodCount === 1 ? "Your new stream is in." : "Your new streams are in.",
    blocks: [
      {
        p: hasPriorAnalyses
          ? "Analyze it to see how it went next to your last one, and whether you did your fix."
          : "Analyze it to get your first report and your placement on the ladder.",
      },
      { quote: vodTitle, label: vodCount === 1 ? "New stream" : `Newest of ${vodCount}` },
      { button: "Analyze it", href: `${SITE}/dashboard/vods` },
    ],
  });
  await resend.emails.send({ from: FROM_LEVLCAST, to, subject, html, text });
}

/**
 * The report-ready email. Results arrive sealed, so this never says how
 * the stream went: it's the "your result is in" tap on the shoulder, and
 * the reveal happens on the site.
 */
export type VodReadyKind = "result" | "placement" | "locked";

const READY_COPY: Record<VodReadyKind, { subject: string; heading: string; body: (title: string) => string; button: string }> = {
  result: {
    subject: "Your result is in: win or loss?",
    heading: "Your result is in.",
    body: (title) => `Your report on ${title} is sealed until you open it. Call it first: did that stream win or lose?`,
    button: "Open my result",
  },
  placement: {
    subject: "Your placement is in",
    heading: "Your placement is in.",
    body: () => "Your first report puts you on the ladder. Open it to see where you landed.",
    button: "Reveal my rank",
  },
  locked: {
    subject: "Your extra stream is analyzed",
    heading: "Your extra stream is in.",
    body: () => "You've used this week's free report, so this one stays sealed until Monday. Pro opens it now.",
    button: "See it",
  },
};

export async function sendVodReadyEmail(
  to: string,
  name: string,
  vodId: string,
  title: string,
  kind: VodReadyKind = "result"
): Promise<void> {
  const copy = READY_COPY[kind];
  // The first report is the one moment a note from a real person matters
  // most, so it comes from Landon and a reply reaches him.
  const first = kind === "placement";
  const { html, text } = renderEmail({
    preheader: copy.body(title),
    eyebrow: `Hey ${name}`,
    heading: copy.heading,
    blocks: [
      { p: copy.body(title) },
      { button: copy.button, href: `${SITE}/dashboard/vods/${vodId}` },
      { small: title },
      ...(first
        ? [{ p: "I'm Landon, I built LevlCast. If your report gets something wrong about your stream, reply and tell me. I read every one." }]
        : []),
    ],
    signed: first,
  });
  await resend.emails.send({
    from: first ? FROM_LANDON : FROM_LEVLCAST,
    ...(first ? { replyTo: REPLY_TO } : {}),
    to,
    subject: copy.subject,
    html,
    text,
  });
}

/**
 * Sent at sign-up, once we know whether the first report started. It used
 * to go out before that, telling everyone to "sync your streams and run
 * your first analysis", which LevlCast had already done for most of them.
 */
export type FirstReport =
  /** Running on their latest stream. */
  | "started"
  /** They have saved streams but none started (usually all under 10 minutes). */
  | "pick"
  /** Twitch has no saved streams for them. */
  | "no_streams";

const WELCOME: Record<FirstReport, { subject: string; preheader: string; lines: string[] }> = {
  started: {
    subject: "Your first report is on the way",
    preheader: "Your first report is already running. About ten minutes.",
    lines: [
      "Your first report is already running on your latest stream. It takes about ten minutes and you don't have to do anything. It'll be on your LevlCast home when it's done.",
    ],
  },
  pick: {
    subject: "Welcome to LevlCast",
    preheader: "Pick a stream and your first report takes about ten minutes.",
    lines: ["Your first report didn't start on its own. Open LevlCast and pick a stream, it takes about ten minutes."],
  },
  no_streams: {
    subject: "Welcome to LevlCast",
    preheader: "Turn on saved broadcasts and your first report starts by itself.",
    lines: [
      "We couldn't find a saved stream on your Twitch yet, so your first report hasn't started. Twitch only saves streams when Store past broadcasts is on. It's in your Creator Dashboard, under Settings, then Stream.",
      "Once it's on, stream like normal and your first report starts by itself after that.",
    ],
  },
};

export async function sendWelcomeEmail(to: string, name: string, firstReport: FirstReport = "started"): Promise<void> {
  const copy = WELCOME[firstReport];
  const { html, text } = renderEmail({
    preheader: copy.preheader,
    blocks: [
      { p: `Hey ${name},` },
      { p: "Thanks for signing up. I'm Landon, I built LevlCast." },
      ...copy.lines.map((p) => ({ p })),
      { button: "Open LevlCast", href: `${SITE}/dashboard` },
      { p: "If anything looks off, reply to this email. It comes straight to me." },
    ],
    signed: true,
  });
  await resend.emails.send({ from: FROM_LANDON, to, replyTo: REPLY_TO, subject: copy.subject, html, text });
}

export async function sendProWelcomeEmail(to: string, name: string): Promise<void> {
  const { html, text } = renderEmail({
    preheader: "Whole streams, 20 reports and 20 clips a month.",
    blocks: [
      { p: `Hey ${name},` },
      { p: "Thanks for going Pro. It's what keeps LevlCast running, and I don't take it for granted." },
      { p: "Here's what's on now:" },
      {
        list: [
          { title: "Whole streams", note: "Every report coaches the full stream, up to 8 hours." },
          { title: "20 reports a month", note: "Up to 30 hours of streams." },
          { title: "20 clips a month", note: "With 9:16 versions ready for Shorts, TikTok and Reels." },
          { title: "Posting to YouTube", note: "Straight from LevlCast once you connect your channel." },
        ],
      },
      { button: "Open LevlCast", href: `${SITE}/dashboard` },
      { p: "If something's off, or there's something you wish LevlCast did, reply to this email. It comes straight to me." },
    ],
    signed: true,
    footer: { label: "Manage subscription", href: `${SITE}/dashboard/settings` },
  });
  await resend.emails.send({ from: FROM_LANDON, to, replyTo: REPLY_TO, subject: "You're on Pro", html, text });
}

/**
 * A clip finished, for free streamers. No score in it: the first clip is
 * cut right after the report, which is still sealed, and a score here
 * would give the result away before they call it.
 */
export async function sendClipReadyEmail(
  to: string,
  name: string,
  vodId: string,
  clipTitle: string,
  _score: number | undefined
): Promise<void> {
  const { html, text } = renderEmail({
    preheader: clipTitle,
    eyebrow: `Hey ${name}`,
    heading: "Your clip is ready.",
    blocks: [
      { p: "We cut it from your stream. Trim it, fix the captions or download it from your stream's page." },
      { quote: clipTitle, label: "Clip" },
      { button: "See the clip", href: `${SITE}/dashboard/vods/${vodId}` },
      {
        small:
          "Free gets 6 clips a month. Pro gets 20, with 9:16 versions for Shorts, TikTok and Reels, and posting straight to YouTube.",
      },
    ],
  });
  await resend.emails.send({ from: FROM_LEVLCAST, to, subject: "Your clip is ready", html, text });
}

/**
 * A day after sign-up with no report yet. Either they have streams and
 * nothing ran (a failed first report, or only streams under 10 minutes),
 * or Twitch isn't saving their streams at all.
 */
export async function sendActivationEmail(to: string, name: string, hasStreams = true): Promise<void> {
  const { html, text } = hasStreams
    ? renderEmail({
        preheader: "Pick a stream and it's done in about ten minutes.",
        eyebrow: `Hey ${name}`,
        heading: "Your first report hasn't run yet.",
        blocks: [
          {
            p: "Pick one of your streams and LevlCast goes through it in about ten minutes: what went wrong and when, what's worth clipping, and where you land on the ladder.",
          },
          { button: "Pick a stream", href: `${SITE}/dashboard/vods` },
        ],
      })
    : renderEmail({
        preheader: "Turn on Store past broadcasts and your first report starts by itself.",
        eyebrow: `Hey ${name}`,
        heading: "Twitch isn't saving your streams yet.",
        blocks: [
          {
            p: "LevlCast works from your past broadcasts, and your channel doesn't have any saved. Turn on Store past broadcasts in your Twitch Creator Dashboard, under Settings, then Stream.",
          },
          { p: "After your next stream, your first report starts by itself." },
          { button: "Open LevlCast", href: `${SITE}/dashboard` },
        ],
      });
  await resend.emails.send({
    from: FROM_LEVLCAST,
    to,
    subject: hasStreams ? "Your first report hasn't run yet" : "Turn on saved broadcasts to get your first report",
    html,
    text,
  });
}

/**
 * Sent to a user when the admin replies to their feedback. The reply
 * arrives in their inbox AND surfaces on their dashboard via the
 * AdminReplyCard, so they have two paths back to seeing it.
 */
export async function sendFeedbackReplyToUser(input: {
  to: string;
  name: string;
  originalMessage: string;
  reply: string;
}): Promise<void> {
  const { html, text } = renderEmail({
    preheader: input.reply.slice(0, 120),
    blocks: [
      { p: `Hey ${input.name},` },
      { p: input.reply },
      { quote: input.originalMessage, label: "You wrote" },
      { button: "Open LevlCast", href: `${SITE}/dashboard` },
      { small: "Reply to this email to keep talking." },
    ],
    signed: true,
  });
  await resend.emails.send({
    from: FROM_LANDON,
    to: input.to,
    replyTo: REPLY_TO,
    subject: "Reply to your LevlCast feedback",
    html,
    text,
  });
}

/**
 * Notify the admin whenever a user submits feedback. Body is escaped +
 * truncated server-side so a malicious payload cannot inject HTML into
 * the email. Only Landon sees this one.
 */
export async function sendFeedbackToAdmin(input: {
  category: string;
  message: string;
  fromEmail: string | null;
  twitchLogin: string | null;
  userId: string | null;
  context: Record<string, unknown> | null;
}): Promise<void> {
  const safeMessage = escapeHtml(input.message).replace(/\n/g, "<br>");
  const safeCategory = escapeHtml(input.category);
  const safeFromEmail = escapeHtml(input.fromEmail ?? "(no email on file)");
  const safeTwitch = escapeHtml(input.twitchLogin ?? "(no twitch login)");
  const safeUserId = escapeHtml(input.userId ?? "(no user id)");
  const contextJson = input.context ? escapeHtml(JSON.stringify(input.context, null, 2)) : null;

  await resend.emails.send({
    from: "LevlCast Feedback <hello@levlcast.com>",
    to: "mototoka14@gmail.com",
    subject: `[LevlCast feedback · ${input.category}] ${input.fromEmail ?? "anon"}`,
    html: `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;">
  <div style="max-width:560px;margin:0 auto;background:#141418;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:28px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#22D3EE;">LevlCast Feedback</p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;">Category: ${safeCategory}</h1>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.5);">From: ${safeFromEmail}</p>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.5);">Twitch: ${safeTwitch}</p>
    <p style="margin:0 0 18px;font-size:12px;color:rgba(255,255,255,0.5);">User ID: ${safeUserId}</p>
    <div style="background:#0A0A0F;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.9);">${safeMessage}</div>
    ${contextJson ? `<details style="margin-top:16px;"><summary style="cursor:pointer;font-size:12px;color:rgba(255,255,255,0.5);">Context</summary><pre style="margin:8px 0 0;padding:12px;background:#0A0A0F;border-radius:8px;font-size:11px;color:rgba(255,255,255,0.65);white-space:pre-wrap;word-break:break-word;">${contextJson}</pre></details>` : ""}
    <p style="margin:20px 0 0;font-size:11px;color:rgba(255,255,255,0.3);">View all feedback at <a href="https://levlcast.com/dashboard/admin/feedback" style="color:#22D3EE;">/dashboard/admin/feedback</a></p>
  </div>
</body></html>`,
  });
}

/**
 * Someone sent a collab interest. The sender's intro stays out of the
 * subject line so it doesn't sit in an inbox preview.
 */
export async function sendCollabInterestEmail(
  to: string,
  recipientName: string,
  senderName: string,
  introText: string
): Promise<void> {
  const { html, text } = renderEmail({
    preheader: `${senderName} sent you a collab interest on LevlCast.`,
    eyebrow: `Hey ${recipientName}`,
    heading: `${senderName} wants to collab.`,
    blocks: [
      { p: "They sent this through the Collab Finder. Your Discord stays private unless you accept." },
      { quote: introText },
      { button: "See it", href: `${SITE}/dashboard/collabs` },
    ],
    footer: { label: "Manage Collab Finder", href: `${SITE}/dashboard/settings` },
  });
  await resend.emails.send({ from: FROM_LEVLCAST, to, subject: `${senderName} wants to collab`, html, text });
}

/** The recipient accepted: the sender gets their Discord. */
export async function sendCollabAcceptedEmail(
  to: string,
  senderName: string,
  recipientName: string,
  discordHandle: string
): Promise<void> {
  const { html, text } = renderEmail({
    preheader: `${recipientName} accepted. Here's their Discord.`,
    eyebrow: `Hey ${senderName}`,
    heading: `${recipientName} said yes.`,
    blocks: [
      { p: "Here's their Discord. Add them and say you found them on LevlCast, so they know who you are." },
      { quote: discordHandle, label: "Discord", mono: true },
    ],
    footer: { label: "Open Collab Finder", href: `${SITE}/dashboard/collabs` },
  });
  await resend.emails.send({ from: FROM_LEVLCAST, to, subject: `${recipientName} accepted your collab interest`, html, text });
}

/**
 * A recurring charge was declined.
 *
 * This is the only email in here that exists to save a customer rather
 * than to serve one. It was written after a Pro member with nine
 * analyses churned on an insufficient-funds decline and was never told:
 * the webhook logged a warning and nothing reached the person whose card
 * had bounced.
 *
 * Deliberately short, and deliberately not a sales email. Someone whose
 * payment just failed does not need the feature list again — they need
 * to know it happened, that their history is intact, and where the
 * button is. `reason` carries Stripe's own wording when it gives one,
 * because "insufficient funds" and "card expired" call for different
 * actions from the reader.
 */
export async function sendPaymentFailedEmail(to: string, name: string, reason?: string | null): Promise<void> {
  const { html, text } = renderEmail({
    preheader: "Your reports and rank are safe. Update your card and Pro turns back on.",
    blocks: [
      { p: `Hey ${name},` },
      {
        p: `Your card was declined when we tried to renew your Pro subscription${reason ? `, and the bank gave the reason as ${reason}` : ""}. Nothing is wrong on your end that I can see, and this happens all the time.`,
      },
      { p: "Your reports, your rank and your whole history are exactly where you left them. Update your card and Pro turns back on right away." },
      { button: "Update payment method", href: `${SITE}/dashboard/settings` },
      { p: "If you meant to cancel, no hard feelings and you don't need to do anything. If something else is going on, just reply to this email and it comes straight to me." },
    ],
    signed: true,
    footer: { label: "Manage subscription", href: `${SITE}/dashboard/settings` },
  });
  await resend.emails.send({
    from: FROM_LANDON,
    to,
    replyTo: REPLY_TO,
    subject: "Your LevlCast payment didn't go through",
    html,
    text,
  });
}
