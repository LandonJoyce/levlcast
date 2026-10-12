/**
 * The small, quick Claude model, for everything that runs often or in the
 * background: the live coach, tonight's fix line, the weekly notes.
 *
 * Claude Haiku 5.5 since 2026-10-12 (it was Haiku 4.5). Per token it costs
 * a tenth as much ($0.10 in, $0.50 out per million, for prompts under 100k
 * tokens). It counts the same text as about 30% more tokens, so each call's
 * max_tokens went up by about that much. The clip finder was tried on it
 * and found weaker clips, so it stays on Sonnet (lib/analyze.ts).
 *
 * Its rules, which every call here follows:
 * - Thinking is on unless it's turned off. These calls all ran without
 *   thinking before, so they send THINKING_OFF and answer the way they did.
 * - Any temperature but 1 is refused with a 400, so none is sent.
 * - The reply is read from every text block, never just the first.
 */
export const HAIKU = "claude-haiku-5-5";

export const THINKING_OFF = { type: "disabled" } as const;

/** The reply's text, from every text block. */
export function replyText(content: ReadonlyArray<{ type: string; text?: string }>): string {
  return content.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("");
}

/** The JSON object in a reply, without any code fence or words around it. */
export function replyObject(content: ReadonlyArray<{ type: string; text?: string }>): string {
  const text = replyText(content);
  return text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
}
