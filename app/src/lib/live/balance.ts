/**
 * Is the game drowning out the streamer's voice? Fed the mic's peak and the
 * loudest desktop or app audio's peak from OBS's meters, about 20 times a
 * second (lib/live/obs.ts). Only moments when they're talking and the game
 * is making real noise count, and it calls it once the game has been about
 * as loud as their voice, or louder, through most of the last half minute
 * of those. Viewers want the voice clearly on top; this only flags a mix
 * that's plainly wrong, since the streamer can't hear it from their side.
 */

/** Quieter than this, the game isn't competing with anyone. */
const GAME_FLOOR_DB = -40;
/** The voice should beat the game by at least this much. */
const MARGIN_DB = 3;
const WINDOW_MS = 30_000;
/** About five seconds of talking over a loud game before it says anything. */
const MIN_SAMPLES = 100;
/** Share of those moments the game has to be on par or louder. */
const SHARE = 0.6;

export class AudioBalance {
  private samples: Array<{ at: number; drowned: boolean }> = [];

  add(at: number, talking: boolean, micDb: number, gameDb: number | null): void {
    if (talking && gameDb !== null && gameDb > GAME_FLOOR_DB && Number.isFinite(micDb)) {
      this.samples.push({ at, drowned: gameDb > micDb - MARGIN_DB });
    }
    while (this.samples.length && at - this.samples[0].at > WINDOW_MS) this.samples.shift();
  }

  drowned(): boolean {
    if (this.samples.length < MIN_SAMPLES) return false;
    return this.samples.filter((s) => s.drowned).length / this.samples.length >= SHARE;
  }

  reset(): void {
    this.samples = [];
  }
}
