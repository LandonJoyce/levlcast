import { permanentRedirect } from "next/navigation";

/**
 * /v3 was where the post-match homepage was trialled before it became the
 * homepage on 2026-09-25. The link went around while it was being
 * reviewed, so it forwards to / rather than 404ing.
 */
export default function V3Redirect() {
  permanentRedirect("/");
}
