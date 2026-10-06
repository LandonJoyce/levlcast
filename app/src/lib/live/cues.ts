/**
 * Live coaching cues: what the dock tells a streamer while they're live.
 *
 * Plain rules over what the dock can see right now: viewers, chat, and the
 * mic level and scene from OBS. Kept free of the page so they can be tested
 * without a stream. Each cue is a short headline plus the one thing to do,
 * in the same voice as the reports, and a line to say out loud in voice
 * mode. The spoken lines rotate so the same words don't keep coming back.
 *
 * The listening coach's tips (kind "coach") are written on the server
 * (lib/live/coach.ts) and only pass through here to be shown.
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
  | "catchUp"
  | "coach";

export interface Cue {
  id: string;
  kind: CueKind;
  title: string;
  action: string;
  at: number;
  tone: "nudge" | "good" | "info";
  /** Read out in voice mode. Falls back to the title and action. */
  say?: string;
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
  coach: 85,
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
  coach: 120,
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
const make = (kind: CueKind, title: string, action: string, at: number, tone: Cue["tone"], say?: string): Cue => ({
  id: `${kind}-${at}-${seq++}`,
  kind,
  title,
  action,
  at,
  tone,
  ...(say ? { say } : {}),
});

/** What the voice says for each nudge. Several ways each, taken in turn. */
const SAY = {
  quiet: [
    "You've gone quiet. Talk through what you're doing.",
    "Quiet for a bit. Tell chat what you're thinking.",
    "Say something. What's the plan right now?",
    "Little quiet. Ask chat what they'd do here.",
  ],
  chatQuiet: [
    "Chat's gone quiet. Ask them something easy to answer.",
    "Nobody's typed in a while. Ask chat a quick question.",
    "Quiet chat. Give them two options and let them pick.",
  ],
  catchUp: [
    "Quick catch-up for anyone new. Say what you're doing tonight.",
    "Recap for new people. One sentence on what's going on.",
    "Some people just got here. Tell them what they walked into.",
  ],
  newChatter: [
    (name: string) => `${name} is new in chat. Say hi to them by name.`,
    (name: string) => `First message from ${name}. Greet them.`,
    (name: string) => `${name} just talked for the first time. Say hi.`,
  ],
  raid: [
    (from: string, n: string) => `Raid from ${from}${n}. Welcome them and say what tonight is.`,
    (from: string, n: string) => `${from} just raided you${n}. Thank them and catch the raiders up.`,
  ],
  viewersDown: [
    (n: number) => `You're down ${n} viewers. Talk to whoever's still here.`,
    () => "Lost a few people. Say what's coming up next.",
  ],
  viewersUp: [
    (n: number) => `Up ${n} viewers. Whatever you're doing, keep going.`,
    () => "More people just showed up. Say hi and catch them up.",
  ],
};

export class CueEngine {
  private last = new Map<CueKind, number>();
  private turns = new Map<string, number>();
  /** When this dock first saw the stream live: chat before then is unknown. */
  private watchingSince: number | null = null;
  /** The quiet stretch (by when it began) already logged, so it's logged once. */
  private quietLogged: number | null = null;
  private sceneLogged: number | null = null;

  constructor(public tuning: CueTuning = DEFAULT_TUNING) {}

