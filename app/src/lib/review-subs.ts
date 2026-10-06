/**
 * Where a review thread ("drop your Twitch name and I'll look at your last
 * stream") can go, from each subreddit's own rules as read on 2026-10-04.
 *
 *  - "open": the rules allow it. Post straight away.
 *  - "ask":  the rules ban tool or website posts without the mods' OK.
 *            Modmail first; the Post button unlocks once they say yes.
 *  - "no":   not a fit at all.
 *
 * Each open sub gets its own wording. The same text in several subs on the
 * same day is what Reddit's spam filter looks for. None of the posts carry
 * a link: the links only go in the replies, to people who asked.
 *
 * Plain data, safe for the browser.
 */

export type SubStatus = "open" | "ask" | "no";

export interface ReviewSub {
  name: string;
  members: string;
  status: SubStatus;
  /** The rule that decides it, in a few words. */
  rule: string;
  title: string;
  body: string;
}

const STANDARD_BODY = `I stream too, and I built a tool that goes through a stream and finds where people probably left (long quiet stretches, a slow start, that kind of thing) plus the moments worth clipping. It uses AI to read the transcript, so it's not perfect, but it quotes what you actually said with timestamps so you can check it.

Drop your Twitch name below and I'll run your last stream and reply with what it found and a link to the full breakdown. It's free and you don't need to sign up for anything.

You need past broadcasts turned on so there's a VOD for it to read.

I also just added a free panel for OBS that coaches you while you're live, if anyone wants to try that too.`;

const STANDARD_TITLE = "Drop your Twitch name and I'll tell you what's costing you viewers in your last stream";

export const REVIEW_SUBS: ReviewSub[] = [
  {
    name: "TwitchStreaming",
    members: "10k",
    status: "open",
    rule: "Only Reddit's own rules. The most active of these.",
    title: STANDARD_TITLE,
    body: STANDARD_BODY,
  },
  {
    name: "TwitchFollowers",
    members: "23k",
    status: "open",
    rule: "Its only rules are no harassment and no spamming comments.",
    title: "Want to know why viewers leave your stream? Drop your Twitch name",
    body: `I made a tool that goes through a stream and finds the spots where people probably left, like long quiet stretches or a slow start, and the moments worth clipping. It uses AI to read the transcript, so it's not perfect, but it quotes what you said with timestamps so you can see for yourself.

Comment your Twitch name and I'll run your last stream and reply with what it found. Free, nothing to sign up for.

Past broadcasts need to be turned on so there's a VOD to read.

There's also a free OBS panel now that coaches you while you're live, if you want that too.`,
  },
  {
    name: "ContentCreators",
    members: "12k",
    status: "open",
    rule: "No paid services and no emojis. Needs 20 karma and a 7 day old account.",
    title: "Twitch streamers: I'll look at your last stream for free and tell you the one thing to fix",
    body: `I stream on Twitch and built a tool that reads a stream's transcript and points out where viewers probably dropped off (dead air, slow openings) and which moments are worth clipping. It's AI, so not perfect, but it quotes you with timestamps so it's easy to check.

If you stream on Twitch, comment your channel name and I'll reply with what it found on your last stream plus a link to the full breakdown. It's free and you don't need an account.

You need past broadcasts turned on. I also made a free panel for OBS that coaches you during the stream, if anyone's interested.`,
  },
  {
    name: "TwitchStreamers",
    members: "4k",
    status: "open",
    rule: "No channel links and needs a flair. Quiet, few comments.",
    title: "Free stream feedback: comment your Twitch name and I'll go through your last stream",
    body: `I built a tool that goes through a stream and finds where viewers probably left, like long quiet stretches or a slow start, plus the moments worth clipping. It uses AI on the transcript so it's not perfect, but it quotes what you said with timestamps.

Comment just your Twitch name, no links since the sub doesn't allow channel links, and I'll reply with what it found on your last stream. Free, no sign up.

You need past broadcasts turned on. Also added a free OBS panel that coaches you while you're live, if anyone wants it.`,
  },
  {
    name: "SmallStreamers",
    members: "33k",
    status: "ask",
    rule: "No promo of anything.",
    title: STANDARD_TITLE,
    body: `${STANDARD_BODY}\n\n(Mods okayed this one.)`,
  },
  {
    name: "Twitch_Startup",
    members: "103k",
    status: "ask",
    rule: "No websites or services without mod consent.",
    title: STANDARD_TITLE,
    body: `${STANDARD_BODY}\n\n(Mods okayed this one.)`,
  },
  {
    name: "streaming",
    members: "74k",
    status: "ask",
    rule: "A tool post without consent is a permanent ban.",
    title: STANDARD_TITLE,
    body: `${STANDARD_BODY}\n\n(Mods okayed this one.)`,
  },
  {
    name: "Twitch",
    members: "2.8M",
    status: "ask",
    rule: "No third-party ads without permission.",
    title: STANDARD_TITLE,
    body: `${STANDARD_BODY}\n\n(Mods okayed this one.)`,
  },
  {
    name: "PartneredYoutube",
    members: "105k",
    status: "no",
    rule: "YouTube partners only, no advertising of any kind.",
    title: STANDARD_TITLE,
    body: STANDARD_BODY,
  },
];

/** Every review title, so the dashboard can spot the threads already posted. */
export const REVIEW_TITLES = new Set(REVIEW_SUBS.map((s) => s.title.toLowerCase()));

export const MODMAIL_SUBJECT = "Can I run a free stream review thread?";

export function modmailBody(sub: string): string {
  return `Hey, I'm Landon. I built LevlCast, a free tool that goes through a Twitch VOD and points out where viewers probably dropped off (dead air, slow starts) and what's worth clipping. It also has a free panel for OBS that coaches you while you're live.

I'd like to post one thread in r/${sub} where people drop their Twitch name and I reply to each with what it found on their last stream. No sign up needed to see it. I know the sub doesn't allow promo without asking, so I wanted to check with you first. Happy to do it however works for you, or not at all if it's not a fit.

Thanks either way.`;
}

/** Reddit's submit page with the post filled in. Old Reddit takes the body as a parameter. */
export function submitUrl(sub: ReviewSub): string {
  return (
    `https://old.reddit.com/r/${sub.name}/submit?selftext=true` +
    `&title=${encodeURIComponent(sub.title)}` +
    `&text=${encodeURIComponent(sub.body)}`
  );
}

/** A message to the sub's moderators, filled in. */
export function modmailUrl(sub: ReviewSub): string {
  return (
    `https://www.reddit.com/message/compose/?to=${encodeURIComponent(`/r/${sub.name}`)}` +
    `&subject=${encodeURIComponent(MODMAIL_SUBJECT)}` +
    `&message=${encodeURIComponent(modmailBody(sub.name))}`
  );
}
