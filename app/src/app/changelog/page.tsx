import { permanentRedirect } from "next/navigation";

/**
 * The public patch notes were taken off the site on 2026-09-25. Old links
 * (bookmarks, search results, shared posts) forward to the homepage rather
 * than 404ing. The entries themselves are still kept in lib/changelog.ts.
 */
export default function ChangelogRedirect() {
  permanentRedirect("/");
}
