/**
 * Twitch's MPEG-TS audio as a plain AAC (ADTS) stream, copied out of the
 * container in code: no ffmpeg, no re-encoding, a few milliseconds for an
 * hour of audio. Soniox refuses MPEG-TS ("More than one audio stream found
 * in the file") but takes AAC (lib/soniox.ts).
 *
 * MPEG-TS is a run of 188-byte packets, each tagged with a stream id. The
 * PAT (id 0) points to the PMT, which lists the streams; the first ADTS AAC
 * stream (type 0x0F) is the audio, and anything else (Twitch's ID3 metadata)
 * is skipped. The audio packets carry PES packets whose payload is ADTS
 * frames, so dropping the PES headers and joining the payloads gives an
 * .aac file.
 */
const PACKET = 188;
const SYNC = 0x47;
const ADTS_AAC = 0x0f;

/** Starts with MPEG-TS packets (sync byte every 188 bytes). */
export function isMpegTs(buf: Buffer): boolean {
  if (buf.length < PACKET) return false;
  const packets = Math.min(3, Math.floor(buf.length / PACKET));
  for (let i = 0; i < packets; i++) if (buf[i * PACKET] !== SYNC) return false;
  return true;
}

/** The AAC audio in MPEG-TS bytes, or null if there's none to be found. */
export function tsToAdts(buf: Buffer): Buffer | null {
  let pmtPid = -1;
  let audioPid = -1;
  let inPes = false;
  const out: Buffer[] = [];

  for (let off = 0; off + PACKET <= buf.length; off += PACKET) {
    if (buf[off] !== SYNC) {
      // A torn segment: find the next point where packets line up again.
      const next = resync(buf, off + 1);
      if (next < 0) break;
      off = next - PACKET;
      inPes = false;
      continue;
    }
    const pusi = (buf[off + 1] & 0x40) !== 0;
    const pid = ((buf[off + 1] & 0x1f) << 8) | buf[off + 2];
    const control = (buf[off + 3] >> 4) & 0x3;
    const end = off + PACKET;
    let p = off + 4;
    if (control & 0x2) p += 1 + buf[off + 4];
    if (!(control & 0x1) || p >= end) continue;

    if (pid === 0) {
      if (pmtPid < 0) pmtPid = patProgramPid(buf, pusi ? p + 1 + buf[p] : p, end);
      continue;
    }
    if (pid === pmtPid) {
      if (audioPid < 0) audioPid = pmtAudioPid(buf, pusi ? p + 1 + buf[p] : p, end);
      continue;
    }
    if (pid !== audioPid || audioPid < 0) continue;

    if (pusi) {
      // PES header: 00 00 01, stream id, length (2), flags (2), header length (1).
      if (p + 9 > end || buf[p] !== 0 || buf[p + 1] !== 0 || buf[p + 2] !== 1) {
        inPes = false;
        continue;
      }
      p += 9 + buf[p + 8];
      inPes = true;
    }
    if (inPes && p < end) out.push(buf.subarray(p, end));
  }

  return audioPid >= 0 && out.length ? Buffer.concat(out) : null;
}

function resync(buf: Buffer, from: number): number {
  for (let i = from; i + PACKET * 2 < buf.length; i++) {
    if (buf[i] === SYNC && buf[i + PACKET] === SYNC && buf[i + PACKET * 2] === SYNC) return i;
  }
  return -1;
}

/** The first program's PMT id from a PAT section starting at q. */
function patProgramPid(buf: Buffer, q: number, end: number): number {
  if (q + 8 > end) return -1;
  const sectionLength = ((buf[q + 1] & 0x0f) << 8) | buf[q + 2];
  const last = Math.min(q + 3 + sectionLength - 4, end);
  for (let e = q + 8; e + 4 <= last; e += 4) {
    const program = (buf[e] << 8) | buf[e + 1];
    if (program !== 0) return ((buf[e + 2] & 0x1f) << 8) | buf[e + 3];
  }
  return -1;
}

/** The first ADTS AAC stream's id from a PMT section starting at q. */
function pmtAudioPid(buf: Buffer, q: number, end: number): number {
  if (q + 12 > end) return -1;
  const sectionLength = ((buf[q + 1] & 0x0f) << 8) | buf[q + 2];
  const last = Math.min(q + 3 + sectionLength - 4, end);
  let e = q + 12 + (((buf[q + 10] & 0x0f) << 8) | buf[q + 11]);
  while (e + 5 <= last) {
    const type = buf[e];
    const pid = ((buf[e + 1] & 0x1f) << 8) | buf[e + 2];
    if (type === ADTS_AAC) return pid;
    e += 5 + (((buf[e + 3] & 0x0f) << 8) | buf[e + 4]);
  }
  return -1;
}
