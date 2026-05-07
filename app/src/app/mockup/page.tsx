import Link from "next/link";

export const metadata = { title: "LevlCast · Mockups", robots: { index: false, follow: false } };

const MOCKS = [
  { slug: "brutalist", title: "Brutalist", desc: "Black + white + one loud color. No shadows, no gradients, no rounded corners. Manifesto energy." },
  { slug: "desktop", title: "Desktop app", desc: "The landing page lives inside a fake Mac window. Sidebar, status bar, monochrome. Looks like the product is already running." },
  { slug: "chat", title: "Chat thread", desc: "The page is a DM conversation between a streamer and LevlCast. Scrolling reads as a conversation." },
];

export default function MockupHub() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", padding: "64px 32px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>LEVLCAST · DESIGN EXPLORATIONS</div>
        <h1 style={{ fontSize: 32, fontWeight: 600, margin: "0 0 32px", letterSpacing: "-0.02em" }}>Landing page mockups</h1>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {MOCKS.map((m) => (
            <li key={m.slug} style={{ borderTop: "1px solid rgba(255,255,255,0.1)", padding: "20px 0" }}>
              <Link href={`/mockup/${m.slug}`} style={{ color: "#fff", textDecoration: "none", display: "block" }}>
                <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>/mockup/{m.slug}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{m.desc}</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
