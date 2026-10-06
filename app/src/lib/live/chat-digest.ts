/**
 * A busy chat boiled down for the coach: how fast it's going and the
 * questions more than one person asked. The coach still reads the messages
 * themselves; this points at what a streamer reading a fast chat misses.
 * Plain counting, no model, so it costs nothing.
 */

export interface ChatDigest {
  /** Messages a minute over the stretch the coach was sent. */
  perMinute: number;
  /** Questions two or more people asked, most asked first. */
  asked: Array<{ text: string; people: number; lastAgoSec: number }>;
}

const QUESTION = /\?\s*$|^(what|whats|what's|how|why|when|where|who|which|is|are|do|does|did|can|could|should|would|will)\b/i;

/** The same question in slightly different words: lowercase, no punctuation or @names, first six words. */
function sameQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/@\w+/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 6)
    .join(" ");
}

export function digestChat(chat: Array<{ agoSec: number; name: string; text: string }>, windowSec = 240): ChatDigest {
  const recent = chat.filter((m) => m.agoSec >= 0 && m.agoSec <= windowSec);
  const span = Math.max(60, Math.min(windowSec, recent.reduce((a, m) => Math.max(a, m.agoSec), 0)));
  const groups = new Map<string, { text: string; people: Set<string>; lastAgoSec: number }>();
  for (const m of recent) {
    // "@Dantes what rank are you" is a question too.
    const text = m.text.trim().replace(/^(@\w+[,:]?\s*)+/, "");
    if (text.length < 6 || !QUESTION.test(text)) continue;
    const key = sameQuestion(text);
    if (key.split(" ").length < 2) continue;
    const g = groups.get(key) ?? { text, people: new Set<string>(), lastAgoSec: m.agoSec };
    g.people.add(m.name.toLowerCase());
    g.lastAgoSec = Math.min(g.lastAgoSec, m.agoSec);
    groups.set(key, g);
  }
  const asked = [...groups.values()]
    .filter((g) => g.people.size >= 2)
    .sort((a, b) => b.people.size - a.people.size || a.lastAgoSec - b.lastAgoSec)
    .slice(0, 5)
    .map((g) => ({ text: g.text.slice(0, 120), people: g.people.size, lastAgoSec: g.lastAgoSec }));
  return { perMinute: Math.round((recent.length / span) * 60), asked };
}
