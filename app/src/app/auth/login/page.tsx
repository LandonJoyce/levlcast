import type { Metadata } from "next";
import Link from "next/link";
import LoginButton from "./login-button";
import "../../home-ranked.css";
import "./login.css";

/**
 * Sign in. There's only one way in (Twitch), so the page explains that one
 * button: what Twitch shares with us, and what happens after you press it.
 *
 * It used to be a split screen with a purple gradient panel, blurred colour
 * blobs, gradient checkmarks and a sales pitch, which is the stock
 * generated sign-in page and read as one. It now uses the homepage's type,
 * colours and rules, so signing in looks like the same site.
 */

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/auth/login" },
};

const ERROR_MESSAGES: Record<string, string> = {
  no_code: "The Twitch sign-in didn't finish. Try again.",
  auth_failed: "We couldn't connect to Twitch. Try again.",
  profile_failed:
    "Your account didn't finish setting up. Try again, and if it keeps happening, email Landon@LevlCast.com.",
};

/** ?plan= values the "Go Pro" buttons send, and what to call each one. */
const PLAN_NAMES: Record<string, string> = {
  monthly: "Pro",
  annual: "Pro",
  pro_plus: "Pro Plus",
  pro_plus_annual: "Pro Plus",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  // Own keys only, so ?error=toString can't pull something off the prototype.
  const pick = (table: Record<string, string>, key: unknown) =>
    typeof key === "string" && Object.prototype.hasOwnProperty.call(table, key) ? key : null;
  const errorKey = pick(ERROR_MESSAGES, params.error);
  const planKey = pick(PLAN_NAMES, params.plan);
  const planName = planKey ? PLAN_NAMES[planKey] : null;

  return (
    <div className="ll-page v3 au">
      <header className="v3-bar">
        <Link href="/" className="v3-mark">LevlCast</Link>
        <nav className="v3-nav" aria-label="Main">
          <Link href="/analyze">Try it without an account</Link>
        </nav>
      </header>

      <main className="au-main">
        <section className="au-signin" aria-labelledby="au-title">
          <p className="v3-label">{planName ? `${planName} checkout` : "Account"}</p>
          <h1 id="au-title" className="au-h1">
            {planName ? `Sign in to get ${planName}` : "Sign in with Twitch"}
          </h1>
          <p className="au-sub">
            {planName
              ? "Your LevlCast account is your Twitch account. Checkout opens as soon as you're signed in."
              : "Your LevlCast account is your Twitch account, so there's no password to make or forget."}
          </p>

          <LoginButton error={errorKey ? ERROR_MESSAGES[errorKey] : null} plan={planKey} />

          <p className="au-perm">
            Twitch only shares your username, profile picture and email with us. LevlCast can&apos;t post, chat or
            change anything on your channel.
          </p>
          <p className="au-terms">
            By continuing you agree to the <Link href="/terms">Terms</Link> and the{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>

        <section className="au-next" aria-labelledby="au-next-title">
          <p className="v3-label" id="au-next-title">First time here?</p>
          <ol className="au-steps">
            <li>
              <span className="au-n" aria-hidden="true">01</span>
              <p>
                <b>Twitch asks if LevlCast can see your account.</b> Say yes and you land on your dashboard.
              </p>
            </li>
            <li>
              <span className="au-n" aria-hidden="true">02</span>
              <p>
                <b>Your past broadcasts show up.</b> If the list is empty, Store past broadcasts is probably off in
                your Twitch settings.
              </p>
            </li>
            <li>
              <span className="au-n" aria-hidden="true">03</span>
              <p>
                <b>We start on your latest stream right away.</b> The report is usually ready in under ten minutes,
                and it places you on the ladder.
              </p>
            </li>
          </ol>
          <p className="au-free">Free is two full reports and two clips a week. No card.</p>
        </section>
      </main>

      <footer className="au-foot">
        <p>
          Stuck signing in? Email <a href="mailto:Landon@LevlCast.com">Landon@LevlCast.com</a>
        </p>
      </footer>
    </div>
  );
}
