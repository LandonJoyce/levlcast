const CARDS = [
  { handle: "novxserpent", score: 81, delta: "+9", cat: "HYPE", fix: "Dead air at 1:14 dropped viewers 28% in under 4 minutes. Everything around it was strong." },
  { handle: "clutchpxl", score: 67, delta: "+12", cat: "CLUTCH", fix: "You went silent for 6 minutes after the first loss at 47:20. That's where retention tanked." },
  { handle: "zephyrfps_", score: 74, delta: "+6", cat: "COMEDY", fix: "The bit at 2:03 spiked chat harder than anything else. You moved on too fast — lean into those." },
  { handle: "ironwolf_tv", score: 58, delta: "+4", cat: "EDUCATIONAL", fix: "Strong game knowledge but you stopped talking during mechanical sections. Narrate everything." },
  { handle: "arcticblaze", score: 88, delta: "+14", cat: "HYPE", fix: "Best score yet. The back-and-forth with chat in hour two is what pushed it above 85." },
  { handle: "mxreyna", score: 62, delta: "+7", cat: "EMOTIONAL", fix: "Energy dropped off hard after 1:30:00. Second half felt like a different stream." },
  { handle: "driftkxng", score: 76, delta: "+11", cat: "CLUTCH", fix: "Comeback at 2:34 was your best clippable moment in three streams. You need to set that up more." },
  { handle: "solstice_gg", score: 55, delta: "+3", cat: "COMEDY", fix: "Game audio was drowning your voice at 22:10 and again at 58:40. Fix the mix before next stream." },
  { handle: "kryptoviper", score: 83, delta: "+8", cat: "HYPE", fix: "7 minutes of silence at 47:20 is the only thing that cost you a 90+ score. Otherwise elite." },
  { handle: "lunarvex_", score: 70, delta: "+5", cat: "EDUCATIONAL", fix: "The tutorial segments landed well. Every time you switched back to gameplay you lost the thread." },
  { handle: "pyroshift", score: 91, delta: "+18", cat: "HYPE", fix: "Chat was fully locked in from 1:45 to close. That's the longest sustained engagement on record." },
  { handle: "echidnatv", score: 64, delta: "+9", cat: "COMEDY", fix: "Pacing fell off after 1:30. You had 4 strong comedy moments in the first hour, one in the second." },
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

function Card({ handle, score, delta, cat, fix }: (typeof CARDS)[0]) {
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
      <div className="ll-rc-handle">{handle}</div>
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
  const row1 = CARDS.slice(0, 6);
  const row2 = CARDS.slice(6);
  return (
    <div className="ll-rc-wrap" aria-hidden="true">
      <Row items={row1} />
      <Row items={row2} reverse />
    </div>
  );
}
