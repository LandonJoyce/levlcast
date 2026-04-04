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
    default: "LevlCast — LvL Up Your Stream",
    template: "%s | LevlCast",
  },
  description:
    "AI-powered tools that turn your Twitch stream into clips, content, and a bigger audience — automatically. Start free, no credit card required.",
  keywords: [
    "Twitch clips",
    "stream highlights",
    "AI stream analysis",
    "Twitch growth",
    "auto clips",
    "streamer tools",
    "TikTok clips from Twitch",
    "stream coaching",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://www.levlcast.com",
    title: "LevlCast — LvL Up Your Stream",
    description:
      "AI-powered tools that turn your Twitch stream into clips, content, and a bigger audience — automatically.",
    siteName: "LevlCast",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LevlCast — AI-powered Twitch stream tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LevlCast — LvL Up Your Stream",
    description:
      "AI-powered tools that turn your Twitch stream into clips, content, and a bigger audience — automatically.",
    images: ["/og-image.png"],
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
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "9.99",
      priceCurrency: "USD",
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
        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
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
