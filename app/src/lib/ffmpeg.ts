import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile, mkdtemp, access, chmod } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

const FFMPEG_TMP_PATH = "/tmp/ffmpeg";
const FFMPEG_DOWNLOAD_URL =
  "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64";

async function getFFmpegPath(): Promise<string> {
  try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic) {
      await access(ffmpegStatic);
      return ffmpegStatic;
    }
  } catch {
    // Binary not accessible via npm package — fall through to manual download
  }

  if (process.platform === "linux") {
    try {
      await access(FFMPEG_TMP_PATH);
      return FFMPEG_TMP_PATH;
    } catch {
      console.log("[ffmpeg] Downloading ffmpeg binary to /tmp...");
      const res = await fetch(FFMPEG_DOWNLOAD_URL);
      if (!res.ok) throw new Error(`Failed to download ffmpeg binary: ${res.status} ${res.statusText}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      await writeFile(FFMPEG_TMP_PATH, buffer);
      await chmod(FFMPEG_TMP_PATH, 0o755);
      console.log("[ffmpeg] ffmpeg binary ready at /tmp/ffmpeg");
      return FFMPEG_TMP_PATH;
    }
  }

  throw new Error("ffmpeg binary not found — install ffmpeg-static or ensure ffmpeg is on PATH");
}

function ffmpegError(err: any): Error {
  const stderr: string = err.stderr || "";
  const lines = stderr.split("\n").map((l: string) => l.trim()).filter(Boolean);
  // Errors appear at the end; progress lines (frame=, fps=) are noise.
  const meaningful = lines.filter((l) =>
    /error|invalid|fail|not found|unable|no such|denied|corrupt|empty/i.test(l) &&
    !/frame=|fps=|bitrate=|speed=|size=/i.test(l)
  );
  const tail = (meaningful.length > 0 ? meaningful : lines).slice(-4).join(" | ");
  return new Error(`FFmpeg failed: ${tail.slice(0, 500) || err.message}`);
}

/**
 * Cut a clip from a concatenated MPEG-TS Twitch VOD file.
 *
 * Twitch VOD segments are broadcast TS with 33-bit PTS counters that start
 * at an arbitrary offset (e.g. 3 hours into a stream = PTS ~972000000).
 * Concatenating segments from different positions can cause PTS jumps that
 * confuse FFmpeg's seeking logic and produce the "time=-577014:32:22.77"
 * negative timestamp bug.
 *
 * Fix: two-stage encode.
 *   Pass 1 — remux the raw TS to a clean intermediate TS, resetting all
 *             timestamps to 0 with `-reset_timestamps 1`. Fast (-c copy).
 *   Pass 2 — seek + re-encode from the clean intermediate into an MP4.
 *             Timestamps are now 0-based so `-ss` works reliably.
 */
export async function cutClip(
  inputFilePath: string,
  startSeconds: number,
  endSeconds: number
): Promise<Buffer> {
  const safeStart = Math.max(0, startSeconds);
  const safeEnd = endSeconds;
  if (safeEnd <= safeStart) throw new Error(`Invalid clip bounds: start=${safeStart} end=${safeEnd}`);
  if (safeEnd - safeStart < 2) throw new Error(`Clip too short: ${safeEnd - safeStart}s`);

  const ffmpegPath = await getFFmpegPath();
  const duration = safeEnd - safeStart;

  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-clip-"));
  // MP4 intermediate: TS→MP4 remux forces timestamp normalization far more
  // reliably than TS→TS, which preserves the original PCR/PTS offsets even
  // when -reset_timestamps 1 is set. This is the root fix for the
  // time=-577014:32:22.77 PTS rollover bug from Twitch broadcast segments.
  const normalizedPath = join(tempDir, "normalized.mp4");
  const outputPath = join(tempDir, "clip.mp4");

  try {
    // Pass 1: remux TS → MP4 with timestamp reset.
    // -fflags +genpts+igndts handles packets missing PTS or with bad DTS.
    const pass1 = [
      `"${ffmpegPath}"`,
      `-fflags +genpts+igndts`,
      `-err_detect ignore_err`,
      `-i "${inputFilePath}"`,
      `-c copy`,
      `-reset_timestamps 1`,
      `-y`,
      `"${normalizedPath}"`,
    ].join(" ");

    try {
      await execAsync(pass1, { timeout: 60000 });
    } catch (err: any) {
      console.error("[ffmpeg] Pass 1 failed:", err.stderr?.slice(-300));
      throw ffmpegError(err);
    }

    // Pass 2: two-pass seek on clean timestamps, then re-encode to MP4.
    const preSeek = Math.max(0, safeStart - 3);
    const fineSeek = safeStart - preSeek;

    const pass2 = [
      `"${ffmpegPath}"`,
      `-ss ${preSeek}`,
      `-i "${normalizedPath}"`,
      `-ss ${fineSeek}`,
      `-t ${duration}`,
      `-c:v libx264`,
      `-profile:v main`,
      `-level 4.0`,
      `-preset fast`,
      `-crf 23`,
      `-pix_fmt yuv420p`,
      `-c:a aac`,
      `-b:a 128k`,
      `-af aresample=async=1:first_pts=0`,
      `-avoid_negative_ts make_zero`,
      `-movflags +faststart`,
      `-y`,
      `"${outputPath}"`,
    ].join(" ");

    try {
      await execAsync(pass2, { timeout: 120000 });
    } catch (err: any) {
      console.error("[ffmpeg] Pass 2 failed:", err.stderr?.slice(-300));
      throw ffmpegError(err);
    }

    const clipBuffer = await readFile(outputPath);
    return clipBuffer;
  } finally {
    await unlink(normalizedPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir);
    } catch {}
  }
}
