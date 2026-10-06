/**
 * Live coaching cues: what the dock tells a streamer while they're live.
 *
 * Plain rules over what the dock can see right now: viewers, chat, and the
 * mic level and scene from OBS. Kept free of the page so they can be tested
 * without a stream. Each cue is a short headline plus the one thing to do,
 * in the same voice as the reports.
 */

export type CueKind =
  | "raid"
  | "newChatter"
  | "quiet"
  | "startingScene"
  | "breakScene"
  | "viewersDown"
  | "viewersUp"
  | "chatQuiet"
  | "catchUp";

export interface Cue {
  id: string;
  kind: CueKind;
  title: string;
  action: string;
  at: number;
  tone: "nudge" | "good" | "info";
}

export interface LiveSignals {
  now: number;
  live: boolean;
  /** When the stream started (ms). */
  liveSince: number | null;
  /** Viewer counts, oldest first. */
  viewers: Array<{ at: number; n: number }>;
  /** The last chat message from someone other than the streamer. */
  lastChatAt: number | null;
  /** Null when OBS isn't connected. */
  obs: null | { lastTalkAt: number | null; scene: string | null; sceneSince: number | null };
}

export interface CueTuning {
  /** Seconds of quiet mic before the dock says so. */
  quietSeconds: number;
  /** Speeds every timer up, for testing. 1 in real use. */
  speed: number;
}

export const DEFAULT_TUNING: CueTuning = { quietSeconds: 45, speed: 1 };

/** Higher wins the "now" card. */
export const PRIORITY: Record<CueKind, number> = {
  raid: 100,
  newChatter: 90,
  quiet: 80,
  startingScene: 70,
  breakScene: 65,
  viewersDown: 60,
  chatQuiet: 50,
  viewersUp: 40,
  catchUp: 30,
};

/** How long a fired cue stays the "now" card, in seconds. */
export const SHOW_FOR: Record<CueKind, number> = {
  raid: 90,
  newChatter: 30,
  quiet: 0, // shown for as long as it's true
  startingScene: 0,
  breakScene: 0,
  viewersDown: 60,
  chatQuiet: 60,
  viewersUp: 45,
  catchUp: 40,
};

const START_SCENE = /start|soon|intro|waiting|pre.?stream/i;
const BREAK_SCENE = /\bbrb\b|break|be right back|away|pause|intermission/i;
const END_SCENE = /\bend\b|ending|outro|goodbye|thanks for watching/i;

export function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

let seq = 0;
const make = (kind: CueKind, title: string, action: string, at: number, tone: Cue["tone"]): Cue => ({
  id: `${kind}-${at}-${seq++}`,
  kind,
  title,
  action,
  at,
  tone,
});

export class CueEngine {
  private last = new Map<CueKind, number>();
  /** The quiet stretch (by when it began) already logged, so it's logged once. */
  private quietLogged: number | null = null;
  private sceneLogged: number | null = null;

  constructor(public tuning: CueTuning = DEFAULT_TUNING) {}

  private ms(seconds: number): number {
    return (seconds * 1000) / this.tuning.speed;
  }

  private ready(kind: CueKind, cooldownSeconds: number, now: number): boolean {
    const t = this.last.get(kind);
    return t === undefined || now - t >= this.ms(cooldownSeconds);
  }

  private onSpecialScene(s: LiveSignals): boolean {
    const scene = s.obs?.scene ?? "";
    return START_SCENE.test(scene) || BREAK_SCENE.test(scene) || END_SCENE.test(scene);
  }

  /**
   * What's true right now and should stay on screen while it is: a quiet
   * mic (with a running clock) or sitting on a starting or break scene.
   */
  current(s: LiveSignals): Cue | null {
    if (!s.live || !s.obs) return null;
    const { scene, sceneSince, lastTalkAt } = s.obs;

    if (scene && sceneSince !== null) {
      const on = s.now - sceneSince;
      if (START_SCENE.test(scene) && on >= this.ms(180)) {
        return make("startingScene", `Starting screen up ${Math.floor((on * this.tuning.speed) / 60000)} min`, "The people who came on time are already here. Start the show.", sceneSince, "nudge");
      }
      if (BREAK_SCENE.test(scene) && on >= this.ms(300)) {
        return make("breakScene", `On break ${Math.floor((on * this.tuning.speed) / 60000)} min`, "People drift off during long breaks. Come back, or say when you will.", sceneSince, "nudge");
      }
    }

    if (lastTalkAt !== null && !this.onSpecialScene(s)) {
      const quiet = s.now - lastTalkAt;
      if (quiet >= this.ms(this.tuning.quietSeconds)) {
        return make("quiet", `Quiet for ${clock(quiet * this.tuning.speed)}`, "Say what you're doing, or what you're thinking.", lastTalkAt, "nudge");
      }
    }
    return null;
  }

