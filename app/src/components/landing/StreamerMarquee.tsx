const CARDS = [
  { handle: "NovaSerpent", score: 81, delta: "+9", cat: "HYPE", fix: "Energy held through the whole session. Mid-game transitions used to kill momentum." },
  { handle: "clutchpxl", score: 67, delta: "+12", cat: "CLUTCH", fix: "Started slow but picked up hard after first win. Opening 20 min need more energy." },
  { handle: "ZephyrFPS", score: 74, delta: "+6", cat: "COMEDY", fix: "Chat engagement was strong. Dead air at 1:12 dropped viewers 30% in 4 minutes." },
  { handle: "ironwolf_tv", score: 58, delta: "+4", cat: "EDUCATIONAL", fix: "Good game knowledge but stream felt like a tutorial. Let personality come through more." },
  { handle: "ArcticBlaze", score: 88, delta: "+14", cat: "HYPE", fix: "Best stream yet. Keep the back-and-forth with chat, it drove the biggest spikes." },
  { handle: "mxreyna", score: 62, delta: "+7", cat: "EMOTIONAL", fix: "Genuine reactions landed well. Consistency dipped in hour two, energy fell off." },
  { handle: "DriftKing99", score: 76, delta: "+11", cat: "CLUTCH", fix: "Comeback moment at 2:34 was your clip of the month. Build more tension before peaks." },
  { handle: "solstice_gg", score: 55, delta: "+3", cat: "COMEDY", fix: "Strong personality, audio mix was hurting you. Game audio buried your voice twice." },
  { handle: "KryptoViper", score: 83, delta: "+8", cat: "HYPE", fix: "Seven minutes of dead air at 47:20. Everything else was top tier." },
  { handle: "lunarvex", score: 70, delta: "+5", cat: "EDUCATIONAL", fix: "Teaching segments were clear. Transition to gameplay felt abrupt every time." },
  { handle: "PyroShift", score: 91, delta: "+18", cat: "HYPE", fix: "Highest score this month. Chat was fully locked in during the final hour." },
  { handle: "echidnaTV", score: 64, delta: "+9", cat: "COMEDY", fix: "Laugh rate was above average. Pacing slowed after the 90-minute mark." },
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
