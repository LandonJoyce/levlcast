/**
 * lib/game-keywords.ts
 *
 * Per-category vocabulary lists fed to Deepgram via the `keywords`
 * parameter so it stops mishearing common gaming terms ("desync" →
 * "this is decent", "heart thrust" → "I thought", etc.). Detection
 * runs against the VOD title — most streamers tag the game in the
 * title — and falls back to "general" when no game is recognized.
 *
 * Add patterns/terms generously; over-coverage is cheap, missed terms
 * cost user trust.
 */

export type GameCategory =
  | "mmo"
  | "fps"
  | "battle_royale"
  | "moba"
  | "fighting"
  | "card_game"
  | "racing"
  | "sandbox"
  | "general";

// Vocabulary that ships everywhere — streaming meta + casual reactions
// that Deepgram occasionally still flubs on noisy game audio.
const GENERAL: string[] = [
  "stream", "viewers", "subs", "follower", "raid", "host", "clip",
  "VOD", "Twitch", "donation", "moderator",
];

const MMO: string[] = [
  // Combat verbs / mechanics
  "cooldown", "aggro", "kited", "kiting", "crit", "proc", "desync",
  "combo", "clutch", "stunned", "stun", "dodge", "dodged", "parry",
  "block", "counter", "interrupt", "kick",
  // Roles
  "tank", "healer", "DPS", "support", "caster", "melee", "ranged",
  // Content / objectives
  "raid", "dungeon", "boss", "mob", "trash", "loot", "respawn",
  "wipe", "pull", "engage", "disengage",
  // Effects
  "buff", "debuff", "nuke", "ult", "ulti", "ultimate", "burst",
  "shield", "barrier", "instant",
  // PvP
  "1v1", "2v2", "3v3", "5v5", "guild", "GvG", "siege", "arena",
  "rated", "ladder", "rank", "MMR",
  // Common spell terms
  "heart thrust", "fireball", "blizzard", "blink", "teleport",
  "stealth", "invis", "vanish",
];

const FPS: string[] = [
  "headshot", "scope", "scoped", "wallbang", "ace", "clutch", "frag",
  "crosshair", "spray", "flick", "tap", "burst", "peek", "prefire",
  "smoke", "flash", "molly", "nade", "AWP", "AWPed", "deagle",
  "1v1", "1v3", "1v4", "1v5", "rotate", "push", "rush", "lurk",
  "anchor", "entry", "trade", "traded", "site", "bombsite",
  "defuse", "plant", "eco", "force buy", "save round", "pistol round",
  "ranked", "comp", "casual", "deathmatch", "TDM", "FFA",
];

const BATTLE_ROYALE: string[] = [
  "drop", "rotate", "third", "thirded", "knocked", "downed", "rezzed",
  "rez", "loot", "looted", "1v1", "1v3", "endgame", "zone", "circle",
  "storm", "shield", "splits", "snipe", "sniped", "third party",
  "team wipe", "gulag", "buyback", "hot drop", "wipe squad",
  "champ", "victory royale", "ring", "ult", "tac", "support legend",
];

const MOBA: string[] = [
  "gank", "ganked", "jungle", "jungler", "lane", "laner", "cs", "feed",
  "fed", "carry", "ult", "ward", "warding", "roam", "roaming", "smite",
  "flash", "tower", "turret", "minion", "wave", "stack", "objective",
  "drake", "baron", "rift", "herald", "support", "ADC", "AD", "AP",
  "mid", "top", "bot", "jg", "MR", "armor", "MS", "AS", "kited",
  "split push", "TP", "teleport", "teamfight", "skirmish",
];

const FIGHTING: string[] = [
  "frame", "frame data", "punish", "block string", "blockstring",
  "crossup", "cross up", "wakeup", "OS", "option select", "tech",
  "DI", "drive impact", "dp", "shoryuken", "ultra", "super", "EX",
  "anti air", "footsie", "spacing", "neutral", "whiff", "whiff punish",
  "hitconfirm", "hit confirm", "link", "cancel", "FADC", "RC",
  "throw tech", "armor", "parry", "perfect parry", "1f", "plus frames",
];

const CARD_GAME: string[] = [
  "deck", "draw", "mulligan", "minion", "spell", "creature", "topdeck",
  "burst", "lethal", "discount", "ramp", "control", "aggro", "midrange",
  "tempo", "value", "bomb", "removal", "counterspell", "buff", "stat",
  "mana", "cost", "rotation", "meta", "tier list",
];

const RACING: string[] = [
  "pit", "pit stop", "tyre", "tire", "compound", "DRS", "ERS", "downforce",
  "apex", "racing line", "kerb", "curb", "podium", "pole", "qually",
  "sector", "lap", "delta", "fastest lap", "overtake", "undercut",
  "overcut", "safety car", "VSC", "spin", "ghost",
];

const SANDBOX: string[] = [
  "build", "craft", "craftable", "spawn", "respawn", "biome", "ore",
  "smelt", "redstone", "enchant", "mob", "creeper", "skeleton", "raid",
  "village", "nether", "end", "elytra", "diamond", "netherite",
];

