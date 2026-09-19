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
  { name: "Challenger", floor: 3200 },
];

/**
 * The top three tiers have no divisions.
 *
 * Same convention as the ladder this borrows from, and it exists for a
 * reason: above a certain point the interesting question stops being
 * "which quarter of the tier" and starts being "how far past the bar", so
 * these report a raw number instead of a grid position.
 */
const DIVISIONLESS = new Set(["Master", "Grandmaster", "Challenger"]);

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
 * against yet, but floored at Bronze IV. A first experience of "you are
 * the lowest rank that exists" is exactly the moment people close the tab,
 * and we have the data showing they do.
 */
export function placementPoints(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  // 0-100 maps across Bronze IV to Platinum IV. Scoring well on a first
  // stream should visibly place you higher; scoring badly still lands
  // somewhere with room below the ceiling and dignity intact.
  const BRONZE_IV = 400;
  const PLATINUM_IV = 1600;
  return Math.round(BRONZE_IV + (clamped / 100) * (PLATINUM_IV - BRONZE_IV));
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
const MAX_GAIN = 45;
const MAX_LOSS = 25;
/** Losses count for less than wins. See the header for why. */
const LOSS_WEIGHT = 0.45;
/** Awarded for streaming and analysing at all, before performance. */
const PARTICIPATION = 8;
/** How many points a single point of score improvement is worth. */
const SCORE_TO_POINTS = 3;

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

  let raw = diff * SCORE_TO_POINTS;
  if (raw < 0) raw *= LOSS_WEIGHT;
  raw += PARTICIPATION;

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
