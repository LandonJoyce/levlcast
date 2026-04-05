import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.levlcast.com"),
  title: {
    default: "LevlCast — Twitch VOD Analyzer, Clip Generator & AI Stream Coach",
    template: "%s | LevlCast",
  },
  description:
    "LevlCast analyzes your Twitch VODs, finds your best moments, generates clips automatically, and gives you an AI coaching report after every stream. Free to start — no credit card required.",
  keywords: [
    "twitch vod analyzer",
    "twitch clip maker",
    "twitch highlights generator",
    "auto clip generator twitch",
    "twitch stream coaching",
    "how to grow on twitch",
    "twitch stream analytics",
    "twitch content tools",
    "vod to clips",
    "twitch peak moments",
    "AI stream analysis",
    "twitch growth tools",
    "streamer tools",
    "stream coaching app",
    "twitch clip generator",
    "twitch performance analytics",
    "best tools for twitch streamers",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://www.levlcast.com",
    title: "LevlCast — Twitch VOD Analyzer & AI Stream Coach",
    description:
      "Automatically analyze your Twitch VODs, generate clips from your best moments, and get an AI coaching report after every stream. Free to start.",
    siteName: "LevlCast",
  },
  twitter: {
    card: "summary_large_image",
    title: "LevlCast — Twitch VOD Analyzer & AI Stream Coach",
    description:
      "Automatically analyze your Twitch VODs, generate clips from your best moments, and get an AI coaching report after every stream. Free to start.",
    site: "@levlcast",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LevlCast",
  },
};

export const viewport: Viewport = {
  themeColor: "#7C3AED",
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
    "AI-powered tools that turn your Twitch stream into clips, content, and a bigger audience — automatically.",
  url: "https://www.levlcast.com",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "9.99", priceCurrency: "USD" },
  ],
};

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How long does Twitch VOD analysis take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most VODs are analyzed within 2–5 minutes depending on stream length. We process audio transcription and AI peak detection in parallel so you're not waiting long.",
      },
    },
    {
      "@type": "Question",
      name: "Does LevlCast store my Twitch VODs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. We stream your VOD directly from Twitch, analyze it, then discard it. Only the transcription data and generated clip files are stored in your account.",
      },
    },
    {
      "@type": "Question",
      name: "Does LevlCast work with YouTube?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can connect your YouTube channel from the dashboard and post clips directly. TikTok and Instagram integrations are coming soon.",
      },
    },
    {
      "@type": "Question",
      name: "Is LevlCast free to use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — no credit card required. The free plan includes 1 VOD analysis per month and up to 5 clips total. Upgrade to Pro for unlimited analyses and clips.",
      },
    },
    {
      "@type": "Question",
      name: "Does LevlCast work with any Twitch streamer?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LevlCast works with any Twitch account. Just connect with Twitch OAuth and start analyzing your past VODs immediately.",
      },
    },
    {
      "@type": "Question",
      name: "What is a peak moment on Twitch?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our AI detects moments by category: hype (chat spikes, hype trains), funny (laughter, reactions), clutch (key gameplay moments), and educational (insight or tips you drop mid-stream).",
      },
    },
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
        {/* PWA — iOS splash screens & icons */}
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
        />
      </head>
      <body className={`${dmSans.variable} font-sans antialiased`}>
        {children}

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
