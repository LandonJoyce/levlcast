/**
 * lib/game-keywords.ts
 *
 * Vocabulary lists fed to Deepgram via the `keywords` parameter so it
 * stops mishearing common gaming terms ("desync" → "this is decent",
 * "heart thrust" → "I thought", etc.).
 *
 * Three layers stack at transcription time:
 *   1. GENERAL          — streaming meta + casual reactions, every VOD
 *   2. CATEGORY         — broad MMO/FPS/MOBA/etc. jargon
 *   3. GAME (specific)  — champion names, abilities, maps, weapons for
 *                         the actual game detected from the VOD title
 *
 * Detection runs against the VOD title — most streamers tag the game
 * there. Add patterns/terms generously; over-coverage is cheap, missed
 * terms cost user trust.
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

export type GameId =
  | "league_of_legends"
  | "valorant"
  | "cs2"
  | "fortnite"
  | "apex"
  | "call_of_duty"
  | "marvel_rivals"
  | "wow"
  | "ffxiv"
  | "throne_and_liberty"
  | "hearthstone"
  | "diablo_4";

export interface GameDetection {
  category: GameCategory;
  gameId: GameId | null;
}

// ─── Layer 1: streaming meta ────────────────────────────────────────────────
const GENERAL: string[] = [
  "stream", "viewers", "subs", "follower", "raid", "host", "clip",
  "VOD", "Twitch", "donation", "moderator",
];

// ─── Layer 2: per-category jargon ───────────────────────────────────────────
const MMO: string[] = [
  "cooldown", "aggro", "kited", "kiting", "crit", "proc", "desync",
  "combo", "clutch", "stunned", "stun", "dodge", "dodged", "parry",
  "block", "counter", "interrupt", "kick",
  "tank", "healer", "DPS", "support", "caster", "melee", "ranged",
  "raid", "dungeon", "boss", "mob", "trash", "loot", "respawn",
  "wipe", "pull", "engage", "disengage",
  "buff", "debuff", "nuke", "ult", "ulti", "ultimate", "burst",
  "shield", "barrier", "instant",
  "1v1", "2v2", "3v3", "5v5", "guild", "GvG", "siege", "arena",
  "rated", "ladder", "rank", "MMR",
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
  "champ", "victory royale", "ring", "tac", "support legend",
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

// ─── Layer 3: per-game vocab ────────────────────────────────────────────────
// Curated for the most popular games on Twitch — covers the majority
// of streamers automatically. Keep each list focused (~30 terms) on
// the words Deepgram is likeliest to flub: champion/agent names,
// abilities, maps, classes, signature weapons.

const KEYWORDS_BY_GAME: Record<GameId, string[]> = {
  league_of_legends: [
    // Top picked champions
    "Yasuo", "Zed", "Yone", "Akali", "Riven", "Lee Sin", "Thresh",
    "LeBlanc", "Vayne", "Jhin", "Caitlyn", "Lulu", "Ahri", "Sett",
    "Darius", "Garen", "Master Yi", "Kai'Sa", "Jinx", "Lucian",
    "Brand", "Pyke", "Senna", "Aphelios", "Briar", "K'Sante",
    // Spells / mechanics
    "flash", "smite", "ignite", "exhaust", "cleanse", "teleport",
    "ult", "gank", "dive", "objective", "drake", "baron", "herald",
  ],

  valorant: [
    // Agents
    "Jett", "Phoenix", "Sage", "Sova", "Reyna", "Brimstone", "Omen",
    "Killjoy", "Cypher", "Viper", "Raze", "Yoru", "Astra", "Skye",
    "Chamber", "Neon", "Fade", "Harbor", "Gekko", "Deadlock", "Iso",
    "Clove", "Tejo", "Vyse", "KAY/O",
    // Abilities / verbs
    "smoke", "flash", "dart", "tailwind", "dash", "slow orb", "ult",
    "snake bite", "trapwire", "alarmbot", "Operator", "Vandal",
    "Phantom", "Sheriff",
    // Maps
    "Ascent", "Bind", "Haven", "Split", "Icebox", "Breeze", "Fracture",
    "Pearl", "Lotus", "Sunset", "Abyss",
  ],

  cs2: [
    // Maps
    "Mirage", "Inferno", "Nuke", "Overpass", "Vertigo", "Anubis",
    "Ancient", "Dust", "Dust 2", "Train", "Office",
    // Weapons
    "AK", "M4A1", "M4A4", "AWP", "Deagle", "USP", "Glock", "P250",
    "MP9", "Famas", "Galil", "Negev", "Scout", "Bizon",
    // Map callouts
    "A site", "B site", "mid", "palace", "ramp", "banana", "jungle",
    "apartments", "library", "fountain", "connector", "catwalk",
    // Mechanics
    "ace", "clutch", "eco", "force", "anti-eco", "save", "lurk",
  ],

  fortnite: [
    // Items / weapons
    "mini", "big pot", "slurp", "med kit", "shield potion", "chug jug",
    "mythic", "pump", "SCAR", "Striker", "Reaper", "tac SMG",
    // Locations (rotating but classic ones stay relevant)
    "Tilted Towers", "Pleasant Park", "Salty Springs", "Retail Row",
    "Lazy Lake", "Fatal Fields", "Loot Lake",
    // Verbs / mechanics
    "rotate", "build", "edit", "ramp rush", "90s", "box fight",
    "take fights", "third party", "height", "drop", "high ground",
    "wall replace", "double pump",
  ],

  apex: [
    // Legends
    "Wraith", "Pathfinder", "Bloodhound", "Bangalore", "Caustic",
    "Octane", "Mirage", "Lifeline", "Loba", "Valkyrie", "Seer",
    "Ash", "Mad Maggie", "Conduit", "Vantage", "Newcastle", "Catalyst",
    "Ballistic", "Alter", "Revenant",
    // Abilities / movement
    "phase", "grapple", "beacon", "smoke", "gas", "jump pad", "decoy",
    "drone", "ult accel",
    // Signature weapons
    "R-99", "Wingman", "Kraber", "Sentinel", "Mastiff", "Charge Rifle",
    "Volt", "Devotion", "Mozambique", "Peacekeeper",
  ],

  call_of_duty: [
    // Modes
    "Resurgence", "Plunder", "Warzone", "Multiplayer", "Hardcore",
    // Weapons
    "AK-47", "M4", "MP5", "Kar98", "HDR", "Bruen", "Grau", "FAL",
    "FAMAS", "Krig", "Cold War", "Type 25",
    // Verbs / streaks
    "gulag", "buyback", "loadout", "contract", "killstreak", "UAV",
    "VTOL", "AC130", "scorestreak", "specialist", "dead silence",
    // Maps
    "Verdansk", "Caldera", "Al Mazrah", "Ashika Island", "Vondel",
    "Urzikstan",
  ],

  marvel_rivals: [
    // Heroes
    "Spider-Man", "Iron Man", "Hulk", "Magneto", "Storm", "Wolverine",
    "Black Panther", "Doctor Strange", "Loki", "Thor", "Hela", "Mantis",
    "Luna Snow", "Jeff", "Rocket", "Groot", "Star-Lord", "Venom",
    "Magik", "Psylocke", "Squirrel Girl", "Adam Warlock", "Cloak and Dagger",
    "Moon Knight", "Namor", "Punisher", "Scarlet Witch", "Winter Soldier",
    "Iron Fist", "Black Widow", "Captain America", "Mister Fantastic",
    "Invisible Woman",
    // Abilities / roles
    "Vanguard", "Duelist", "Strategist", "Team-Up", "ult",
  ],

  wow: [
    // Classes
    "Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Death Knight",
    "Shaman", "Mage", "Warlock", "Monk", "Druid", "Demon Hunter",
    "Evoker",
    // Common spells
    "Frostbolt", "Fireball", "Pyroblast", "Shadowfury", "Holy Light",
    "Sinister Strike", "Eviscerate", "Mortal Strike", "Bloodthirst",
    "Stormstrike", "Wrath", "Lava Burst",
    // Mechanics
    "rotation", "BiS", "M+", "mythic", "raid", "parse", "log", "sim",
    "ilvl", "LFR", "LFG", "tier set", "crest",
  ],

  ffxiv: [
    // Jobs (top played)
    "Paladin", "Warrior", "Dark Knight", "Gunbreaker", "White Mage",
    "Scholar", "Astrologian", "Sage", "Monk", "Dragoon", "Ninja",
    "Samurai", "Reaper", "Bard", "Machinist", "Dancer", "Black Mage",
    "Summoner", "Red Mage", "Pictomancer", "Viper",
    // Common abilities
    "Holy", "Glare", "Helios", "Embolden", "Technical Step",
    "Standard Step", "Wildfire", "Drill", "Hyperdrive",
    // Mechanics
    "Savage", "Ultimate", "Extreme", "raid wide", "AoE", "dot",
    "trial", "tank buster", "stack", "spread",
  ],

  throne_and_liberty: [
    // Weapons
    "Greatsword", "Sword and Shield", "Bow", "Crossbow", "Dagger",
    "Wand", "Staff", "Spear", "Tome",
    // Greatsword
    "Heart Thrust", "Devastating Tornado", "Vital Force",
    "Brutal Incision", "Stunning Blow",
    // Crossbow
    "Bombardment", "Roaring Shot", "Brutal Arrow Volley",
    // Wand / Tome (healer)
    "Cleansing Aura", "Curse Explosion", "Inquisitor's Smite",
    "Sleep Curse", "Karmic Haze", "Restoration Wave",
    // Daggers / Bow / Staff
    "Shadow Step", "Dancing Daggers", "Chain Lightning",
    "Fireball Barrage", "Inferno Wave",
    // Mechanics
    "evade", "bind", "silence", "weakened", "guild", "siege",
  ],

  hearthstone: [
    // Heroes / classes
    "Jaina", "Garrosh", "Anduin", "Rexxar", "Uther", "Valeera",
    "Thrall", "Malfurion", "Gul'dan", "Reno", "Death Knight",
    "Demon Hunter",
    // Mechanics
    "Battlecry", "Deathrattle", "Taunt", "Charge", "Rush", "Lifesteal",
    "Discover", "Spell Damage", "Reborn", "Outcast", "Frenzy",
    // Card game terms
    "minion", "secret", "weapon", "hero power", "mana crystal",
    "fatigue", "topdeck", "lethal", "tempo",
  ],

  diablo_4: [
    // Classes
    "Barbarian", "Sorcerer", "Druid", "Necromancer", "Rogue",
    "Spiritborn",
    // Skills
    "Whirlwind", "Hammer of the Ancients", "HOTA", "Earthquake",
    "Frozen Orb", "Ice Shards", "Chain Lightning", "Bone Spear",
    "Decompose", "Pulverize", "Shred", "Lightning Spear",
    // Mechanics
    "glyph", "paragon", "aspect", "codex", "helltide", "world boss",
    "nightmare dungeon", "Pit", "masterworking", "tempering",
    "Greater Affix",
  ],
};

// ─── Title detection ────────────────────────────────────────────────────────
// Specific games checked first; categories below as fallback. Whole-word
// boundaries to avoid "csgo" matching inside random text.
const GAME_PATTERNS: Array<[RegExp, GameDetection]> = [
  [/\b(league of legends|lol\b|league)\b/i, { gameId: "league_of_legends", category: "moba" }],
  [/\b(valorant|val(orant)?)\b/i, { gameId: "valorant", category: "fps" }],
  [/\b(cs:?go|counter[-\s]?strike|cs\s?2|csgo|cs2)\b/i, { gameId: "cs2", category: "fps" }],
  [/\b(fortnite|fn\b)\b/i, { gameId: "fortnite", category: "battle_royale" }],
  [/\b(apex(\s+legends)?|apex)\b/i, { gameId: "apex", category: "battle_royale" }],
  [/\b(call of duty|cod\b|warzone|mw\d?|black ops|bo\d)\b/i, { gameId: "call_of_duty", category: "fps" }],
  [/\b(marvel rivals|rivals)\b/i, { gameId: "marvel_rivals", category: "fps" }],
  [/\b(wow\b|world of warcraft|warcraft)\b/i, { gameId: "wow", category: "mmo" }],
  [/\b(ffxiv|final fantasy\s*(14|xiv))\b/i, { gameId: "ffxiv", category: "mmo" }],
  [/\b(throne and liberty|tnl\b|t&l|tl\b)\b/i, { gameId: "throne_and_liberty", category: "mmo" }],
  [/\b(hearthstone|hs\b)\b/i, { gameId: "hearthstone", category: "card_game" }],
  [/\b(diablo\s*4|d4\b|diablo iv)\b/i, { gameId: "diablo_4", category: "mmo" }],
];

// Category-only patterns for games we recognize but don't have a
// dedicated pack for yet. Falls through to "general" if nothing matches.
const CATEGORY_ONLY_PATTERNS: Array<[RegExp, GameCategory]> = [
  // FPS
  [/\b(rainbow six|r6\b|r6s\b|siege)\b/i, "fps"],
  [/\b(overwatch|ow\b|ow2\b)\b/i, "fps"],
  [/\b(the finals|finals)\b/i, "fps"],
  [/\b(escape from tarkov|tarkov|eft)\b/i, "fps"],
  // Battle royale
  [/\b(pubg|playerunknown)\b/i, "battle_royale"],
  [/\b(fall guys)\b/i, "battle_royale"],
  // MOBA
  [/\b(dota[\s-]?2?|dota)\b/i, "moba"],
  [/\b(smite)\b/i, "moba"],
  [/\b(heroes of the storm|hots\b)\b/i, "moba"],
  // MMO
  [/\b(eso\b|elder scrolls online)\b/i, "mmo"],
  [/\b(gw2|guild wars\s*2?)\b/i, "mmo"],
  [/\b(albion|new world|lost ark)\b/i, "mmo"],
  [/\b(black desert|bdo\b)\b/i, "mmo"],
  [/\b(runescape|osrs)\b/i, "mmo"],
  // Heuristic: PvP scrim shorthand like "3v3 vs ..." → MMO
  [/\b\d+v\d+\b.*\bvs\b/i, "mmo"],
  // Fighting
  [/\b(street fighter|sf\d|sfvi|sf6)\b/i, "fighting"],
  [/\b(tekken[\s-]?\d?|tekken)\b/i, "fighting"],
  [/\b(mortal kombat|mk\d+|mk1)\b/i, "fighting"],
  [/\b(guilty gear|gg strive|ggst)\b/i, "fighting"],
  [/\b(smash bros|melee|ultimate)\b/i, "fighting"],
  // Card
  [/\b(magic the gathering|mtg|arena)\b/i, "card_game"],
  [/\b(legends of runeterra|lor\b)\b/i, "card_game"],
  // Racing
  [/\b(forza|gran turismo|gt7|f1\s?\d{2}|iracing|assetto)\b/i, "racing"],
  // Sandbox
  [/\b(minecraft|mc\b)\b/i, "sandbox"],
  [/\b(terraria|valheim|rust|7 days to die)\b/i, "sandbox"],
];

/**
 * Detect the most likely game (and its category) from a VOD title.
 * Falls back to category-only when the game isn't in our pack list,
 * and to "general" when nothing matches.
 */
