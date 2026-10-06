import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.levlcast.com"),
  title: {
    default: "LevlCast: Live Coaching for Twitch Streamers",
    template: "%s | LevlCast",
  },
  description:
    "LevlCast coaches you live inside OBS, and after every Twitch stream it tells you what to fix: dead air, slow starts and the moments worth clipping. Free to start.",
  keywords: [
    "twitch stream manager",
    "personal streaming manager",
    "twitch vod analyzer",
    "twitch analyzer",
    "twitch clip maker",
    "free twitch clip maker",
    "twitch stream coaching",
    "twitch stream help",
    "how to grow on twitch",
    "why is my twitch stream not growing",
    "twitch stream analytics",
    "twitch burnout detection",
    "streamer growth tools",
    "twitch collab finder",
    "AI stream analysis",
    "twitch content strategy",
    "stream coaching app",
    "twitch clip generator",
    "best tools for twitch streamers",
    "streamer manager app",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://www.levlcast.com",
    title: "LevlCast: coaching for Twitch streamers",
    description: "A coach inside OBS while you're live, and a report after every stream that tells you what to fix. Free to start.",
    siteName: "LevlCast",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "LevlCast: coaching for Twitch streamers. The LevlCast panel in OBS with a coaching tip.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LevlCast: coaching for Twitch streamers",
    description: "A coach inside OBS while you're live, and a report after every stream that tells you what to fix.",
    // x.com/levlcast is someone else's account.
    site: "@LevlCastApp",
    images: ["/opengraph-image"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LevlCast",
  },
};

export const viewport: Viewport = {
  // The page background, so the browser bar on phones blends into the
  // site. Was the old purple brand colour.
  themeColor: "#100D0E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LevlCast",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web, iOS",
  description:
    "Coaching for Twitch streamers. LevlCast goes through your VODs, tells you what to fix with timestamps, clips your best moments and ranks every stream on a ladder from Iron to Grandmaster.",
  url: "https://www.levlcast.com",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "20.00", priceCurrency: "USD" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* PWA: iOS splash screens and icons */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {/* FAQ structured data lives on the homepage now, built from the
            same list the visible FAQ renders. Here it was emitted on every
            page of the site, dashboard included, and had drifted from the
            questions anyone could actually see. */}
      </head>
      <body className={`${plusJakarta.variable} ${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        <Analytics />

        {/* Register service worker for PWA */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

