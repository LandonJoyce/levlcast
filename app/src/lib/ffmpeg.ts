import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile, mkdtemp, access, chmod } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export type StreamLayout = "no_cam" | "cam_br" | "cam_bl" | "cam_tr" | "cam_tl";

/**
 * Re-encode an MP4 clip into 1080×1920 (9:16) vertical format.
 *
 * Layout options:
 *   no_cam  — center-crop gameplay to fill the full frame
 *   cam_br  — gameplay top 62%, facecam bottom-right 38%
 *   cam_bl  — gameplay top 62%, facecam bottom-left 38%
 *   cam_tr  — facecam top-right 38%, gameplay bottom 62%
 *   cam_tl  — facecam top-left 38%, gameplay bottom 62%
 *
 * Cam crops assume a 1280×720 (or wider 16:9) source with the webcam
 * in the bottom-right or top-right corner (typical streamer layout).
 * The cam segment is cropped from the corner at 25% width × 25% height,
 * then scaled to fill its 1080×730 (38%) slot.
 *
 * Output is H.264 / AAC, ready for TikTok / YouTube Shorts / Reels.
 */
export async function exportClipVertical(
  inputFilePath: string,
  layout: StreamLayout,
  captionText?: string
): Promise<Buffer> {
  const ffmpegPath = await getFFmpegPath();

  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-export-"));
  const outputPath = join(tempDir, "export.mp4");

  const W = 1080;
  const H = 1920;
  const gameH = Math.round(H * 0.62);  // 1190 px
  const camH  = H - gameH;             // 730 px

  // Write captions as an ASS subtitle file. The `subtitles` FFmpeg filter uses
  // libass which has embedded font fallback — no system font required.
  let captionFilePath: string | null = null;
  if (captionText) {
    captionFilePath = join(tempDir, "cap.ass");
    await writeFile(captionFilePath, buildAssFile(captionText, layout, W, H, gameH, camH));
  }

  // Audio is included in the filter_complex so -map "[aout]" is consistent
  // and there's no conflict with a separate -af flag.
  const filterComplex = buildVerticalFilterComplex(layout, W, H, gameH, camH, captionFilePath);

  try {
    const cmd = [
      `"${ffmpegPath}"`,
      `-fflags +genpts+igndts`,
      `-err_detect ignore_err`,
      `-i "${inputFilePath}"`,
      `-filter_complex "${filterComplex}"`,
      `-map "[vout]"`,
      `-map "[aout]"`,
      `-c:v libx264`,
      `-profile:v main`,
      `-level 4.0`,
      `-preset fast`,
      `-crf 23`,
      `-pix_fmt yuv420p`,
      `-c:a aac`,
      `-b:a 128k`,
      `-avoid_negative_ts make_zero`,
      `-movflags +faststart`,
      `-y`,
      `"${outputPath}"`,
    ].join(" ");

    try {
      await execAsync(cmd, { timeout: 180000 });
    } catch (err: any) {
      console.error("[ffmpeg] export failed:", err.stderr?.slice(-500));
      throw ffmpegError(err);
    }

    return await readFile(outputPath);
  } finally {
    await unlink(outputPath).catch(() => {});
    if (captionFilePath) await unlink(captionFilePath).catch(() => {});
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir);
    } catch {}
  }
}

