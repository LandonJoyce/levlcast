import Image from "next/image";

/*
  Add more streamer photos by dropping PNGs into public/la/
  and adding them to this array. The marquee will loop seamlessly.
*/
const STREAMERS = [
  "/la/streamer-1.png",
  "/la/streamer-2.png",
  "/la/streamer-3.png",
  "/la/streamer-4.png",
  "/la/streamer-5.png",
  "/la/streamer-6.png",
  "/la/streamer-7.png",
  "/la/streamer-8.png",
  "/la/streamer-9.png",
  "/la/streamer-10.png",
];

const ROW1 = STREAMERS.slice(0, 5);
const ROW2 = STREAMERS.slice(5);

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

function Row({ items }: { items: string[] }) {
  return (
    <div className="ll-sm-row-wrap">
      <div className="ll-sm-track">
        {items.map((src, i) => (
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
      <Row items={ROW2} />
    </div>
  );
}
