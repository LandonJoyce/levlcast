import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { verifyOptOutLink } from "@/lib/email-optout";
import "../home-ranked.css";

export const metadata: Metadata = {
  title: "Email settings - LevlCast",
  robots: { index: false, follow: false },
};

/**
 * Where the Unsubscribe link in an email goes. It asks before doing
 * anything, since mail scanners open links on their own; the button posts
 * to /api/email/unsubscribe, which sends them back here with done=1.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string; done?: string; error?: string }>;
}) {
  const { u, t, done, error } = await searchParams;
  const valid = !!u && !!t && verifyOptOutLink(u, t);

  return (
    <div className="ll-page v3">
      <SiteHeader />
      <main className="v3-sec">
        {done ? (
          <>
            <h1 className="v3-h1">You&rsquo;re unsubscribed</h1>
            <p className="v3-sub">
              No more emails about your streams. Receipts, payment problems and replies from me still come through.
              Changed your mind? Turn them back on in your account.
            </p>
            <Link href="/dashboard/settings" className="v3-btn v3-btn-ghost">
              Your account
            </Link>
          </>
        ) : valid ? (
          <>
            <h1 className="v3-h1">Stop emails about your streams?</h1>
            <p className="v3-sub">
              Those are the ones saying a report or a clip is ready, or that you have a new stream to analyze.
              Receipts, payment problems and replies from me still come through.
            </p>
            {error === "save" && <p className="v3-sub">That didn&apos;t save. Try once more.</p>}
            <form method="post" action={`/api/email/unsubscribe?u=${encodeURIComponent(u!)}&t=${encodeURIComponent(t!)}&from=page`}>
              <button type="submit" className="v3-btn">
                Unsubscribe
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="v3-h1">That link doesn&rsquo;t work</h1>
            <p className="v3-sub">You can turn emails about your streams off in your account instead.</p>
            <Link href="/dashboard/settings" className="v3-btn">
              Your account
            </Link>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
