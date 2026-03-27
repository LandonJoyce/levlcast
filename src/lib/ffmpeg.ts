import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

// Get the ffmpeg binary path - use direct path to avoid webpack mangling
const ffmpegPath = join(
  process.cwd(),
  "node_modules",
  "ffmpeg-static",
  process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
);

/**
 * Cut a clip from raw video data at the specified timestamps.
 * Returns the clip as a Buffer (mp4 format).
 */
export async function cutClip(
  videoBuffer: Buffer,
  startSeconds: number,
  endSeconds: number
): Promise<Buffer> {
  // Create a temp directory for this operation
  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-"));
  const inputPath = join(tempDir, "input.ts");
  const outputPath = join(tempDir, "clip.mp4");

  try {
    // Write input video to temp file
    await writeFile(inputPath, videoBuffer);

    const duration = endSeconds - startSeconds;

    // Cut clip with ffmpeg
    // -ss before -i for fast seeking
    // -t for duration
    // -c:v libx264 for compatibility
    // -c:a aac for audio
    // -movflags +faststart for web streaming
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

    // Read the output clip
    const clipBuffer = await readFile(outputPath);
    return clipBuffer;
  } finally {
    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
