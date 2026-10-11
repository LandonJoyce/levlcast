/**
 * Which language a streamer talks in, from their own transcript, so their
 * report can be written in it.
 *
 * Counts common little words that only one language uses ("pero", "você",
 * "c'est", "nicht"...). A report only switches when the stream is clearly
 * one language: enough words to judge, and that language far ahead of every
 * other one. An English streamer who drops some Spanish, a bilingual stream,
 * or a quiet one stays in English. Getting this wrong is worse than not
 * doing it, so every doubt falls back to English.
 */

export interface StreamLanguage {
  code: "es" | "pt" | "fr" | "de" | "it";
  /** The name the coach is told to write in. */
  name: string;
}

/**
 * Words that mark one language and not the others. Words two languages
 * share ("que", "la", "les", "mais", "non", "die", "chat") are left out on
 * purpose: they'd blur the languages together.
 */
const MARKERS: Record<StreamLanguage["code"] | "en", string[]> = {
  en: [
    "the", "and", "you", "that", "is", "it's", "what", "this", "i'm", "don't", "with", "just", "like",
    "have", "are", "they", "we", "my", "your", "can", "know", "get", "going", "gonna", "right", "yeah",
    "there", "think", "really", "because", "about", "would", "that's", "let's", "she",
  ],
  es: [
    "el", "los", "las", "y", "es", "pero", "muy", "qué", "eso", "esto", "pues", "bueno", "también",
    "hay", "yo", "ahora", "tengo", "estoy", "cómo", "aquí", "chicos", "gracias", "ella", "ellos",
    "nosotros", "puedo", "hacer", "verdad", "mucho", "ya", "sí", "creo", "entonces", "ahí",
  ],
  pt: [
    "não", "você", "isso", "uma", "com", "muito", "é", "os", "então", "tá", "eu", "vou", "vai",
    "também", "aí", "né", "agora", "tudo", "obrigado", "obrigada", "galera", "fazer", "aqui", "ele",
    "nós", "acho", "sim", "beleza", "tô",
  ],
  fr: [
    "c'est", "et", "je", "pas", "ça", "une", "des", "avec", "oui", "très", "vous", "nous", "est",
    "j'ai", "suis", "alors", "voilà", "quoi", "merci", "fait", "peu", "aussi", "comme", "tout",
    "faire", "ouais", "bah",
  ],
  de: [
    "der", "das", "und", "ist", "nicht", "ich", "ein", "eine", "mit", "auf", "zu", "ja", "aber",
    "auch", "wir", "jetzt", "mal", "schon", "noch", "doch", "gut", "danke", "habe", "bin", "kann",
    "nur", "oder", "sehr", "gibt",
  ],
  it: [
    "che", "è", "sono", "questo", "anche", "molto", "perché", "ci", "ho", "gli", "della", "ragazzi",
    "grazie", "allora", "adesso", "bene", "però", "fare", "tutto", "così", "dai", "questa", "vabbè", "boh",
  ],
};

const NAMES: Record<StreamLanguage["code"], string> = {
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
};

const LOOKUP = new Map<string, Array<keyof typeof MARKERS>>();
for (const [lang, words] of Object.entries(MARKERS) as Array<[keyof typeof MARKERS, string[]]>) {
  for (const w of words) LOOKUP.set(w, [...(LOOKUP.get(w) ?? []), lang]);
}

/** Below this many marker words there isn't enough talking to judge. */
const MIN_HITS = 60;
/** The winner needs at least this share of all marker words... */
const MIN_SHARE = 0.65;
/** ...and this many times the runner-up. */
const MIN_LEAD = 3;

export function detectStreamLanguage(text: string): StreamLanguage | null {
  const counts = new Map<keyof typeof MARKERS, number>();
  let total = 0;
  for (const raw of text.toLowerCase().split(/[^\p{L}']+/u)) {
    const token = raw.replace(/^'+|'+$/g, "").replace(/’/g, "'");
    const langs = LOOKUP.get(token);
    if (!langs || langs.length !== 1) continue;
    counts.set(langs[0], (counts.get(langs[0]) ?? 0) + 1);
    total++;
  }
  if (total < MIN_HITS) return null;
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (!top || top[0] === "en") return null;
  if (top[1] / total < MIN_SHARE) return null;
  if (second && top[1] < second[1] * MIN_LEAD) return null;
  const code = top[0] as StreamLanguage["code"];
  return { code, name: NAMES[code] };
}
