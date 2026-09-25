import type { Metadata } from "next";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import "../home-ranked.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="ll-page v3">
      <SiteHeader />
      <main>
        <div className="max-w-[720px] pt-10 pb-24">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted mb-12">Last updated: April 4, 2026</p>

          <div className="space-y-10 text-sm text-muted leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-white mb-3">1. What We Collect</h2>
              <p className="mb-3">When you use LevlCast, we collect:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li>Your Twitch account information (username, profile image, email) via OAuth</li>
                <li>VOD metadata from the Twitch API (titles, durations, URLs)</li>
                <li>Audio transcriptions generated from your VODs during analysis</li>
                <li>AI-generated clip files and coaching reports stored in your account</li>
                <li>Subscription status and usage data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">2. What We Do Not Store</h2>
              <p>
                We do not store full VOD video files. When you analyze a VOD, we stream the audio directly from Twitch, process it, and discard it. Only the transcription data and generated clip files are retained in your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">3. How We Use Your Data</h2>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li>To analyze your VODs and generate clips and coaching reports</li>
                <li>To manage your account and subscription</li>
                <li>To post clips to connected platforms (YouTube) on your behalf when authorized</li>
                <li>To improve the accuracy and quality of our AI models</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">4. AI and Third-Party Processing</h2>
              <p className="mb-3">
                LevlCast uses third-party AI services to process your stream data:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li><span className="text-white font-medium">Anthropic (Claude)</span> AI peak detection and coaching report generation</li>
                <li><span className="text-white font-medium">Deepgram</span> Audio transcription</li>
              </ul>
              <p className="mt-3">
                Your audio and transcription data may be processed by these services subject to their respective privacy policies. We do not share personally identifiable information beyond what is necessary for processing.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">5. Twitch Data</h2>
              <p>
                We access your Twitch data under the scopes you authorize during OAuth login (<code className="text-accent-light bg-surface px-1 py-0.5 rounded text-xs">user:read:email</code>). We comply with Twitch&apos;s Developer Services Agreement regarding the use and storage of Twitch data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">6. Data Storage</h2>
              <p>
                Your data is stored in Supabase (PostgreSQL + file storage) hosted in the United States. Access is protected by Row Level Security you can only access your own data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">7. Data Sharing</h2>
              <p>
                We do not sell your personal data. We do not share your data with third parties except as required to operate the Service (AI providers, payment processors) or as required by law.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">8. Your Rights</h2>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li>Access the data we hold about you</li>
                <li>Request deletion of your account and all associated data</li>
                <li>Disconnect connected platforms (YouTube) from your dashboard</li>
                <li>Revoke Twitch OAuth access at any time via your Twitch settings</li>
              </ul>
              <p className="mt-3">
                To request account deletion, email{" "}
                <a href="mailto:support@levlcast.com" className="text-accent-light hover:underline">
                  support@levlcast.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">9. Cookies</h2>
              <p>
                We use session cookies to keep you logged in. We do not use third-party tracking cookies or advertising cookies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">10. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy as the Service evolves. We will notify users of material changes via email or an in-app notice.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">11. Contact</h2>
              <p>
                Privacy questions? Email us at{" "}
                <a href="mailto:support@levlcast.com" className="text-accent-light hover:underline">
                  support@levlcast.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
