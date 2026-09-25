import type { Metadata } from "next";
import { changelog, type ChangeType } from "@/lib/changelog";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { ChangelogSeen } from "./changelog-seen";
import { shoulders } from "../fonts";
import "../home-ranked.css";
import "./changelog.css";

// The root layout adds "| LevlCast", so the title is just the page name.
export const metadata: Metadata = {
  title: "Patch notes",
  description: "Every LevlCast update, newest first: what's new, what got better and what got fixed.",
  alternates: { canonical: "/changelog" },
};

const TYPE_LABEL: Record<ChangeType, string> = {
  new: "New",
  improved: "Improved",
  fix: "Fix",
  removed: "Removed",
};

function fmtDate(date: string, month: "short" | "long" = "short") {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month,
    day: month === "short" ? "numeric" : undefined,
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Patch notes. Linked from the homepage ("Updates"), so most visitors
 * aren't signed in; it wears the site header and footer rather than the
 * old "Back to dashboard" link, which sent them to a login wall.
 */
export default function ChangelogPage() {
  const first = changelog[changelog.length - 1];

  return (
    <div className={`ll-page v3 cl ${shoulders.variable}`}>
      <ChangelogSeen />
      <SiteHeader />
      <main className="cl-main">
        <p className="v3-label">Updates</p>
        <h1 className="cl-h1">Patch notes</h1>
        <p className="cl-sub">
          {changelog.length} updates since {fmtDate(first.date, "long")}, newest first.
        </p>

        <ol className="cl-list">
          {changelog.map((entry, i) => (
            <li key={`${entry.version}-${entry.date}`} className="cl-entry">
              <div className="cl-meta">
                <span className="cl-ver">{entry.version}</span>
                <time className="cl-date" dateTime={entry.date}>
                  {fmtDate(entry.date)}
                </time>
                {i === 0 && <span className="cl-latest">Latest</span>}
              </div>
              <div className="cl-body">
                <h2 className="cl-title">{entry.title}</h2>
                <ul className="cl-items">
                  {entry.items.map((item, j) => (
                    <li key={j} data-type={item.type}>
                      <span className="cl-type">{TYPE_LABEL[item.type]}</span>
                      <p>{item.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </div>
  );
}
