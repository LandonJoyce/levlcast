/**
 * How much of a stream a free report coaches: the first hour. Pro coaches
 * the whole stream. In its own file with no imports so pages in the
 * browser can use it as well as the server; lib/limits.ts re-exports it and
 * explains the plans.
 *
 * It was the first 2 hours until 2026-10-12. Most free streamers run one
 * report and never come back, and a 2-hour report cost about $0.83 to make
 * against about $0.48 for an hour (transcription is billed by the minute).
 */
export const FREE_COACHED_SECONDS = 60 * 60;

/** The free part, for sentences: "Free coaches the first hour." */
export const FREE_COACHED_WORDS = FREE_COACHED_SECONDS === 3600 ? "first hour" : `first ${FREE_COACHED_SECONDS / 3600} hours`;

/** How long that is, for sentences: "Free coaches up to an hour." */
export const FREE_COACHED_SPAN = FREE_COACHED_SECONDS === 3600 ? "an hour" : `${FREE_COACHED_SECONDS / 3600} hours`;
