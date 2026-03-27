const DEEPGRAM_API = "https://api.deepgram.com/v1/listen";

interface DeepgramUtterance {
  transcript: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

/**
 * Transcribe raw audio/video data using Deepgram's pre-recorded API.
 * Accepts a Buffer of media data (e.g. concatenated .ts segments).
 */
export async function transcribeBuffer(
  audioBuffer: Buffer
): Promise<TranscriptSegment[]> {
  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    utterances: "true",
    utt_split: "1.5",
  });

  const res = await fetch(`${DEEPGRAM_API}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "video/mp2t",
    },
    body: new Uint8Array(audioBuffer),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Deepgram ${res.status}: ${body}`);
  }

  const json = await res.json();
  const utterances: DeepgramUtterance[] =
    json.results?.utterances || [];

  return utterances.map((u) => ({
    text: u.transcript,
    start: u.start,
    end: u.end,
  }));
}
