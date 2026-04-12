# LevlCast Backlog

Tasks are listed in priority order. Claude works top to bottom unless told otherwise.
Just write a task on its own line starting with `- [ ]`. Add a line below it starting with `Context:` if it needs explanation.

---

## Pending

- [ ] Evaluate and implement qualifying features from research
      Context: Top opportunities from Reddit research: (1) viewer drop-off language in coaching — make retention coaching more specific, (2) burnout score more visible in dashboard, (3) clip-to-social UX flow — make the path from clip generation to posting obvious. Do NOT build chat analysis or scheduling optimization (we lack the data). Only build if it fits current data model.

- [ ] We don't want to over clutter the website with too many options but make them fit and work together UX style flow. We want the streamers/users to know what they want to do with the tools.
      Context: Review the dashboard nav and page flow. Is it obvious what order to use the tools? VODs → analyze → clips → post. Does the UI guide users through that funnel? Make it feel like a connected workflow, not a bunch of separate pages.

- [ ] 


---

## Completed

- [x] Research streamer feature requests (r/newstreamers, r/Twitch — April 2026)
- [x] Fix any errors introduced by new features (TypeScript clean)
- [x] Audit new features for security issues (rate limiting, SSRF guard, OAuth nonce audit)
- [x] UI/UX spacing and visual pass (caption duplication, sidebar spacing, empty state icon)
- [x] Read through reddit/r/newstreamers and /r/twitch for pain points
- [x] Save findings to memory
