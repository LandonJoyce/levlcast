import type { ImageSourcePropType } from 'react-native';

/**
 * The ladder, as the site draws it (app/src/lib/rank.ts). Only the reading
 * side lives here: the server works out every rank change, the app shows it.
 */

export const DIVISION_SIZE = 100;
const DIVISIONS_PER_TIER = 4;
const MAX_POINTS = 4000;
/** Biggest single-stream gain; anything bigger was a placement. */
const MAX_GAIN = 70;

export const TIERS = [
  { name: 'Iron', floor: 0 },
  { name: 'Bronze', floor: 400 },
  { name: 'Silver', floor: 800 },
  { name: 'Gold', floor: 1200 },
  { name: 'Platinum', floor: 1600 },
  { name: 'Diamond', floor: 2000 },
  { name: 'Master', floor: 2400 },
  { name: 'Grandmaster', floor: 2800 },
];

export const TIER_HEX: Record<string, string> = {
  Iron: '#9AA0A6',
  Bronze: '#C1804B',
  Silver: '#B8C2CC',
  Gold: '#E3B341',
  Platinum: '#4FD1B9',
  Diamond: '#7CC5F5',
  Master: '#C084FC',
  Grandmaster: '#A855F7',
};

export const EMBLEMS: Record<string, ImageSourcePropType> = {
  Iron: require('../assets/ranks/iron.png'),
  Bronze: require('../assets/ranks/bronze.png'),
  Silver: require('../assets/ranks/silver.png'),
  Gold: require('../assets/ranks/gold.png'),
  Platinum: require('../assets/ranks/platinum.png'),
  Diamond: require('../assets/ranks/diamond.png'),
  Master: require('../assets/ranks/master.png'),
  Grandmaster: require('../assets/ranks/grandmaster.png'),
};

const DIVISIONLESS = new Set(['Master', 'Grandmaster']);

export interface Rank {
  points: number;
  tier: string;
  /** 4 down to 1. Master and Grandmaster have none. */
  division: number | null;
  /** 0-100 through the current division. */
  progress: number;
  label: string;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

export function rankFromPoints(rawPoints: number): Rank {
  const points = Math.max(0, Math.min(MAX_POINTS, Math.round(rawPoints)));
  let tier = TIERS[0];
  for (const t of TIERS) if (points >= t.floor) tier = t;

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
  const divisionIndex = Math.min(DIVISIONS_PER_TIER - 1, Math.floor(intoTier / DIVISION_SIZE));
  const division = DIVISIONS_PER_TIER - divisionIndex;
  return {
    points,
    tier: tier.name,
    division,
    progress: Math.round(((intoTier % DIVISION_SIZE) / DIVISION_SIZE) * 100),
    label: `${tier.name} ${ROMAN[division]}`,
  };
}

export function tierFloor(name: string): number {
  return TIERS.find((t) => t.name === name)?.floor ?? 0;
}

/** A placement records the whole starting rating as its delta. */
export function isPlacementDelta(delta: number): boolean {
  return delta > MAX_GAIN;
}

/** The next step up: "Gold III", or the next tier's name. */
export function nextDivision(rank: Rank): string | null {
  const i = TIERS.findIndex((t) => t.name === rank.tier);
  if (rank.division === null) return TIERS[i + 1]?.name ?? null;
  if (rank.division > 1) return `${rank.tier} ${ROMAN[rank.division - 1]}`;
  const next = TIERS[i + 1];
  if (!next) return null;
  return DIVISIONLESS.has(next.name) ? next.name : `${next.name} IV`;
}

/** "about 3 wins", from what this streamer's wins usually pay. */
export function winsAway(toNext: number, avgWin: number | null): string | null {
  if (!avgWin || avgWin <= 0) return null;
  const n = Math.ceil(toNext / avgWin);
  if (n <= 1) return 'one win away';
  if (n > 12) return null;
  return `about ${n} wins`;
}
