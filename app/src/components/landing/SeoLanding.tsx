import type { ReactNode } from "react";
import Link from "next/link";
import FaqAccordion from "@/components/FaqAccordion";
import UrlPasteHero from "./UrlPasteHero";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

/**
 * The layout the search landing pages share (/twitch-vod-analyzer,
 * /twitch-clip-generator, /twitch-stream-coach). They used to be three
 * copies of a generic SaaS template: gradient headline, glowing button,
 * card grids, checkmark lists. Now they're the homepage's own layout with
 * different words: a hero with the paste box, one section of what it
 * does, how it works, questions, and links to the other pages.
 *
 * Needs the `ll-page v3` wrapper's styles: import home-ranked.css and
 * seo.css in the page, as each of them does.
 */

export interface SeoLandingProps {
  /** Small label above the headline, usually the search term. */
  label: string;
  title: string;
  intro: ReactNode;
  /** Right-hand side of the hero. */
  visual: ReactNode;
  what: { label: string; title: string; rows: { k: string; v: ReactNode }[]; note?: ReactNode };
  how: { title: string; steps: string[] };
  faq: { title: string; items: { q: string; a: string }[] };
  related: { href: string; title: string; blurb: string }[];
  closer: string;
  /** Line under the paste boxes. Defaults to what the free try covers. */
  fine?: ReactNode;
  structuredData: object[];
  className?: string;
}

const FREE_TRY = "Try it free on the first 12 minutes of any stream. No account needed.";

export default function SeoLanding(p: SeoLandingProps) {
  const fine = p.fine ?? FREE_TRY;
  return (
    <div className={`ll-page v3 ${p.className ?? ""}`}>
      {p.structuredData.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <SiteHeader />

      <section className="v3-hero">
        <div>
          <p className="v3-label">{p.label}</p>
          <h1 className="sl-h1">{p.title}</h1>
          <p className="v3-sub">{p.intro}</p>
          <div className="v3-paste">
            <UrlPasteHero hint={null} />
          </div>
          <p className="v3-fine">{fine}</p>
        </div>
        <div className="sl-visual">{p.visual}</div>
      </section>

      <section className="v3-sec">
        <p className="v3-label">{p.what.label}</p>
        <h2 className="v3-h2">{p.what.title}</h2>
        <dl className="sl-rows">
          {p.what.rows.map((r) => (
            <div key={r.k}>
              <dt>{r.k}</dt>
              <dd>{r.v}</dd>
            </div>
          ))}
        </dl>
        {p.what.note && <p className="sl-note">{p.what.note}</p>}
      </section>

      <section className="v3-sec">
        <p className="v3-label">How it works</p>
        <h2 className="v3-h2">{p.how.title}</h2>
        <ol className="sl-steps">
          {p.how.steps.map((s, i) => (
            <li key={i}>
              <span className="sl-n" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p>{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="v3-sec" id="faq">
        <p className="v3-label">Questions</p>
        <h2 className="v3-h2">{p.faq.title}</h2>
        <FaqAccordion items={p.faq.items} />
      </section>

      <section className="v3-sec">
        <p className="v3-label">More from LevlCast</p>
        <ul className="sl-related">
          {p.related.map((r) => (
            <li key={r.href}>
              <Link href={r.href}>
                <span className="sl-rel-t">{r.title}</span>
                <span className="sl-rel-b">{r.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="v3-close">
        <h2 className="v3-close-h">{p.closer}</h2>
        <div className="v3-paste">
          <UrlPasteHero hint={null} />
        </div>
        <p className="v3-fine">{fine}</p>
      </section>

      <SiteFooter />
    </div>
  );
}
