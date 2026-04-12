# LevlCast Backlog

Tasks are listed in priority order. Claude works top to bottom unless told otherwise.
Just write a task on its own line starting with `- [ ]`. Add a line below it starting with `Context:` if it needs explanation.

---

## Pending

- [ ] Research streamer feature requests
      Context: Go through Twitch subreddits, streamer forums, product feedback. Find features streamers wish they had that LevlCast could realistically build. Filter to coaching, clips, growth — not overlays, alerts, chat bots. Output a ranked list with reasoning before building anything.

- [ ] Evaluate and implement qualifying features from research
      Context: Take the ranked list from above. For each: does it fit LevlCast, do we have the data, is it Pro or Free? Only build the ones that pass. Skip anything out of scope or unsupported by current data.

- [ ] Fix any errors introduced by new features
      Context: After each new feature, check existing pages still work. Run TypeScript check. Verify imports, props, and API routes haven't broken.

- [ ] Audit new features for security issues
      Context: Check for unprotected API routes, exposed service role keys, unvalidated inputs, missing RLS, open redirects.

- [ ] UI/UX spacing and visual pass
      Context: Go through every dashboard page. Fix anything cramped, misaligned, or inconsistent. Check mobile too. Polish only — no new features.

- [ ] Read through reddit/r/newstreamers and /r/twitch and check out what people are upset about. See if its relevant to LevlCast in a way we could help.

- [ ] Save any info to remind me for later of your findings

- [ ] We don't want to over clutter the website with too many options but make them fit and work together UX style flow. We want the streamers/users to know what they want to do with the tools. 

- [ ] 


---

## Completed

<!-- Move finished tasks here with [x] when done -->
