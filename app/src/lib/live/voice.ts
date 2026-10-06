/**
 * Voice mode: nudges read into an earbud. Meant for a phone, because
 * anything a computer plays out loud can end up on stream.
 *
 * Two kinds of voice:
 *  - LevlCast voices (Pro): natural voices read on the server
 *    (lib/live/voices.ts), played as audio.
 *  - The device's own voices (free): the browser's speech API. Nothing
 *    leaves the device. Quality depends on the phone.
 * If a LevlCast voice can't play a line, the device voice says it instead.
 */

import { isLevlVoice, type LevlVoiceId, type SampleLine } from "@/lib/live/voices";

export type VoicePick = { kind: "levl"; id: LevlVoiceId } | { kind: "device"; id: string };

const PICK_KEY = "lc-live-voice-v1";

export function loadVoicePick(): VoicePick | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PICK_KEY) ?? "null") as { kind?: string; id?: string } | null;
    if (raw?.kind === "levl" && raw.id && isLevlVoice(raw.id)) return { kind: "levl", id: raw.id };
    if (raw?.kind === "device" && raw.id) return { kind: "device", id: raw.id };
  } catch {}
  return null;
}

export function saveVoicePick(pick: VoicePick): void {
  try {
    localStorage.setItem(PICK_KEY, JSON.stringify(pick));
  } catch {}
}

function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** A hundredth of a second of silence, as a WAV. */
const SILENCE =
  "data:audio/wav;base64,UklGRogAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWQAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

/** Joke voices some phones ship with (Bubbles, Zarvox and friends). Never offered. */
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|kathy|organ|ralph|superstar|trinoids|whisper|wobble|zarvox/i;
/** Names that usually mean one of the better voices. */
const BETTER = /premium|enhanced|neural|natural|online/i;

/** The device's English voices, the natural-sounding ones first. */
export function deviceVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return [];
  const lang = (typeof navigator !== "undefined" ? navigator.language : "en-US").toLowerCase();
  const score = (v: SpeechSynthesisVoice) =>
    (BETTER.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (v.lang.toLowerCase() === lang ? 1 : 0);
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang?.toLowerCase().startsWith("en") && !NOVELTY.test(v.name))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, 8);
}

/** "Microsoft Aria Online (Natural) - English (United States)" reads as "Aria". */
export function voiceName(v: SpeechSynthesisVoice): string {
  return v.name.replace(/^(Microsoft|Google|Apple)\s+/i, "").replace(/\s*[-(].*$/, "").trim() || v.name;
}

export function voiceNote(v: SpeechSynthesisVoice): string {
  const region = v.lang.split(/[-_]/)[1]?.toUpperCase() ?? "";
  return [BETTER.test(v.name) ? "Natural" : "", region].filter(Boolean).join(", ");
}

export class Voice {
  private audio: HTMLAudioElement | null = null;
  private playing = false;
  private playStarted = 0;
  /** Counts clips, so a late error from an old one can't cut off the next. */
  private clip = 0;
  /** What the device voice says if the clip playing now fails. */
  private fallback: string | null = null;
  /** Only the newest line waits; older ones are dropped rather than fall behind. */
  private waiting: string | null = null;
  private speaking = 0;

  constructor(
    private token: string,
    public pick: VoicePick
  ) {}

  static supported(): boolean {
    return typeof window !== "undefined" && (canSpeak() || typeof Audio !== "undefined");
  }

  private el(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = "auto";
      this.audio.addEventListener("ended", () => this.next());
      this.audio.addEventListener("error", () => this.failed(this.clip));
    }
    return this.audio;
  }

  /**
   * Inside a tap: say something now. Phones only let a page make sound
   * later if it already made some during a tap. On a device voice, a blip
   * of silence through the audio player too, so a LevlCast voice picked
   * later can still play.
   */
  start(greeting: string): void {
    if (this.pick.kind === "levl") {
      // The device voice steps in when a clip can't play, and phones only
      // let it speak later if it spoke during a tap: so it says nothing, now.
      if (canSpeak()) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
      return this.play(`/api/live/voice-sample?v=${this.pick.id}&line=on`, greeting);
    }
    const a = this.el();
    a.src = SILENCE;
    a.play().catch(() => {});
    this.speak(greeting);
  }

  /** Inside a tap: what a voice sounds like. */
  preview(pick: VoicePick, line: SampleLine, text: string): void {
    this.stop();
    if (pick.kind === "levl") this.play(`/api/live/voice-sample?v=${pick.id}&line=${line}`, null);
    else this.speak(text, pick.id);
  }

  say(text: string): void {
    if (this.pick.kind === "device") return this.speak(text);
    // A clip that never finished (a call came in, say) doesn't block the rest.
    if (this.playing && Date.now() - this.playStarted < 30_000) {
      this.waiting = text;
      return;
    }
    this.play(`/api/live/${this.token}/say?v=${this.pick.id}&t=${encodeURIComponent(text)}`, text);
  }

  stop(): void {
    this.waiting = null;
    this.playing = false;
    this.fallback = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
    }
    if (canSpeak()) window.speechSynthesis.cancel();
    this.speaking = 0;
  }

  private next(): void {
    this.playing = false;
    const text = this.waiting;
    this.waiting = null;
    if (text) this.say(text);
  }

  /** Play a clip; if it won't, the device voice reads the line instead. */
  private play(url: string, fallback: string | null): void {
    const a = this.el();
    const clip = ++this.clip;
    this.playing = true;
    this.playStarted = Date.now();
    this.fallback = fallback;
    a.src = url;
    a.play().catch(() => this.failed(clip));
  }

  private failed(clip: number): void {
    if (clip !== this.clip || !this.playing) return;
    const text = this.fallback;
    this.fallback = null;
    if (text) this.speak(text);
    this.next();
  }

  private speak(text: string, voiceUri?: string): void {
    if (!canSpeak()) return;
    const synth = window.speechSynthesis;
    if (this.speaking > 1) {
      synth.cancel();
      this.speaking = 0;
    }
    const u = new SpeechSynthesisUtterance(text);
    const id = voiceUri ?? (this.pick.kind === "device" ? this.pick.id : null);
    const voices = synth.getVoices();
    const v = (id && voices.find((x) => x.voiceURI === id)) || deviceVoices()[0];
    if (v) u.voice = v;
    u.rate = 1;
    u.onend = u.onerror = () => {
      this.speaking = Math.max(0, this.speaking - 1);
    };
    this.speaking++;
    synth.speak(u);
  }
}
