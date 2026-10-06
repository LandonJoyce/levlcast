/**
 * The natural voices Pro can pick for voice mode: Deepgram's Aura voices,
 * read on the server (/api/live/<token>/say). Free plans use the phone's
 * own voices instead (lib/live/voice.ts). Shared by the page and the server.
 */
export const LEVL_VOICES = [
  { id: "thalia", name: "Thalia", note: "Upbeat" },
  { id: "andromeda", name: "Andromeda", note: "Casual" },
  { id: "helena", name: "Helena", note: "Warm" },
  { id: "apollo", name: "Apollo", note: "Laid back" },
  { id: "arcas", name: "Arcas", note: "Smooth" },
  { id: "orion", name: "Orion", note: "Calm" },
] as const;

export type LevlVoiceId = (typeof LEVL_VOICES)[number]["id"];

export function isLevlVoice(id: string): id is LevlVoiceId {
  return LEVL_VOICES.some((v) => v.id === id);
}

/** The fixed lines a voice can be heard saying before it's picked (cached, so free to play). */
export const SAMPLE_LINES = {
  sample: "You've gone quiet for a bit. Tell chat what you're thinking right now.",
  on: "Voice coaching is on. I'll keep it short.",
} as const;

export type SampleLine = keyof typeof SAMPLE_LINES;