// Build an ASS subtitle file for the clip caption.
// ASS uses libass (embedded in the static FFmpeg binary) which has its own
// font fallback — no system font installation required on Vercel Lambda.
//
// MarginV = distance in pixels from the bottom of the frame to the text.
// We position captions in the lower third of the game area, accounting for
// where the game panel sits in the final 1080×1920 frame.
function buildAssFile(
  text: string,
  layout: StreamLayout,
  W: number,
  H: number,
  gameH: number,
  camH: number
): string {
  // Word-wrap to ~28 chars/line, max 3 lines
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (lines.length >= 3) break;
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > 28 && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur && lines.length < 3) lines.push(cur);

  // y position of caption top from frame top
  const isTop = layout === "cam_tr" || layout === "cam_tl";
  const gameTop = layout === "no_cam" ? 0 : isTop ? camH : 0;
  const captionY = gameTop + Math.round(gameH * 0.78);
  const marginV = H - captionY; // ASS marginV = distance from bottom

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,68,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,5,0,2,60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,9:59:00.00,Default,,0,0,0,,${lines.join("\\N")}`;
}

function buildVerticalFilterComplex(
  layout: StreamLayout,
  W: number,
  H: number,
  gameH: number,
  camH: number,
  captionFilePath: string | null
): string {
  const audioChain = `[0:a]asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0[aout]`;
  const gameCrop = `crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=${W}:${gameH},setpts=PTS-STARTPTS`;
  // subtitles filter uses the path directly — Linux /tmp paths have no special chars
  const subFilter = captionFilePath ? `,subtitles=${captionFilePath}` : "";

  let videoChain: string;

  if (layout === "no_cam") {
    videoChain = `[0:v]crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=${W}:${H},setpts=PTS-STARTPTS${subFilter}[vout]`;
  } else {
    const camCorners: Record<string, string> = {
      cam_br: `iw*0.75:ih*0.75:iw*0.75:ih*0.75`,
      cam_bl: `iw*0.25:ih*0.75:0:ih*0.75`,
      cam_tr: `iw*0.25:ih*0.25:iw*0.75:0`,
      cam_tl: `iw*0.25:ih*0.25:0:0`,
    };
    const camCrop = `crop=${camCorners[layout]},scale=${W}:-2,crop=${W}:${camH}:0:(ih-${camH})/2,setpts=PTS-STARTPTS`;
    const isTop = layout === "cam_tr" || layout === "cam_tl";

    if (isTop) {
      videoChain = `[0:v]split=2[g][c];[c]${camCrop}[ct];[g]${gameCrop}[gt];[ct][gt]vstack=inputs=2${subFilter}[vout]`;
    } else {
      videoChain = `[0:v]split=2[g][c];[g]${gameCrop}[gt];[c]${camCrop}[cb];[gt][cb]vstack=inputs=2${subFilter}[vout]`;
    }
  }

  return `${videoChain};${audioChain}`;
}

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
 * Twitch VOD segments use 33-bit PTS counters starting at an arbitrary large
 * offset (e.g. 3h into a stream = ~972,000,000 in 90kHz units). When FFmpeg
 * re-encodes with these timestamps it produces time=-577014:32:22.77 and 0
 * output frames because the PTS values overflow or confuse the muxer.
 *
 * Fix: single-pass encode with setpts=PTS-STARTPTS + asetpts=PTS-STARTPTS.
 * These filters reset presentation timestamps to 0 from the first decoded
 * frame, regardless of what the input PTS values are. No intermediate file
 * needed. -ss is placed AFTER -i (slow seek) so FFmpeg decodes from the start
 * of the input — reliable since our downloaded segments only cover the clip
 * window so adjustedStart is always small (0-30s).
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
  const outputPath = join(tempDir, "clip.mp4");

  try {
    const cmd = [
      `"${ffmpegPath}"`,
      `-fflags +genpts+igndts`,
      `-err_detect ignore_err`,
      `-i "${inputFilePath}"`,
      `-ss ${safeStart}`,
      `-t ${duration}`,
      `-c:v libx264`,
      `-profile:v main`,
      `-level 4.0`,
      `-preset fast`,
      `-crf 23`,
      `-pix_fmt yuv420p`,
      `-c:a aac`,
      `-b:a 128k`,
      `-vf setpts=PTS-STARTPTS`,
      `-af asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0`,
      `-avoid_negative_ts make_zero`,
      `-movflags +faststart`,
      `-y`,
      `"${outputPath}"`,
    ].join(" ");

    try {
      await execAsync(cmd, { timeout: 180000 });
    } catch (err: any) {
      console.error("[ffmpeg] encode failed:", err.stderr?.slice(-500));
      throw ffmpegError(err);
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