export function detectGame(title: string): GameDetection {
  if (!title) return { category: "general", gameId: null };
  for (const [pattern, detection] of GAME_PATTERNS) {
    if (pattern.test(title)) return detection;
  }
  for (const [pattern, category] of CATEGORY_ONLY_PATTERNS) {
    if (pattern.test(title)) return { category, gameId: null };
  }
  return { category: "general", gameId: null };
}

/**
 * Build the full keyword list (with boosts) to send to Deepgram.
 * Stacks all three layers; capped well under Deepgram's 200-keyword
 * per-request limit.
 *
 * Boosts:
 *   1 — general meta (light nudge)
 *   2 — category jargon (gameplay verbs / nouns)
 *   3 — game-specific vocab (champion/ability/map names — likeliest to flub)
 */
export function keywordsForGame(detection: GameDetection): string[] {
  const general = GENERAL.map((k) => `${k}:1`);
  const category = (KEYWORDS_BY_CATEGORY[detection.category] ?? []).map((k) => `${k}:2`);
  const game = detection.gameId
    ? KEYWORDS_BY_GAME[detection.gameId].map((k) => `${k}:3`)
    : [];
  return [...general, ...category, ...game];
}

// Backwards-compat shim — old callers that only need the category enum.
export function detectGameCategory(title: string): GameCategory {
  return detectGame(title).category;
}
export function keywordsForCategory(category: GameCategory): string[] {
  return keywordsForGame({ category, gameId: null });
}
