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

/** What each plan costs and gives, for the side of the page someone buying sees. */
const PLAN_PRICE: Record<string, { price: string; per: string }> = {
  monthly: { price: "$20", per: "/month" },
  annual: { price: "$199", per: "/year" },
  pro_plus: { price: "$29.99", per: "/month" },
  pro_plus_annual: { price: "$299", per: "/year" },
};
const PRO_GETS = [
  "Every stream coached start to finish, up to 8 hours",
  "The coach in OBS listens and tells you what to say",
  "20 streams and 20 clips a month",
  "Clips post straight to YouTube",
];
const PRO_PLUS_GETS = ["Everything in Pro", "Streams up to 10 hours", "35 streams and 35 clips a month"];

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
            {planName ? `Get ${planName}` : "Sign in with Twitch"}
          </h1>
          <p className="au-sub">
            {planName
              ? "First sign in with Twitch, which is your LevlCast account. Checkout opens right after."
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

        {planKey ? (
          <section className="au-next" aria-labelledby="au-next-title">
            <p className="v3-label" id="au-next-title">What you get</p>
            <p className="au-price">
              {PLAN_PRICE[planKey].price}
              <span>{PLAN_PRICE[planKey].per}</span>
            </p>
            <ul className="au-get">
              {(planKey.startsWith("pro_plus") ? PRO_PLUS_GETS : PRO_GETS).map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <p className="v3-label au-then">What happens next</p>
            <ol className="au-steps">
              <li>
                <span className="au-n" aria-hidden="true">1</span>
                <p>
                  <b>Twitch asks if LevlCast can see your account.</b> Say yes.
                </p>
              </li>
              <li>
                <span className="au-n" aria-hidden="true">2</span>
                <p>
                  <b>Checkout opens.</b> Stripe takes the payment, and you can cancel anytime from your account.
                </p>
              </li>
              <li>
                <span className="au-n" aria-hidden="true">3</span>
                <p>
                  <b>Your next stream gets coached start to finish.</b> The coach in OBS starts listening too.
                </p>
              </li>
            </ol>
          </section>
        ) : (
          <section className="au-next" aria-labelledby="au-next-title">
            <p className="v3-label" id="au-next-title">First time here?</p>
            <ol className="au-steps">
              <li>
                <span className="au-n" aria-hidden="true">1</span>
                <p>
                  <b>Twitch asks if LevlCast can see your account.</b> Say yes and you&apos;re in.
                </p>
              </li>
              <li>
                <span className="au-n" aria-hidden="true">2</span>
                <p>
                  <b>Your past broadcasts show up.</b> If the list is empty, Store past broadcasts is probably off in
                  your Twitch settings.
                </p>
              </li>
              <li>
                <span className="au-n" aria-hidden="true">3</span>
                <p>
                  <b>We start your first report right away.</b> It&apos;s usually ready in about ten minutes, and it
                  places you on the ladder.
                </p>
              </li>
            </ol>
            <p className="au-free">Free is a report every week and 6 clips a month, no card. Each free report coaches the first 2 hours of a stream.</p>
          </section>
        )}
      </main>

      <footer className="au-foot">
        <p>
          Stuck signing in? Email <a href="mailto:Landon@LevlCast.com">Landon@LevlCast.com</a>
        </p>
      </footer>
    </div>
  );
}
