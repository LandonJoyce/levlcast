/**
 * The app's look, taken from levlcast.com (app/src/app/dashboard/app.css):
 * the same warm near-black, whites and greys, hairlines, Plus Jakarta
 * headings, Big Shoulders numbers, Geist Mono labels and flat white
 * buttons. No gradients. Colour is kept for what it means in the game:
 * green for a win, red for a loss, gold for a promotion.
 */

export const colors = {
  bg: '#100D0E',
  surface: '#161213',
  surface2: '#1D1819',
  surface3: '#262021',

  ink: '#FFFAF7',
  ink2: '#E4DAD7',
  ink3: '#A69897',
  ink4: '#928688',

  line: 'rgba(255,238,230,0.1)',
  line2: 'rgba(255,238,230,0.18)',
  /** The empty part of a bar. */
  track: 'rgba(255,238,230,0.08)',
  wash: 'rgba(255,238,230,0.05)',

  green: '#A3E635',
  greenSoft: 'rgba(163,230,53,0.1)',
  warn: '#FCD093',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.1)',
  gold: '#E3B341',
  goldSoft: 'rgba(227,179,65,0.08)',
};

/**
 * Loaded in app/_layout.tsx from assets/fonts. Each file is one weight, so
 * styles that use these never set fontWeight (iOS would go looking for a
 * sibling weight that isn't there).
 */
export const fonts = {
  /** Headings. */
  display: 'PlusJakartaSans-ExtraBold',
  /** Scores, ranks, results. */
  numbers: 'BigShoulders-Black',
  /** Small uppercase labels and times. */
  mono: 'GeistMono-Medium',
};
