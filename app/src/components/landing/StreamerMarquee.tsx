import Image from "next/image";

/*
  Add more streamer photos by dropping PNGs into public/la/
  and adding them to this array. The marquee will loop seamlessly.
*/
const STREAMERS = [
  "/la/streamer-1.png",
  "/la/streamer-2.png",
  "/la/streamer-1.png",
  "/la/streamer-2.png",
  "/la/streamer-1.png",
  "/la/streamer-2.png",
  "/la/streamer-1.png",
  "/la/streamer-2.png",
];

/* Split into two rows with different orderings */
const ROW1 = STREAMERS;
const ROW2 = [...STREAMERS].reverse();

function Card({ src }: { src: string }) {
  return (
    <div className="ll-sm-card">
      <Image src={src} alt="" fill style={{ objectFit: "cover" }} sizes="300px" />
      <div className="ll-sm-overlay">
        <span className="ll-sm-live">LIVE</span>
      </div>
    </div>
  );
}

function Row({ items, reverse }: { items: string[]; reverse?: boolean }) {
  /* Duplicate items so the loop is seamless */
  const all = [...items, ...items];
  return (
    <div className={`ll-sm-row-wrap${reverse ? " ll-sm-reverse" : ""}`}>
      <div className="ll-sm-track">
        {all.map((src, i) => (
          <Card key={i} src={src} />
        ))}
      </div>
    </div>
  );
}

export default function StreamerMarquee() {
  return (
    <div className="ll-sm-wrap" aria-hidden="true">
      <Row items={ROW1} />
      <Row items={ROW2} reverse />
      <div className="ll-sm-fade-left" />
      <div className="ll-sm-fade-right" />
    </div>
  );
}
