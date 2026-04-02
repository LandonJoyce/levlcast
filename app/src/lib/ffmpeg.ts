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
  if (process.platform !== "linux") {
    const ffmpegStatic = require("ffmpeg-static");
    return ffmpegStatic;
  }

  try {
    await access(FFMPEG_TMP_PATH);
    return FFMPEG_TMP_PATH;
  } catch {
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
 * Cut a clip from a video file at the specified timestamps.
 * Accepts a file path instead of a buffer to avoid OOM on large VODs.
 * Returns the clip as a Buffer (mp4 format).
 */
export async function cutClip(
  inputFilePath: string,
  startSeconds: number,
  endSeconds: number
): Promise<Buffer> {
  const ffmpegPath = await getFFmpegPath();

  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-clip-"));
  const outputPath = join(tempDir, "clip.mp4");

  try {
    const duration = endSeconds - startSeconds;

    const cmd = [
      `"${ffmpegPath}"`,
      `-ss ${startSeconds}`,
      `-i "${inputFilePath}"`,
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
    await unlink(outputPath).catch(() => {});
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir);
    } catch {}
  }
}
