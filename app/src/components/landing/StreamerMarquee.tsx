import Image from "next/image";

const REAL = ["/la/streamer-1.png", "/la/streamer-2.png"];

/* Six placeholder stream cards with different gradient themes */
const PLACEHOLDERS: { gradient: string; label: string; tag: string }[] = [
  { gradient: "linear-gradient(135deg,#1a0533 0%,#3b1066 100%)", label: "VIEWERS 2,734", tag: "LIVE" },
  { gradient: "linear-gradient(135deg,#051a2e 0%,#0d4a7a 100%)", label: "NEW FOLLOWER", tag: "LIVE" },
  { gradient: "linear-gradient(135deg,#1a0a00 0%,#6b2d00 100%)", label: "DAILY GOAL 41/200", tag: "LIVE" },
  { gradient: "linear-gradient(135deg,#00151a 0%,#004d5e 100%)", label: "NEW SUB x7", tag: "LIVE" },
  { gradient: "linear-gradient(135deg,#180020 0%,#5c0080 100%)", label: "DONATIONS $145", tag: "LIVE" },
  { gradient: "linear-gradient(135deg,#0a1a00 0%,#1e5c00 100%)", label: "NEW FOLLOWER", tag: "LIVE" },
];

function StreamCard({ src, placeholder }: {
  src?: string;
  placeholder?: { gradient: string; label: string; tag: string };
}) {
  if (src) {
    return (
      <div className="ll-streamer-card">
        <Image src={src} alt="" fill style={{ objectFit: "cover" }} sizes="260px" />
        <div className="ll-streamer-overlay">
          <span className="ll-streamer-live">LIVE</span>
        </div>
      </div>
    );
  }
  return (
    <div className="ll-streamer-card" style={{ background: placeholder!.gradient }}>
      <div className="ll-streamer-overlay">
        <span className="ll-streamer-live">{placeholder!.tag}</span>
        <span className="ll-streamer-stat">{placeholder!.label}</span>
      </div>
    </div>
  );
}

/* Build a column: mix real + placeholders so each column looks different */
function makeColumn(seed: number) {
  const items = [
    { src: REAL[seed % 2] },
    { placeholder: PLACEHOLDERS[seed % PLACEHOLDERS.length] },
    { src: REAL[(seed + 1) % 2] },
    { placeholder: PLACEHOLDERS[(seed + 2) % PLACEHOLDERS.length] },
    { src: REAL[seed % 2] },
    { placeholder: PLACEHOLDERS[(seed + 3) % PLACEHOLDERS.length] },
  ];
  return items;
}

const COLS = [0, 1, 2, 3, 4];

export default function StreamerMarquee() {
  return (
    <div className="ll-marquee-wrap" aria-hidden="true">
      <div className="ll-marquee-cols">
        {COLS.map((seed) => {
          const items = makeColumn(seed);
          const reversed = seed % 2 === 1;
          return (
            <div key={seed} className={`ll-marquee-col ${reversed ? "ll-marquee-rev" : ""}`}>
              {/* Duplicate items for seamless loop */}
              {[...items, ...items].map((item, i) => (
                <StreamCard key={i} {...item} />
              ))}
            </div>
          );
        })}
      </div>
      {/* Fade edges */}
      <div className="ll-marquee-fade-top" />
      <div className="ll-marquee-fade-bottom" />
    </div>
  );
}
