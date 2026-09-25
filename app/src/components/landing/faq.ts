/**
 * The homepage FAQ, in one place.
 *
 * One list for the visible FAQ and its structured data, so the two can
 * never say different things, and so an alternate homepage (/v3) shows the
 * same answers as the live one. The structured data used to live in the
 * root layout, where it went out on every page and had drifted to
 * questions no page asked.
 */

export const FAQ = [
  { q: "Do I need an account?", a: "Not to try it. Paste any Twitch stream link and you get a real report on the start of it. You only sign in when you want the whole stream read instead of the start." },
  { q: "Do you keep my streams?", a: "No. We listen to the audio while we work, then throw it away. We keep the report and any clips you make." },
  { q: "How long does it take?", a: "About a minute for the free one. About five minutes for a full two hour stream." },
  { q: "Does it work on small channels?", a: "Any channel. It does not matter if you have three viewers." },
  { q: "What do I actually get for free?", a: "Two full reports a week, every week. Full means full. There is no blurred section, no locked fix, no part of the report you have to pay to read. Pro is for people streaming more than twice a week who want more of them." },
  { q: "What is the rank?", a: "Every stream you analyze moves you up or down a ladder, Iron through Grandmaster. Good streams pull you up, bad ones cost you less than good ones gain, and it gets harder the higher you climb. Each week you also race a small league of streamers near your rank, and the top three earn bonus points." },
  { q: "Who can see my rank?", a: "Your league sees your Twitch name and picture, your rank and the points you gained that week. Never your score or your reports. The public leaderboard only shows the top 50. You can leave leagues any time in Account." },
];

export const FAQ_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};
