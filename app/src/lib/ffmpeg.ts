import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile, mkdtemp, access, chmod, copyFile, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  type CaptionWord,
  type CaptionStyle,
  sliceWordsForClip,
  groupWordsIntoCards,
  buildCaptionFilters,
  type CaptionCard,
} from "./captions";

export type StreamLayout = "no_cam" | "cam_br" | "cam_bl" | "cam_tr" | "cam_tl";

// The caption font is bundled with the deployment (see
// next.config.ts → outputFileTracingIncludes). On Vercel functions live
// at /var/task/, so the font ends up next to our compiled code. We copy
// it to /tmp on first use because drawtext on Vercel's read-only fs
// occasionally has issues opening files outside /tmp.
const FONT_REPO_PATH = join(process.cwd(), "src/lib/fonts/Roboto-Bold.ttf");
const FONT_TMP_PATH = "/tmp/levlcast-caption-font.ttf";

async function getCaptionFont(): Promise<string | null> {
  try {
    const s = await stat(FONT_TMP_PATH);
    if (s.size > 50_000) return FONT_TMP_PATH;
  } catch {}

  try {
    await access(FONT_REPO_PATH);
    await copyFile(FONT_REPO_PATH, FONT_TMP_PATH);
    const s = await stat(FONT_TMP_PATH);
    console.log(`[ffmpeg] Caption font ready (${s.size} bytes, bundled)`);
    return FONT_TMP_PATH;
  } catch (err) {
    console.warn("[ffmpeg] Bundled caption font not found at", FONT_REPO_PATH, "—", err);
    return null;
  }
}

/**
 * Re-encode an MP4 clip into 1080×1920 (9:16) vertical format.
 *
 * Captions are re-burned here at the correct scale for 1080px wide vertical
 * output. The horizontal R2 clip has captions burned for the original 16:9
 * width — after a 9:16 center-crop the horizontal text gets sliced off at
 * both sides and becomes unreadable. We burn fresh captions sized for the
 * vertical frame instead.
 *
 * Layout options:
 *   no_cam  — center-crop gameplay to fill the full frame
 *   cam_br  — gameplay top 62%, facecam bottom-right 38%
 *   cam_bl  — gameplay top 62%, facecam bottom-left 38%
 *   cam_tr  — facecam top-right 38%, gameplay bottom 62%
 *   cam_tl  — facecam top-left 38%, gameplay bottom 62%
 */
export async function exportClipVertical(
  inputFilePath: string,
  layout: StreamLayout,
  captionData?: {
    vodWords: CaptionWord[];
    clipStart: number;
    clipEnd: number;
    style?: CaptionStyle;
  }
): Promise<Buffer> {
  const ffmpegPath = await getFFmpegPath();

  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-export-"));
  const outputPath = join(tempDir, "export.mp4");

  const W = 1080;
  const H = 1920;
  const gameH = Math.round(H * 0.62);  // 1190 px
  const camH  = H - gameH;             // 730 px

  // Build vertical captions if word data is available.
  // Cards are clip-relative (0 = clip start). The export processes the full
  // clip (no -ss offset), so no timestamp offset is needed — unlike cutClip.
  let captionFilter = "";
  let captionFiles: string[] = [];
  if (captionData?.vodWords?.length) {
    try {
      const fontPath = await getCaptionFont();
      if (fontPath) {
        const sliced = sliceWordsForClip(captionData.vodWords, captionData.clipStart, captionData.clipEnd);
        const cards = groupWordsIntoCards(sliced);
        if (cards.length > 0) {
          // Y position within the game area so captions don't land in the facecam.
          // For cam_tr/tl the game is at the bottom (starts at y=camH).
          const isGameBottom = layout === "cam_tr" || layout === "cam_tl";
          const yExpr = isGameBottom
            ? `(${camH}+${gameH}*0.72)-(text_h/2)`
            : layout === "no_cam"
              ? `(h*0.72)-(text_h/2)`
              : `(${gameH}*0.72)-(text_h/2)`;

          const built = await buildCaptionFilters(cards, {
            fontPath,
            videoWidth: W,
            videoHeight: H,
            tempDir,
            style: captionData.style ?? "bold",
            yExpr,
            fontSize: 72,
          });
          captionFilter = built.filter;
          captionFiles = built.textFiles;
          console.log(`[export] Vertical captions: ${cards.length} cards, layout=${layout}`);
        }
      }
    } catch (err) {
      console.warn("[export] Caption build failed, exporting without captions:", err);
      captionFilter = "";
    }
  }

  const filterComplex = buildVerticalFilterComplex(layout, W, H, gameH, camH, captionFilter);

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
    for (const f of captionFiles) await unlink(f).catch(() => {});
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir);
    } catch {}
  }
}

