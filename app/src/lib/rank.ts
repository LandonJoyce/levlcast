/**
 * Streamer rank.
 *
 * Replaces "you scored 28 out of 100" with a ladder you climb. Same
 * underlying analysis, completely different relationship to it: a score is
 * a verdict, a rank is a starting point. Nobody quits a game for being
 * Iron; they grind out of Iron.
 *
 * ── THE CENTRAL DESIGN DECISION ────────────────────────────────────────
 * Points move on how a stream compares to YOUR OWN recent form, not on the
 * absolute score. If gains came from the raw number, almost every user
 * would lose points forever, because most streams land in the 30s and 40s.
 * That is the report card we are trying to get away from.
 *
 * Grading against your own rolling average means a 35 that follows four
 * 28s is a win, and it should be — that streamer genuinely improved. It
 * also means the ladder works identically for someone at 25 and someone at
 * 75, which is what lets a small streamer believe in it.
 *
 * ── WHY IT IS ASYMMETRIC ───────────────────────────────────────────────
 * Losses are deliberately worth less than wins. This is not "fair" and is
 * not meant to be: the product's job is to keep someone streaming and
 * improving, and a ladder that punishes a bad night as hard as it rewards
 * a good one makes people stop playing. Games that want retention all do
 * this. Games that want prestige do the opposite.
 */

export interface RankTier {
  name: string;
  /** Points at which this tier begins. */
  floor: number;
}

/**
 * Four divisions per tier, 100 points each, so a tier spans 400. This is
 * the exact shape of the ladders these users already grind, which means
 * zero explanation is required anywhere in the UI.
 */
export const DIVISION_SIZE = 100;
export const DIVISIONS_PER_TIER = 4;
export const TIER_SIZE = DIVISION_SIZE * DIVISIONS_PER_TIER;

export const TIERS: RankTier[] = [
  { name: "Iron", floor: 0 },
  { name: "Bronze", floor: 400 },
  { name: "Silver", floor: 800 },
  { name: "Gold", floor: 1200 },
  { name: "Platinum", floor: 1600 },
  { name: "Diamond", floor: 2000 },
  { name: "Master", floor: 2400 },
  { name: "Grandmaster", floor: 2800 },
];

/** Emblem colour per tier, for anything that tints by rank. */
export const TIER_HEX: Record<string, string> = {
  Iron: "#9AA0A6",
  Bronze: "#C1804B",
  Silver: "#B8C2CC",
  Gold: "#E3B341",
  Platinum: "#4FD1B9",
  Diamond: "#7CC5F5",
  Master: "#C084FC",
  Grandmaster: "#A855F7",
};

/**
 * The top two tiers have no divisions.
 *
 * Same convention as the ladder this borrows from, and it exists for a
 * reason: above a certain point the interesting question stops being
 * "which quarter of the tier" and starts being "how far past the bar", so
 * these report a raw number instead of a grid position.
 */
const DIVISIONLESS = new Set(["Master", "Grandmaster"]);

export const MAX_POINTS = 4000;

export interface Rank {
  points: number;
  tier: string;
  /** 4 down to 1, matching the ladders this borrows from. Master has none. */
  division: number | null;
  /** 0-100, progress through the current division. Master reports raw overflow. */
  progress: number;
  label: string;
}

export function rankFromPoints(rawPoints: number): Rank {
  const points = Math.max(0, Math.min(MAX_POINTS, Math.round(rawPoints)));

  let tier = TIERS[0];
  for (const t of TIERS) {
    if (points >= t.floor) tier = t;
  }

  if (DIVISIONLESS.has(tier.name)) {
    const nextFloor = TIERS.find((t) => t.floor > tier.floor)?.floor ?? MAX_POINTS;
    const band = Math.max(1, nextFloor - tier.floor);
    return {
      points,
      tier: tier.name,
      division: null,
      progress: Math.min(100, Math.round(((points - tier.floor) / band) * 100)),
      label: tier.name,
    };
  }

  const intoTier = points - tier.floor;
  const divisionIndex = Math.min(
    DIVISIONS_PER_TIER - 1,
    Math.floor(intoTier / DIVISION_SIZE)
  );
  // Division IV is the bottom of a tier and I is the top, so the number
  // counts DOWN as you climb.
  const division = DIVISIONS_PER_TIER - divisionIndex;
  const progress = Math.round(((intoTier % DIVISION_SIZE) / DIVISION_SIZE) * 100);

  return {
    points,
    tier: tier.name,
    division,
    progress,
    label: `${tier.name} ${romanise(division)}`,
  };
}

function romanise(n: number): string {
  return ["", "I", "II", "III", "IV"][n] ?? String(n);
}

