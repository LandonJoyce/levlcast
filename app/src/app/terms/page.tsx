import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-bg">
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="max-w-[1080px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-gradient">
            LevlCast
          </Link>
          <Link
            href="/auth/login"
            className="bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-85 transition-opacity"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      <div className="max-w-[720px] mx-auto px-6 pt-36 pb-24">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted mb-12">Last updated: April 4, 2026</p>

        <div className="space-y-10 text-sm text-muted leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using LevlCast (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Description of Service</h2>
            <p>
              LevlCast is an AI-powered platform that analyzes Twitch VODs, detects peak moments, generates short-form clips, and provides coaching reports to help streamers grow their audience.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Account and Authentication</h2>
            <p>
              You must connect a valid Twitch account via OAuth to use LevlCast. You are responsible for maintaining the security of your account and all activity that occurs under it. We do not store your Twitch password.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Subscription and Billing</h2>
            <p className="mb-3">
              LevlCast offers a free tier and a paid Pro tier at $9.99/month. Subscriptions renew automatically unless cancelled before the renewal date.
            </p>
            <p>
              Payments are processed securely via PayPal (web) and RevenueCat (iOS). We do not store your payment details. Refunds are handled on a case-by-case basis — contact us at support@levlcast.com.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to reverse-engineer or extract our AI models</li>
              <li>Abuse the Service in a way that degrades performance for other users</li>
              <li>Analyze content you do not own or have rights to</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Intellectual Property</h2>
            <p>
              You retain ownership of all content from your Twitch streams. LevlCast claims no ownership over your clips or stream data. We grant you a limited, non-exclusive license to use the Service and any outputs it generates.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee that AI-generated clips or coaching reports will meet your expectations or produce specific growth outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, LevlCast shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for violations of these Terms. You may delete your account at any time from the dashboard settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after changes are posted constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Contact</h2>
            <p>
              Questions? Email us at{" "}
              <a href="mailto:support@levlcast.com" className="text-accent-light hover:underline">
                support@levlcast.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>

      <footer className="border-t border-border py-8">
        <div className="max-w-[720px] mx-auto px-6 flex items-center justify-between text-xs text-muted">
          <Link href="/" className="hover:text-white transition-colors">← Back to LevlCast</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </main>
  );
}
