import { createReadStream } from "fs";
import { withRetry } from "./retry";

const DEEPGRAM_API = "https://api.deepgram.com/v1/listen";

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

/**
 * Transcribe a local audio file using Deepgram's pre-recorded API.
 * Accepts a file path and streams it — avoids loading the entire file into memory.
 */
export async function transcribeFile(
  filePath: string
): Promise<TranscriptSegment[]> {
  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    utterances: "true",
    utt_split: "1.5",
  });

  const res = await withRetry(() => {
    const stream = createReadStream(filePath);
    return fetch(`${DEEPGRAM_API}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "video/mp2t",
    },
      // @ts-ignore — Node.js ReadStream is valid here but TS types don't know it
      body: stream,
      // @ts-ignore
      duplex: "half",
    });
  }, 3, 1000);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Deepgram ${res.status}: ${body}`);
  }

  const json = await res.json();
  const utterances: { transcript: string; start: number; end: number }[] =
    json.results?.utterances || [];

  return utterances.map((u) => ({
    text: u.transcript,
    start: u.start,
    end: u.end,
  }));
}
