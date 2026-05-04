import Image from "next/image";

/*
  Add more streamer photos by dropping PNGs into public/la/
  and adding them to this array. The marquee will loop seamlessly.
*/
const STREAMERS = [
  "/la/streamer-1.png?v=2",
  "/la/streamer-2.png?v=2",
  "/la/streamer-3.png?v=2",
  "/la/streamer-4.png?v=2",
  "/la/streamer-5.png?v=2",
  "/la/streamer-6.png?v=2",
  "/la/streamer-7.png?v=2",
  "/la/streamer-8.png?v=2",
  "/la/streamer-9.png?v=2",
  "/la/streamer-10.png?v=2",
];

const ROW1 = STREAMERS.slice(0, 5);
const ROW2 = STREAMERS.slice(5);

function Card({ src }: { src: string }) {
  return (
    <div className="ll-sm-card">
      <Image src={src} alt="" fill style={{ objectFit: "cover" }} sizes="300px" />
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