function buildVerticalFilterComplex(
  layout: StreamLayout,
  W: number,
  H: number,
  gameH: number,
  camH: number,
  captionFilter: string = ""
): string {
  const audioChain = `[0:a]asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0[aout]`;
  const gameCrop = `crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=${W}:${gameH},setpts=PTS-STARTPTS`;
  // Caption filter starts with "," — appended directly before [vout] label
  const cap = captionFilter; // e.g. ",drawtext=...,drawtext=..."

  let videoChain: string;

  if (layout === "no_cam") {
    videoChain = `[0:v]crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=${W}:${H},setpts=PTS-STARTPTS${cap}[vout]`;
  } else {
    const camCorners: Record<string, string> = {
      cam_br: `iw*0.75:ih*0.75:iw*0.75:ih*0.75`,
      cam_bl: `iw*0.25:ih*0.75:0:ih*0.75`,
      cam_tr: `iw*0.25:ih*0.25:iw*0.75:0`,
      cam_tl: `iw*0.25:ih*0.25:0:0`,
    };
    const camCrop = `crop=${camCorners[layout]},scale=${W}:${camH}:force_original_aspect_ratio=increase,crop=${W}:${camH}:(iw-${W})/2:(ih-${camH})/2,setpts=PTS-STARTPTS`;
    const isTop = layout === "cam_tr" || layout === "cam_tl";

    if (isTop) {
      videoChain = `[0:v]split=2[g][c];[c]${camCrop}[ct];[g]${gameCrop}[gt];[ct][gt]vstack=inputs=2${cap}[vout]`;
    } else {
      videoChain = `[0:v]split=2[g][c];[g]${gameCrop}[gt];[c]${camCrop}[cb];[gt][cb]vstack=inputs=2${cap}[vout]`;
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

  // PTS rollover: negative time= in progress output
  if (/time=-\d+:\d+:\d+/.test(stderr)) {
    return new Error("FFmpeg rejected the input timestamps — the source MPEG-TS likely has gaps from missing Twitch segments. Retry the clip; if it persists the VOD is partially unavailable.");
  }

  // First pass: grab lines that look like actual FFmpeg errors
  const errorLines = lines.filter((l) =>
    /^(error|invalid|could not|no such|failed|unable|cannot|conversion failed|av_interleaved|moov atom|end of file|broken pipe)/i.test(l) ||
    /^\[.*\] (error|invalid|could not|no such|failed|unable|cannot)/i.test(l)
  );
  if (errorLines.length > 0) {
    return new Error(`FFmpeg failed: ${errorLines.slice(-4).join(" | ").slice(0, 800)}`);
  }

  // Second pass: strip all the container/metadata/progress noise and take the last useful lines
  const useful = lines.filter((l) =>
    !/^frame=|^size=|^Stream #|^\s*Metadata:|^\s*encoder\s*:|^\s*handler_name\s*:|^\s*vendor_id\s*:|^\s*major_brand|^\s*minor_version|^\s*compatible_brands|^\s*Side data:|^\s*cpb:|^Output #|^Input #|^  Duration:|^\s*Stream mapping:|^Press/i.test(l)
  );
  const tail = useful.slice(-8).join(" | ");
  if (!tail) {
    return new Error(`FFmpeg failed without an explicit error: ${err.message}`);
  }
  return new Error(`FFmpeg failed: ${tail.slice(0, 800)}`);
}

export interface CutClipOptions {
  /**
   * VOD-wide word list from Deepgram. Slice + caption-burn happens internally.
   * If absent or empty, the clip is encoded with no captions.
   */
  vodWords?: CaptionWord[] | null;
  /**
   * Absolute VOD timestamps for the clip window. Used to slice vodWords.
   * If omitted, captions are skipped (we wouldn't know how to align them).
   */
  vodWindow?: { start: number; end: number };
  /** Caption visual style. Defaults to "bold". */
  captionStyle?: CaptionStyle;
  /**
   * Pre-built caption cards in clip-relative timestamps (0 = startSeconds).
   * When supplied, bypasses the vodWords-derived card generation. Used by
   * the in-app clip editor so user-edited card text/timing wins over the
   * auto-generated set.
   */
  editedCards?: CaptionCard[];
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
 *
 * If options.vodWords + options.vodWindow are provided, word-synced captions
 * are burned into the output in the same encode pass.
 */
export async function cutClip(
  inputFilePath: string,
  startSeconds: number,
  endSeconds: number,
  options: CutClipOptions = {}
): Promise<{ captioned: Buffer; cleanSource: Buffer }> {
  const safeStart = Math.max(0, startSeconds);
  const safeEnd = endSeconds;
  if (safeEnd <= safeStart) throw new Error(`Invalid clip bounds: start=${safeStart} end=${safeEnd}`);
  if (safeEnd - safeStart < 2) throw new Error(`Clip too short: ${safeEnd - safeStart}s`);

  const ffmpegPath = await getFFmpegPath();
  const duration = safeEnd - safeStart;

  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-clip-"));
  const outputPath = join(tempDir, "clip.mp4");
  const cleanOutputPath = join(tempDir, "clip-clean.mp4");

  // Build the optional caption drawtext chain. We do this BEFORE running
  // ffmpeg so any filesystem failure throws cleanly; if the font won't
  // download we just fall back to a no-caption encode rather than failing.
  let captionFilter = "";
  let captionFiles: string[] = [];
  const haveEditedCards = (options.editedCards?.length ?? 0) > 0;
  const haveAutoSource = options.vodWords?.length && options.vodWindow;
  if (haveEditedCards || haveAutoSource) {
    try {
      const fontPath = await getCaptionFont();
      if (fontPath) {
        const cards: CaptionCard[] = haveEditedCards
          ? options.editedCards!
          : groupWordsIntoCards(
              sliceWordsForClip(options.vodWords!, options.vodWindow!.start, options.vodWindow!.end)
            );
        if (cards.length > 0) {
          // Caption cards use clip-relative timestamps (0 = clip start).
          // The FFmpeg drawtext enable expression evaluates against the
          // filter-chain PTS, where t=0 is the start of the downloaded
          // MPEG-TS file and t=safeStart is where the clip content begins.
          // Offset every card by safeStart so enable fires at the correct
          // position in the filter timeline.
          const offsetCards = cards.map((c) => ({
            ...c,
            start: c.start + safeStart,
            end: c.end + safeStart,
          }));
          for (let i = 0; i < offsetCards.length; i++) {
            const c = offsetCards[i];
            console.log(`[clip] card ${i}: ${c.start.toFixed(2)}s-${c.end.toFixed(2)}s "${c.text}"`);
          }
          // Source video resolution drives caption sizing. Most Twitch VODs
          // are 1920×1080 or 1280×720. We don't know the exact source here
          // without probing — assume 1280×720 baseline and let drawtext scale
          // proportionally. Slightly small captions on 1080p > monstrous
          // captions on 720p.
          const built = await buildCaptionFilters(offsetCards, {
            fontPath,
            videoWidth: 1280,
            videoHeight: 720,
            tempDir,
            style: options.captionStyle ?? "bold",
          });
          captionFilter = built.filter;
          captionFiles = built.textFiles;
          console.log(`[clip] Captions: ${cards.length} cards over ${duration.toFixed(1)}s`);
        }
      }
    } catch (err) {
      console.warn("[clip] Caption build failed, encoding without captions:", err);
      captionFilter = "";
    }
  }

  // Strategy: remux MPEG-TS → clean MP4 (stream copy, resets PTS), then cut
  // with stream copy. This is fast for any quality level including 1080p60
  // source (chunked) — no re-encode means seconds instead of minutes.
  // Remux must happen first because Twitch MPEG-TS segments have arbitrary
  // large PTS offsets that break muxer seeking; -avoid_negative_ts make_zero
  // normalises them to start at 0.
  // If stream copy cut fails (rare corrupted input), fall back to re-encode
  // from the already-clean remuxed file.
  const remuxedPath = join(tempDir, "clean.mp4");

  try {
    // Step 1: remux MPEG-TS → clean MP4 (stream copy, ~10-30s even for chunked)
    const remuxCmd = [
      `"${ffmpegPath}"`,
      `-fflags +genpts+igndts+discardcorrupt`,
      `-err_detect ignore_err`,
      `-i "${inputFilePath}"`,
      `-c copy`,
      `-bsf:a aac_adtstoasc`,
      `-avoid_negative_ts make_zero`,
      `-y`,
      `"${remuxedPath}"`,
    ].join(" ");
    try {
      await execAsync(remuxCmd, { timeout: 60000 });
    } catch (remuxErr: any) {
      // -bsf:a aac_adtstoasc fails on some Twitch streams whose audio is already
      // in raw AAC (not ADTS). Retry without the bitstream filter — if the audio
      // is already packetized correctly this is safe to omit.
      console.warn("[ffmpeg] remux failed, retrying without aac_adtstoasc:", remuxErr.stderr?.slice(-300));
      const remuxFallbackCmd = [
        `"${ffmpegPath}"`,
        `-fflags +genpts+igndts+discardcorrupt`,
        `-err_detect ignore_err`,
        `-max_interleave_delta 0`,
        `-i "${inputFilePath}"`,
        `-c copy`,
        `-avoid_negative_ts make_zero`,
        `-y`,
        `"${remuxedPath}"`,
      ].join(" ");
      try {
        await execAsync(remuxFallbackCmd, { timeout: 60000 });
      } catch (fallbackErr: any) {
        // Both stream-copy remuxes failed — the MPEG-TS has a genuine PTS
        // discontinuity that -avoid_negative_ts can't fix. Last resort: full
        // re-encode with setpts/asetpts to rebuild timestamps from scratch.
        // Slower (~2-3min on Vercel) but handles any timestamp corruption.
        // -genpts: generate PTS from scratch instead of reading input values.
        // -probesize/-analyzeduration: read more of the stream before decoding.
        // filter_complex with explicit mapping: more reliable than -vf/-af combo.
        console.warn("[ffmpeg] both stream-copy remuxes failed, re-encoding to fix timestamps:", fallbackErr.stderr?.slice(-300));
        const reencodeCmd = [
          `"${ffmpegPath}"`,
          `-fflags +genpts+igndts+discardcorrupt`,
          `-err_detect ignore_err`,
          `-probesize 100M`,
          `-analyzeduration 100M`,
          `-i "${inputFilePath}"`,
          `-filter_complex "[0:v]setpts=PTS-STARTPTS[vout];[0:a]asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0[aout]"`,
          `-map "[vout]"`,
          `-map "[aout]"`,
          `-c:v libx264`,
          `-preset ultrafast`,
          `-crf 18`,
          `-pix_fmt yuv420p`,
          `-c:a aac`,
          `-b:a 128k`,
          `-avoid_negative_ts make_zero`,
          `-movflags +faststart`,
          `-y`,
          `"${remuxedPath}"`,
        ].join(" ");
        try {
          await execAsync(reencodeCmd, { timeout: 300000 });
          console.warn("[ffmpeg] re-encode fallback succeeded");
        } catch (reencodeErr: any) {
          const reencodeStderr: string = reencodeErr.stderr ?? "";
          console.error("[ffmpeg] re-encode fallback also failed:", reencodeStderr.slice(-800));
          // Don't call ffmpegError() here — its time=- check fires on re-encode input
          // progress even when the encode itself is the problem. Show actual error lines.
          const reencodeLines = reencodeStderr.split("\n").map((l: string) => l.trim()).filter(Boolean);
          const errLines = reencodeLines.filter((l: string) =>
            /^(error|invalid|could not|no such|failed|unable|cannot|conversion failed)/i.test(l) ||
            /^\[.*\] (error|invalid|could not|failed)/i.test(l)
          );
          const errDetail = errLines.length > 0
            ? errLines.slice(-4).join(" | ").slice(0, 600)
            : reencodeStderr.slice(-400) || reencodeErr.message;
          throw new Error(`FFmpeg failed (all fallbacks exhausted): ${errDetail}`);
        }
      }
    }
    console.log(`[ffmpeg] Remux complete → ${remuxedPath}`);

    // Step 2: stream copy cut → always produced as the clean source for vertical export.
    const cleanCopyCmd = [
      `"${ffmpegPath}"`,
      `-i "${remuxedPath}"`,
      `-ss ${safeStart}`,
      `-t ${duration}`,
      `-c copy`,
      `-avoid_negative_ts make_zero`,
      `-movflags +faststart`,
      `-y`,
      `"${cleanOutputPath}"`,
    ].join(" ");
    let cleanBuffer: Buffer;
    try {
      await execAsync(cleanCopyCmd, { timeout: 30000 });
      console.log(`[ffmpeg] Stream copy cut complete (clean source)`);
      cleanBuffer = await readFile(cleanOutputPath);
    } catch (copyErr: any) {
      // Fallback: re-encode without captions for clean source. Same CFR
      // and audio-sync tweaks as the captioned encode below.
      console.warn("[ffmpeg] Stream copy cut failed, re-encoding clean source:", copyErr.stderr?.slice(-400));
      const encodeArgs = [
        `"${ffmpegPath}"`,
        `-i "${remuxedPath}"`,
        `-ss ${safeStart}`,
        `-t ${duration}`,
        `-c:v libx264 -profile:v main -level 4.0 -preset fast -crf 23 -pix_fmt yuv420p`,
        `-c:a aac -b:a 128k`,
        `-vf setpts=PTS-STARTPTS -af asetpts=PTS-STARTPTS,aresample=async=1`,
        `-fps_mode cfr -r 30`,
        `-avoid_negative_ts make_zero -movflags +faststart -max_muxing_queue_size 9999`,
        `-y "${cleanOutputPath}"`,
      ].join(" ");
      try {
        await execAsync(encodeArgs, { timeout: 180000 });
        cleanBuffer = await readFile(cleanOutputPath);
      } catch (encErr: any) {
        console.error("[ffmpeg] clean source encode failed:", encErr.stderr?.slice(-800));
        throw ffmpegError(encErr);
      }
    }

    // Step 3: if captions requested, re-encode with drawtext burn for the web player clip.
    // The clean source is kept separately so the vertical export can re-burn at the correct
    // 1080px vertical scale without inheriting oversized horizontal captions.
    //
    // Two encode tweaks vs the original cutClip pipeline:
    //   - -fps_mode cfr forces a constant framerate. Without it, VFR sources
    //     (some Twitch encodings) produce VFR output and browsers stutter
    //     on the discontinuities — what users were seeing as "clips freezing".
    //   - aresample drops the first_pts=0 hack. With -ss after -i, video
    //     frames keep source-relative PTS while first_pts=0 was forcing audio
    //     to start at 0, producing a small video/audio offset. Captions are
    //     locked to video, so the offset showed up as "captions slightly
    //     ahead of audio". -avoid_negative_ts make_zero handles normalisation.
    if (captionFilter) {
      const encodeArgs = [
        `"${ffmpegPath}"`,
        `-i "${remuxedPath}"`,
        `-ss ${safeStart}`,
        `-t ${duration}`,
        `-c:v libx264 -profile:v main -level 4.0 -preset fast -crf 23 -pix_fmt yuv420p`,
        `-c:a aac -b:a 128k`,
        `-filter_complex "[0:v]setpts=PTS-STARTPTS${captionFilter}[vout];[0:a]asetpts=PTS-STARTPTS,aresample=async=1[aout]" -map "[vout]" -map "[aout]"`,
        `-fps_mode cfr -r 30`,
        `-avoid_negative_ts make_zero -movflags +faststart -max_muxing_queue_size 9999`,
        `-y "${outputPath}"`,
      ].join(" ");
      try {
        await execAsync(encodeArgs, { timeout: 180000 });
        console.log(`[ffmpeg] Caption encode complete (CFR 30fps)`);
        return { captioned: await readFile(outputPath), cleanSource: cleanBuffer };
      } catch (encErr: any) {
        console.error("[ffmpeg] caption encode failed:", encErr.stderr?.slice(-800));
        throw ffmpegError(encErr);
      }
    }

    return { captioned: cleanBuffer, cleanSource: cleanBuffer };
  } finally {
    await unlink(remuxedPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await unlink(cleanOutputPath).catch(() => {});
    for (const f of captionFiles) await unlink(f).catch(() => {});
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir);
    } catch {}
  }
}

/**
 * Extract a single JPEG frame at `timeSeconds` from an MP4 file.
 *
 * Used by the hook-frame picker in the clip editor: we pull 4 candidate
 * frames from a clip and let the streamer choose which one represents the
 * thumbnail. Output is a small ~85% JPEG so the picker loads instantly.
 */
export async function extractFrame(
  inputFilePath: string,
  timeSeconds: number
): Promise<Buffer> {
  const ffmpegPath = await getFFmpegPath();
  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-frame-"));
  const outputPath = join(tempDir, "frame.jpg");

  try {
    const cmd = [
      `"${ffmpegPath}"`,
      `-ss ${Math.max(0, timeSeconds)}`,
      `-i "${inputFilePath}"`,
      `-frames:v 1`,
      `-q:v 4`,
      `-y`,
      `"${outputPath}"`,
    ].join(" ");
    await execAsync(cmd, { timeout: 30000 });
    return await readFile(outputPath);
  } finally {
    await unlink(outputPath).catch(() => {});
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir);
    } catch {}
  }
}