/**
 * Where a brand new streamer starts.
 *
 * Placed off the absolute score, because there is no history to compare
 * against yet, but floored at Iron II. A first experience of "you are the
 * lowest rank that exists" is exactly the moment people close the tab, and
 * we have the data showing they do.
 */
export function placementPoints(score: number): number {
  // Iron II up to Gold IV.
  //
  // The first version ran Bronze IV to Platinum IV and put nearly every
  // backfilled user into Silver. Narrowing the destination range helped,
  // but it treated the symptom: the input was still being read as though
  // it used the full 0-100.
  //
  // It does not. Measured over 150 real analysed streams:
  //
  //   min 8  ·  p25 38  ·  median 52  ·  p75 58  ·  max 75
  //
  // Nothing has ever scored above 75 or below 8, and a third of all
  // streams land between 50 and 59. Mapping 0-100 onto the ladder meant
  // only the middle third of the ladder was ever reachable, so two
  // completely different streams — a two hour lore playthrough and a one
  // hour story game — both scored 52 and both placed at exactly 720.
  //
  // The fix is to map the band scores actually occupy, not the band the
  // scale advertises. Tested against the first-stream score of all 57
  // users with analysed streams:
  //
  //   15-70  ->  Iron 6   Bronze 16  Silver 33  Gold 2   (a Silver pile)
  //   30-68  ->  Iron 10  Bronze 26  Silver 19  Gold 2
  //   30-62  ->  Iron 10  Bronze 16  Silver 21  Gold 10  (18% pinned at cap)
  //
  // 30-68 wins. Not because it is the most even — 30-62 is — but because
  // it puts almost nobody at the ceiling. A band that caps 18% of first
  // streams at Gold IV hands out the top of the placement range for one
  // good night and leaves them nothing to climb toward, which is the same
  // failure as everyone sharing a rank, just at the other end.
  //
  // The median still lands at Bronze I. That is deliberate: a new user
  // should be able to see Silver above them on day one.
  const SCORE_FLOOR = 30;
  const SCORE_CEILING = 68;
  const IRON_II = 200;
  const GOLD_IV = 1200;

  const clamped = Math.max(SCORE_FLOOR, Math.min(SCORE_CEILING, score));
  const position = (clamped - SCORE_FLOOR) / (SCORE_CEILING - SCORE_FLOOR);
  return Math.round(IRON_II + position * (GOLD_IV - IRON_II));
}

export interface DeltaInput {
  /** This stream's overall_score, 0-100. */
  score: number;
  /** Scores of up to the last 5 analysed streams, most recent first. */
  recentScores: number[];
  /** Current rating. */
  points: number;
  /** True if the previous stream also lost points — gates demotion. */
  lastWasLoss: boolean;
}

export interface DeltaResult {
  delta: number;
  points: number;
  from: Rank;
  to: Rank;
  /** Set when the TIER changed. This is the promotion moment. */
  tierChange: "up" | "down" | null;
  /** Set when only the division changed. Smaller, more frequent win. */
  divisionChange: "up" | "down" | null;
  /** True when a demotion was blocked by the shield. */
  shielded: boolean;
  reason: string;
}

/** Biggest single-stream swing. One bad night costs points, never a tier. */
const MAX_GAIN = 70;
const MAX_LOSS = 25;
/** Losses count for less than wins. See the header for why. */
const LOSS_WEIGHT = 0.45;
/** Awarded for streaming and analysing at all, before performance. */
const PARTICIPATION = 10;
/** How many points a single point of score improvement is worth. */
const SCORE_TO_POINTS = 2;

/**
 * Absolute quality, not just improvement.
 *
 * The first version paid ONLY for beating your own recent average, which
 * had a flaw worth naming: a streamer who is consistently good is
 * consistently not improving, so someone scoring 65 every night climbed at
 * the same crawl as someone scoring 25 every night. That is backwards. A
 * good stream should pay because it was good.
 *
 * QUALITY_BASELINE is roughly a mediocre stream. Above it you earn every
 * time, below it you bleed slowly. Improvement still counts on top, so the
 * small streamer grinding from 25 to 35 is still rewarded for the climb —
 * they just no longer out-earn someone holding a 70.
 */
/**
 * Measured at 52: the median of 150 real analysed streams.
 *
 * This was 35, picked as "roughly a mediocre stream" before there was
 * data. The actual median is 52, which meant the typical stream scored
 * seventeen points above baseline and earned quality points for being
 * completely ordinary. Stack participation on top and every user gained
 * rating almost every time they analysed anything. A ladder where nobody
 * goes down is a participation counter.
 *
 * At the true median an average stream is roughly neutral: you hold your
 * rank by being consistent, and you climb by being better than your own
 * middle. Below it you bleed slowly, which is the pressure that makes
 * climbing mean something.
 */
