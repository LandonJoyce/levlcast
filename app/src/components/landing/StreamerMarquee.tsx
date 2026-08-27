const CARDS = [
  { handle: "novxserpent", game: "Valorant", score: 81, delta: "+9", cat: "CLUTCH", fix: "The 1v3 clutch on Bind at 1:14 was your best moment. You went quiet right after and lost 22% of viewers in 3 minutes." },
  { handle: "bramvdijk_tv", game: "CS2", score: 67, delta: "+12", cat: "HYPE", fix: "AWP ace on Mirage at 47:20 spiked chat but you moved straight into the next round. Hold that moment longer." },
  { handle: "kasperholm", game: "World of Warcraft", score: 58, delta: "+4", cat: "EDUCATIONAL", fix: "Mythic+ breakdown was solid but you stopped narrating during the pull at 38:10. Lost half the chat right there." },
  { handle: "arcticblaze", game: "Valorant", score: 88, delta: "+14", cat: "HYPE", fix: "Best score this month. Reading enemy Sage walls out loud kept chat engaged through the slow rounds." },
  { handle: "thierrylive", game: "PUBG", score: 62, delta: "+7", cat: "EMOTIONAL", fix: "The final circle loss at 1:28 was genuine and chat loved it. The second half never recovered that energy." },
  { handle: "driftkxng", game: "CS2", score: 76, delta: "+11", cat: "CLUTCH", fix: "Deagle kill through smoke on Inferno at 2:34 is the best clip you've had in three streams." },
  { handle: "magnusfps", game: "Valorant", score: 83, delta: "+8", cat: "HYPE", fix: "Operator duel on Haven at 47:20 then 7 minutes of silence. That gap is the only thing keeping you under 90." },
  { handle: "pyroshift", game: "Apex Legends", score: 91, delta: "+18", cat: "HYPE", fix: "Back-to-back 20 bomb run from 1:45 to close. Chat was locked in the entire time. Longest run on record." },
  { handle: "svenplays", game: "PUBG", score: 77, delta: "+7", cat: "CLUTCH", fix: "Won a 1v4 in the final zone at 2:11 then went into a quiet loot run for 20 minutes. Ride that energy." },
  { handle: "floortje_gg", game: "Apex Legends", score: 68, delta: "+8", cat: "COMEDY", fix: "Wraith portal into the storm at 1:08 had chat going. You apologized for it. Don't, it was the highlight." },
  { handle: "rikkevods", game: "Fortnite", score: 72, delta: "+6", cat: "CLUTCH", fix: "Box fight at 1:44 was textbook. You started explaining the build and chat doubled. Keep doing that." },
  { handle: "voltaicvex", game: "Rocket League", score: 85, delta: "+13", cat: "CLUTCH", fix: "Overtime winner at 2:08 got 14 clips in one session. You need to build that tension out loud more." },
  { handle: "tarkovpete", game: "Escape from Tarkov", score: 66, delta: "+8", cat: "EMOTIONAL", fix: "The wipe at Customs at 1:03 had chat more invested than any raid this month. That raw reaction is the content." },
  { handle: "huntclipz", game: "Hunt: Showdown", score: 74, delta: "+7", cat: "CLUTCH", fix: "Long ammo snipe at 2:17 through two walls. You underreacted. Chat was going insane and you moved on." },
  { handle: "poe_niklas", game: "Path of Exile", score: 60, delta: "+5", cat: "EDUCATIONAL", fix: "Build crafting segment at 28:00 held viewers but you assumed too much knowledge. Explain the why, not just the what." },
  { handle: "seathieves_ro", game: "Sea of Thieves", score: 71, delta: "+9", cat: "COMEDY", fix: "The skeleton ship ambush at 57:00 was genuinely chaotic. Chat wanted you to lose. Play into that more." },
  { handle: "rustlordtv", game: "Rust", score: 63, delta: "+6", cat: "EMOTIONAL", fix: "Base getting raided at 1:19 was your most watched segment by far. The grief was real and chat felt it." },
];

function scoreColor(n: number) {
  if (n >= 75) return "#A3E635";
  if (n >= 50) return "#F59E0B";
  return "#F87171";
}

function catColor(c: string) {
  switch (c) {
    case "HYPE":        return { bg: "rgba(168,85,247,0.15)", text: "rgb(192,132,252)" };
    case "CLUTCH":      return { bg: "rgba(34,197,94,0.12)", text: "rgb(74,222,128)" };
    case "COMEDY":      return { bg: "rgba(234,179,8,0.15)", text: "rgb(250,204,21)" };
    case "EDUCATIONAL": return { bg: "rgba(59,130,246,0.15)", text: "rgb(96,165,250)" };
    case "EMOTIONAL":   return { bg: "rgba(244,63,94,0.12)", text: "rgb(251,113,133)" };
    default:            return { bg: "rgba(100,116,139,0.15)", text: "rgb(148,163,184)" };
  }
}

function Card({ handle, game, score, delta, cat, fix }: (typeof CARDS)[0]) {
  const sc = scoreColor(score);
  const cc = catColor(cat);
  return (
    <div className="ll-rc-card">
      <div className="ll-rc-top">
        <div className="ll-rc-score" style={{ color: sc }}>{score}<span>/100</span></div>
        <div className="ll-rc-delta" style={{ color: sc }}>{delta}</div>
        <div className="ll-rc-cat" style={{ background: cc.bg, color: cc.text }}>{cat}</div>
      </div>
      <p className="ll-rc-fix">{fix}</p>
      <div className="ll-rc-meta">
        <span className="ll-rc-handle">{handle}</span>
        <span className="ll-rc-game">{game}</span>
      </div>
    </div>
  );
}

function Row({ items, reverse }: { items: typeof CARDS; reverse?: boolean }) {
  return (
    <div className="ll-rc-row-wrap">
      <div className={`ll-rc-track${reverse ? " ll-rc-track-rev" : ""}`}>
        {[...items, ...items].map((c, i) => (
          <Card key={i} {...c} />
        ))}
      </div>
    </div>
  );
}

export default function StreamerMarquee() {
  return (
    <div className="ll-rc-wrap" aria-hidden="true">
      <Row items={CARDS} />
    </div>
  );
}
