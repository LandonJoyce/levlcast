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
  // On non-Linux (local dev), use ffmpeg-static package
  if (process.platform !== "linux") {
    const ffmpegStatic = require("ffmpeg-static");
    return ffmpegStatic;
  }

  // On Vercel/Linux: check if already downloaded to /tmp
  try {
    await access(FFMPEG_TMP_PATH);
    return FFMPEG_TMP_PATH;
  } catch {
    // Download ffmpeg binary
    console.log("[ffmpeg] Downloading ffmpeg binary...");
    const res = await fetch(FFMPEG_DOWNLOAD_URL);
    if (!res.ok) throw new Error(`Failed to download ffmpeg: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(FFMPEG_TMP_PATH, buffer);
    await chmod(FFMPEG_TMP_PATH, 0o755);
    console.log("[ffmpeg] ffmpeg binary ready");
    return FFMPEG_TMP_PATH;
  }
}

/**
 * Cut a clip from raw video data at the specified timestamps.
 * Returns the clip as a Buffer (mp4 format).
 */
export async function cutClip(
  videoBuffer: Buffer,
  startSeconds: number,
  endSeconds: number
): Promise<Buffer> {
  const ffmpegPath = await getFFmpegPath();

  // Create a temp directory for this operation
  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-"));
  const inputPath = join(tempDir, "input.ts");
  const outputPath = join(tempDir, "clip.mp4");

  try {
    await writeFile(inputPath, videoBuffer);

    const duration = endSeconds - startSeconds;

    const cmd = [
      `"${ffmpegPath}"`,
      `-ss ${startSeconds}`,
      `-i "${inputPath}"`,
      `-t ${duration}`,
      `-c:v libx264`,
      `-preset fast`,
      `-crf 23`,
      `-c:a aac`,
      `-b:a 128k`,
      `-movflags +faststart`,
      `-y`,
      `"${outputPath}"`,
    ].join(" ");

    await execAsync(cmd, { timeout: 120000 });

    const clipBuffer = await readFile(outputPath);
    return clipBuffer;
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
