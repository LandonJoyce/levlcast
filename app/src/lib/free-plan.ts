/**
 * How much of a stream a free report coaches: the first 2 hours. Pro
 * coaches the whole stream. In its own file with no imports so pages in the
 * browser can use it as well as the server; lib/limits.ts re-exports it and
 * explains the plans.
 */
export const FREE_COACHED_SECONDS = 2 * 60 * 60;