/**
 * Concatenate already-cut clip buffers into a single highlight reel video.
 *
 * Inputs are expected to be the captioned MP4 buffers returned by cutClip().
 * Because cutClip emits consistent h264 main + aac at a baseline 1280×720
 * pipeline, the concat demuxer can stream-copy them in sequence, which
 * finishes in under 5 seconds for a 60s reel. If stream-copy fails (codec
 * mismatch, container quirks), we fall back to a re-encode so the function
 * still produces a usable output rather than throwing.
 *
 * Pass forceReencode=true for the *clean* reel concat. Clean per-segment
 * buffers come from stream-copy cuts of the original Twitch MPEG-TS, which
 * inherits whatever encoding parameters Twitch served. Two segments from
 * different parts of a stream often have subtly different codec params
 * (profile, level, chroma) — the concat demuxer accepts them but browsers
 * stutter on the discontinuity. Re-encoding normalises everything.
 *
 * Used by the highlight-reel API to stitch the top N moments of a stream
 * into one short. Captions are baked into each segment by cutClip; we don't
 * re-burn anything here.
 */
export async function concatClipBuffers(
  buffers: Buffer[],
  options: { forceReencode?: boolean } = {}
): Promise<Buffer> {
  if (buffers.length === 0) throw new Error("concatClipBuffers: no inputs");
  if (buffers.length === 1) return buffers[0];

  const ffmpegPath = await getFFmpegPath();
  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-reel-"));
  const inputPaths: string[] = [];
  const outputPath = join(tempDir, "reel.mp4");
  const reencodePath = join(tempDir, "reel-reencode.mp4");
  const listPath = join(tempDir, "concat.txt");

  try {
    for (let i = 0; i < buffers.length; i++) {
      const p = join(tempDir, `seg${i}.mp4`);
      await writeFile(p, buffers[i]);
      inputPaths.push(p);
    }

    // concat demuxer expects file paths quoted; use POSIX-style forward slashes
    // even on Windows because ffmpeg's demuxer parser treats backslashes as
    // escapes. The -safe 0 flag waives the demuxer's path-safety check that
    // blocks anything but plain relative names by default.
    const concatBody = inputPaths
      .map((p) => `file '${p.replace(/\\/g, "/")}'`)
      .join("\n");
    await writeFile(listPath, concatBody + "\n");

    // Stream-copy attempt — fast, no quality loss. Skipped when the caller
    // knows segments have inconsistent codec params (e.g. clean reels built
    // from raw Twitch MPEG-TS slices).
    if (!options.forceReencode) {
      const copyCmd = [
        `"${ffmpegPath}"`,
        `-f concat -safe 0`,
        `-i "${listPath}"`,
        `-c copy`,
        `-movflags +faststart`,
        `-y`,
        `"${outputPath}"`,
      ].join(" ");

      try {
        await execAsync(copyCmd, { timeout: 60000 });
        console.log(`[reel] Stream-copied ${buffers.length} segments`);
        return await readFile(outputPath);
      } catch (copyErr: any) {
        console.warn("[reel] Stream copy failed, re-encoding:", copyErr.stderr?.slice(-300));
      }
    }

    // Fallback: re-encode through filter_complex concat. Slower but tolerates
    // codec/parameter drift between segments.
    const inputArgs = inputPaths.map((p) => `-i "${p}"`).join(" ");
    const concatStreams = inputPaths
      .map((_, i) => `[${i}:v:0][${i}:a:0]`)
      .join("");
    const filter = `${concatStreams}concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`;

    const reencodeCmd = [
      `"${ffmpegPath}"`,
      inputArgs,
      `-filter_complex "${filter}"`,
      `-map "[outv]" -map "[outa]"`,
      `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p`,
      `-c:a aac -b:a 128k`,
      `-movflags +faststart`,
      `-y`,
      `"${reencodePath}"`,
    ].join(" ");

    try {
      await execAsync(reencodeCmd, { timeout: 240000 });
      console.log(`[reel] Re-encoded ${buffers.length} segments`);
      return await readFile(reencodePath);
    } catch (encErr: any) {
      console.error("[reel] Concat re-encode failed:", encErr.stderr?.slice(-800));
      throw ffmpegError(encErr);
    }
  } finally {
    for (const p of inputPaths) await unlink(p).catch(() => {});
    await unlink(listPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await unlink(reencodePath).catch(() => {});
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir);
    } catch {}
  }
}