const KEYWORDS_BY_CATEGORY: Record<GameCategory, string[]> = {
  mmo: MMO,
  fps: FPS,
  battle_royale: BATTLE_ROYALE,
  moba: MOBA,
  fighting: FIGHTING,
  card_game: CARD_GAME,
  racing: RACING,
  sandbox: SANDBOX,
  general: [],
};

// Order matters: more specific patterns above broader ones.
// Whole-word \b boundaries to avoid "csgo" matching inside "csgo2is2cool".
const TITLE_GAME_PATTERNS: Array<[RegExp, GameCategory]> = [
  // FPS
  [/\b(cs:?go|counter[-\s]?strike|cs\s?2|csgo)\b/i, "fps"],
  [/\b(valorant|val(orant)?)\b/i, "fps"],
  [/\b(call of duty|cod\b|warzone|mw\d?|black ops|bo\d)\b/i, "fps"],
  [/\b(rainbow six|r6\b|r6s\b|siege)\b/i, "fps"],
  [/\b(overwatch|ow\b|ow2\b)\b/i, "fps"],
  [/\b(the finals|finals)\b/i, "fps"],
  [/\b(escape from tarkov|tarkov|eft)\b/i, "fps"],

  // Battle royale
  [/\b(apex(\s+legends)?|apex)\b/i, "battle_royale"],
  [/\b(fortnite|fn\b)\b/i, "battle_royale"],
  [/\b(pubg|playerunknown)\b/i, "battle_royale"],
  [/\b(fall guys)\b/i, "battle_royale"],

  // MOBA
  [/\b(league of legends|lol\b|league\b)\b/i, "moba"],
  [/\b(dota[\s-]?2?|dota)\b/i, "moba"],
  [/\b(smite)\b/i, "moba"],
  [/\b(heroes of the storm|hots\b)\b/i, "moba"],

  // MMO — explicit games
  [/\b(wow\b|world of warcraft|warcraft)\b/i, "mmo"],
  [/\b(ffxiv|final fantasy\s*(14|xiv))\b/i, "mmo"],
  [/\b(eso\b|elder scrolls online)\b/i, "mmo"],
  [/\b(gw2|guild wars\s*2?)\b/i, "mmo"],
  [/\b(albion|new world|lost ark)\b/i, "mmo"],
  [/\b(throne and liberty|tnl\b|t&l|tl\b)\b/i, "mmo"],
  [/\b(black desert|bdo\b)\b/i, "mmo"],
  [/\b(runescape|osrs)\b/i, "mmo"],
  // MMO — heuristic: PvP scrim shorthand like "3v3 vs", "1v1 vs"
  [/\b\d+v\d+\b.*\bvs\b/i, "mmo"],

  // Fighting
  [/\b(street fighter|sf\d|sfvi|sf6)\b/i, "fighting"],
  [/\b(tekken[\s-]?\d?|tekken)\b/i, "fighting"],
  [/\b(mortal kombat|mk\d+|mk1)\b/i, "fighting"],
  [/\b(guilty gear|gg strive|ggst)\b/i, "fighting"],
  [/\b(smash bros|melee|ultimate)\b/i, "fighting"],
  [/\b(granblue fantasy versus|gbvs)\b/i, "fighting"],

  // Card games
  [/\b(hearthstone|hs\b)\b/i, "card_game"],
  [/\b(magic the gathering|mtg|arena)\b/i, "card_game"],
  [/\b(legends of runeterra|lor\b)\b/i, "card_game"],

  // Racing
  [/\b(forza|gran turismo|gt7|f1\s?\d{2}|iracing|assetto)\b/i, "racing"],

  // Sandbox
  [/\b(minecraft|mc\b)\b/i, "sandbox"],
  [/\b(terraria|valheim|rust|7 days to die)\b/i, "sandbox"],
];

/**
 * Detect the most likely game category from a VOD title.
 * Returns "general" when no pattern matches — caller should still
 * pass a small generic boost list rather than nothing.
 */
export function detectGameCategory(title: string): GameCategory {
  if (!title) return "general";
  for (const [pattern, category] of TITLE_GAME_PATTERNS) {
    if (pattern.test(title)) return category;
  }
  return "general";
}

/**
 * Build the full keyword list (with boosts) to send to Deepgram for a
 * given category. Format: ["term:2", "another term:2", ...].
 *
 * Boost notes:
 *   - 1   default; nudges output toward the term
 *   - 2-3 strong; useful for game jargon Deepgram routinely flubs
 *   - >5  forces; risks false positives on similar-sounding words
 *
 * We use 2 for category jargon, 1 for general streaming meta.
 */
export function keywordsForCategory(category: GameCategory): string[] {
  const general = GENERAL.map((k) => `${k}:1`);
  const specific = (KEYWORDS_BY_CATEGORY[category] ?? []).map((k) => `${k}:2`);
  return [...general, ...specific];
}