const QUALITY_BASELINE = 52;
const QUALITY_WEIGHT = 1.2;

/**
 * How fast the ladder moves, by where you are on it.
 *
 * Tuned against real usage rather than vibes. A Pro user analyses roughly
 * 15 streams a month, and a division is 100 points, so the question is how
 * many analysed streams a division should cost at each height.
 *
 * At the bottom a steady streamer clears a division in three or four
 * streams, which is roughly weekly progress and enough to feel the ladder
 * working. Approaching Master the same performance takes three times as
 * long, so the top is a grind that means something.
 *
 * The first version of this started at 1.0 and gave four points for
 * holding form at Bronze, which is twenty-five streams per division. That
 * is a treadmill, not a climb.
 */
const EARLY_MULTIPLIER = 1.6;
const LATE_MULTIPLIER = 0.3;

export function computeDelta(input: DeltaInput): DeltaResult {
  const from = rankFromPoints(input.points);

  // No history: this is a placement, not a climb.
  if (input.recentScores.length === 0) {
    const placed = placementPoints(input.score);
    return {
      delta: placed - input.points,
      points: placed,
      from,
      to: rankFromPoints(placed),
      tierChange: null,
      divisionChange: null,
      shielded: false,
      reason: "Placement stream",
    };
  }

  const window = input.recentScores.slice(0, 5);
  const average = window.reduce((sum, s) => sum + s, 0) / window.length;
  const diff = input.score - average;

  // Three parts: how good the stream was, how much better than your recent
  // form, and showing up at all.
  const quality = (input.score - QUALITY_BASELINE) * QUALITY_WEIGHT;
  const improvement = diff * SCORE_TO_POINTS;

  let raw = quality + improvement + PARTICIPATION;
  // Only the net result is softened, so a genuinely bad night still costs
  // something while never costing as much as a good one earns.
  if (raw < 0) raw *= LOSS_WEIGHT;

  // Climbing slows as you rise: 1.6 at the very bottom down to 0.3 at the
  // ceiling. Same stream performance is worth roughly five times more in
  // Iron than in Master.
  const span = EARLY_MULTIPLIER - LATE_MULTIPLIER;
  const difficulty = Math.max(
    LATE_MULTIPLIER,
    EARLY_MULTIPLIER - (input.points / MAX_POINTS) * span
  );
  let delta = Math.round(raw * difficulty);
  delta = Math.max(-MAX_LOSS, Math.min(MAX_GAIN, delta));

  let next = input.points + delta;
  let shielded = false;

  // Demotion shield: dropping out of a tier takes two bad streams in a
  // row. A tier is supposed to feel owned, and losing one on a single off
  // night is the thing that makes ladders feel cruel.
  if (delta < 0 && next < tierFloor(from.tier) && !input.lastWasLoss) {
    next = tierFloor(from.tier);
    delta = next - input.points;
    shielded = true;
  }

  next = Math.max(0, Math.min(MAX_POINTS, next));
  const to = rankFromPoints(next);

  const tierChange =
    to.tier === from.tier ? null : tierIndex(to.tier) > tierIndex(from.tier) ? "up" : "down";
  const divisionChange =
    tierChange || to.division === from.division
      ? null
      : (to.division ?? 0) < (from.division ?? 0)
      ? "up"
      : "down";

  return {
    delta,
    points: next,
    from,
    to,
    tierChange,
    divisionChange,
    shielded,
    reason: describe(diff, delta, shielded),
  };
}

function tierIndex(name: string): number {
  return TIERS.findIndex((t) => t.name === name);
}

function describe(diff: number, delta: number, shielded: boolean): string {
  if (shielded) return "Demotion shield held";
  if (delta > 0 && diff > 0) return `Beat your recent average by ${Math.round(diff)}`;
  if (delta > 0) return "Held your form";
  if (diff < 0) return `Below your recent average by ${Math.abs(Math.round(diff))}`;
  return "No change";
}

/** Points at which a named tier begins. */
export function tierFloor(name: string): number {
  return TIERS.find((t) => t.name === name)?.floor ?? 0;
}

/**
 * True when a stored per-stream delta was a placement, not a climb.
 *
 * A placement records the whole starting rating as its delta (200 to
 * 1200), while a climb is capped at MAX_GAIN, so anything above the cap
 * can only have been a placement. Lets a page tell the two apart from the
 * vods row alone.
 */
export function isPlacementDelta(delta: number): boolean {
  return delta > MAX_GAIN;
}