  /** Cues that fire on this tick. Each kind has a cooldown so the feed never nags. */
  tick(s: LiveSignals): Cue[] {
    if (!s.live) return [];
    const out: Cue[] = [];
    const now = s.now;

    const cur = this.current(s);
    if (cur?.kind === "quiet" && this.quietLogged !== cur.at) {
      this.quietLogged = cur.at;
      out.push(make("quiet", `Quiet for ${this.tuning.quietSeconds} seconds`, cur.action, now, "nudge"));
    }
    if ((cur?.kind === "startingScene" || cur?.kind === "breakScene") && this.sceneLogged !== cur.at) {
      this.sceneLogged = cur.at;
      out.push({ ...cur, id: `${cur.id}-log`, at: now });
    }

    // Viewers now against about five minutes ago.
    const latest = s.viewers[s.viewers.length - 1];
    if (latest) {
      const target = now - this.ms(300);
      const old = [...s.viewers].reverse().find((v) => v.at <= target + this.ms(30) && latest.at - v.at >= this.ms(240));
      if (old) {
        const down = old.n - latest.n;
        const up = latest.n - old.n;
        if (down >= Math.max(2, Math.ceil(old.n * 0.25)) && this.ready("viewersDown", 600, now)) {
          this.last.set("viewersDown", now);
          out.push(make("viewersDown", `Down ${down} viewers in 5 minutes`, "Talk to whoever's still here: what you're doing and what's next.", now, "nudge"));
        } else if (up >= Math.max(2, Math.ceil(Math.max(old.n, 1) * 0.25)) && this.ready("viewersUp", 600, now)) {
          this.last.set("viewersUp", now);
          out.push(make("viewersUp", `Up ${up} viewers in 5 minutes`, "Whatever you're doing, keep going. Say hi to whoever just showed up.", now, "good"));
        }
      }
    }

    // Quiet chat, once the stream is going and someone's watching.
    if (s.liveSince !== null && now - s.liveSince >= this.ms(600) && (latest?.n ?? 0) >= 1) {
      const since = s.lastChatAt ?? s.liveSince;
      const quietFor = now - since;
      if (quietFor >= this.ms(240) && this.ready("chatQuiet", 480, now)) {
        this.last.set("chatQuiet", now);
        out.push(make("chatQuiet", `Chat's been quiet ${Math.floor((quietFor * this.tuning.speed) / 60000)} min`, "Ask them something easy to answer, like which one they'd pick.", now, "nudge"));
      }
    }

    // Every 15 minutes, catch up whoever just arrived.
    if (s.liveSince !== null && now - s.liveSince >= this.ms(900) && !this.onSpecialScene(s) && this.ready("catchUp", 900, now)) {
      this.last.set("catchUp", now);
      out.push(make("catchUp", "Catch up anyone new", "Say what you're doing tonight, in one sentence.", now, "info"));
    }

    return out;
  }

  raid(from: string, viewers: number, now: number): Cue {
    return make("raid", `Raid from ${from}${viewers > 0 ? ` with ${viewers}` : ""}`, "Welcome them by name and say what tonight is.", now, "good");
  }

  newChatter(name: string, now: number): Cue {
    return make("newChatter", `New chatter: ${name}`, "Say hi by name.", now, "good");
  }
}

/**
 * The cue for the big card: whatever's true right now, or the most
 * important cue still within its time on screen.
 */
export function nowCue(current: Cue | null, feed: Cue[], now: number, speed = 1): Cue | null {
  const candidates = [
    ...(current ? [current] : []),
    ...feed.filter((c) => SHOW_FOR[c.kind] > 0 && now - c.at < (SHOW_FOR[c.kind] * 1000) / speed),
  ];
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (PRIORITY[b.kind] > PRIORITY[a.kind] || (PRIORITY[b.kind] === PRIORITY[a.kind] && b.at > a.at) ? b : a));
}