  /** The next of several ways to say something. */
  private next<T>(key: string, options: T[]): T {
    const n = this.turns.get(key) ?? 0;
    this.turns.set(key, n + 1);
    return options[n % options.length];
  }

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
        const min = Math.floor((on * this.tuning.speed) / 60000);
        return make("startingScene", `Starting screen up ${min} min`, "The people who came on time are already here. Start the show.", sceneSince, "nudge", `Still on your starting screen after ${min} minutes. Start the show.`);
      }
      if (BREAK_SCENE.test(scene) && on >= this.ms(300)) {
        const min = Math.floor((on * this.tuning.speed) / 60000);
        return make("breakScene", `On break ${min} min`, "People drift off during long breaks. Come back, or say when you will.", sceneSince, "nudge", `You've been on break ${min} minutes. Come back, or say when you will.`);
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
    if (this.watchingSince === null) this.watchingSince = now;
    const watching = this.watchingSince;

    const cur = this.current(s);
    if (cur?.kind === "quiet" && this.quietLogged !== cur.at) {
      this.quietLogged = cur.at;
      out.push(make("quiet", `Quiet for ${this.tuning.quietSeconds} seconds`, cur.action, now, "nudge", this.next("quiet", SAY.quiet)));
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
          out.push(make("viewersDown", `Down ${down} viewers in 5 minutes`, "Talk to whoever's still here: what you're doing and what's next.", now, "nudge", this.next("viewersDown", SAY.viewersDown)(down)));
        } else if (up >= Math.max(2, Math.ceil(Math.max(old.n, 1) * 0.25)) && this.ready("viewersUp", 600, now)) {
          this.last.set("viewersUp", now);
          out.push(make("viewersUp", `Up ${up} viewers in 5 minutes`, "Whatever you're doing, keep going. Say hi to whoever just showed up.", now, "good", this.next("viewersUp", SAY.viewersUp)(up)));
        }
      }
    }

    // Quiet chat, once the stream is going and someone's watching. With no
    // message seen yet, count from when this dock started watching: chat
    // before then happened where it couldn't see.
    if (s.liveSince !== null && now - s.liveSince >= this.ms(600) && (latest?.n ?? 0) >= 1) {
      const since = s.lastChatAt ?? Math.max(s.liveSince, watching);
      const quietFor = now - since;
      if (quietFor >= this.ms(240) && this.ready("chatQuiet", 480, now)) {
        this.last.set("chatQuiet", now);
        out.push(make("chatQuiet", `Chat's been quiet ${Math.floor((quietFor * this.tuning.speed) / 60000)} min`, "Ask them something easy to answer, like which one they'd pick.", now, "nudge", this.next("chatQuiet", SAY.chatQuiet)));
      }
    }

    // Every 15 minutes, catch up whoever just arrived. The first one comes
    // 15 minutes into the stream, or 15 minutes after the dock opened.
    if (!this.last.has("catchUp")) this.last.set("catchUp", Math.max(s.liveSince ?? now, watching));
    if (s.liveSince !== null && now - s.liveSince >= this.ms(900) && !this.onSpecialScene(s) && this.ready("catchUp", 900, now)) {
      this.last.set("catchUp", now);
      out.push(make("catchUp", "Catch up anyone new", "Say what you're doing tonight, in one sentence.", now, "info", this.next("catchUp", SAY.catchUp)));
    }

    return out;
  }

  raid(from: string, viewers: number, now: number): Cue {
    const n = viewers > 0 ? ` with ${viewers} people` : "";
    return make("raid", `Raid from ${from}${viewers > 0 ? ` with ${viewers}` : ""}`, "Welcome them by name and say what tonight is.", now, "good", this.next("raid", SAY.raid)(from, n));
  }

  newChatter(name: string, now: number): Cue {
    return make("newChatter", `New chatter: ${name}`, "Say hi by name.", now, "good", this.next("newChatter", SAY.newChatter)(name));
  }
}

/**
 * The cue for the big card: whatever's true right now, or the most
 * important cue still within its time on screen.
 */
/** The line voice mode reads out for a cue. */
export function spokenLine(c: Pick<Cue, "title" | "action" | "say">): string {
  return c.say || `${c.title}. ${c.action}`;
}

export function nowCue(current: Cue | null, feed: Cue[], now: number, speed = 1): Cue | null {
  const candidates = [
    ...(current ? [current] : []),
    ...feed.filter((c) => SHOW_FOR[c.kind] > 0 && now - c.at < (SHOW_FOR[c.kind] * 1000) / speed),
  ];
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (PRIORITY[b.kind] > PRIORITY[a.kind] || (PRIORITY[b.kind] === PRIORITY[a.kind] && b.at > a.at) ? b : a));
}
