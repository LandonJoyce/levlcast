/**
 * lib/ffmpeg.ts — video clip cutting using FFmpeg.
 *
 * WHAT IT DOES:
 *   cutClip(vodUrl, start, end) downloads the relevant portion of a Twitch VOD
 *   as an MP4, cuts it to the exact start/end times, and returns the file as a Buffer.
 *
 * PLATFORM DIFFERENCES:
 *   - macOS / Windows (local dev): uses ffmpeg-static npm package (bundled binary)
 *   - Linux / Vercel (production): downloads a static ffmpeg binary to /tmp on first use
 *     and reuses it for subsequent calls within the same function invocation.
 *
 * WHY /tmp ON VERCEL:
 *   Vercel serverless functions are read-only except for /tmp.
 *   The binary download only happens once per cold start (~2-3 seconds).
 */

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
  // Try the npm package first — works on local dev and sometimes on Vercel
  // if the binary wasn't stripped from the deployment bundle.
  try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic) {
      await access(ffmpegStatic);
      return ffmpegStatic;
    }
  } catch {
    // Binary not accessible via npm package — fall through to manual download
  }

  // On Linux (Vercel): Vercel strips large binaries from the bundle, so we
  // cache the binary in /tmp across warm invocations and download on cold starts.
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

/**
 * Cut a clip from a video file at the specified timestamps.
 * Accepts a file path instead of a buffer to avoid OOM on large VODs.
 * Returns the clip as a Buffer (mp4 format).
 */
export async function cutClip(
  inputFilePath: string,
  startSeconds: number,
  endSeconds: number
): Promise<Buffer> {
  // Validate inputs — negative or inverted times cause silent FFmpeg failures
  const safeStart = Math.max(0, startSeconds);
  const safeEnd = endSeconds;
  if (safeEnd <= safeStart) throw new Error(`Invalid clip bounds: start=${safeStart} end=${safeEnd}`);
  if (safeEnd - safeStart < 2) throw new Error(`Clip too short: ${safeEnd - safeStart}s`);

  const ffmpegPath = await getFFmpegPath();

  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-clip-"));
  const outputPath = join(tempDir, "clip.mp4");

  try {
    const duration = safeEnd - safeStart;

    // Two-pass seeking: fast seek to 3s before clip start, then accurate seek
    // within decoded frames. This ensures the output starts on a keyframe so
    // video and audio are in sync from the first frame.
    const preSeek = Math.max(0, safeStart - 3);
    const fineSeek = safeStart - preSeek;

    const cmd = [
      `"${ffmpegPath}"`,
      `-ss ${preSeek}`,
      `-i "${inputFilePath}"`,
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
      `-movflags +faststart`,
      `-y`,
      `"${outputPath}"`,
    ].join(" ");

    try {
      await execAsync(cmd, { timeout: 120000 });
    } catch (err: any) {
      console.error("[ffmpeg] Command failed:", cmd);
      console.error("[ffmpeg] stderr:", err.stderr);
      throw new Error(`FFmpeg failed: ${err.stderr?.slice(0, 300) || err.message}`);
    }

    const clipBuffer = await readFile(outputPath);
    return clipBuffer;
  } finally {
    await unlink(outputPath).catch(() => {});
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir);
    } catch {}
  }
}
