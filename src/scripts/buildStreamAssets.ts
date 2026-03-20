import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { getLessonStreamAsset, listLessonStreamAssets, type LessonDay } from "../services/streamingAssets.js";
import { resolveExistingMediaFile } from "../utils/mediaAssets.js";

const STREAM_ROOT = path.resolve(process.cwd(), "stream");
const HLS_ROOT = path.resolve(STREAM_ROOT, "hls");
const POSTER_ROOT = path.resolve(STREAM_ROOT, "posters");
const MANIFEST_PATH = path.resolve(STREAM_ROOT, "manifest.json");

function getSelectedDaysFromArgs(): LessonDay[] {
  const providedDays = process.argv
    .slice(2)
    .map((value) => Number(value))
    .filter((value): value is LessonDay => value === 1 || value === 2 || value === 3);

  return providedDays.length > 0 ? providedDays : listLessonStreamAssets().map((asset) => asset.dayNumber);
}

async function ensureDirectory(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function runFfmpeg(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`ffmpeg a ieșit cu codul ${code ?? -1}.`));
    });
  });
}

function buildMasterPlaylist(dayNumber: LessonDay) {
  const asset = getLessonStreamAsset(dayNumber);
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
  ];

  for (const rendition of asset.renditions) {
    const width = rendition.height === 480 ? 854 : 1280;
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth},AVERAGE-BANDWIDTH=${rendition.averageBandwidth},RESOLUTION=${width}x${rendition.height},CODECS="avc1.4d401f,mp4a.40.2"`,
      rendition.playlistFileName,
    );
  }

  return `${lines.join("\n")}\n`;
}

async function buildPoster(inputPath: string, outputPath: string) {
  await runFfmpeg(["-y", "-ss", "00:00:02", "-i", inputPath, "-frames:v", "1", "-q:v", "2", outputPath]);
}

async function buildRendition(params: {
  inputPath: string;
  outputDir: string;
  height: 480 | 720;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  playlistFileName: string;
}) {
  const baseName = params.height === 480 ? "480p" : "720p";

  await runFfmpeg([
    "-y",
    "-i",
    params.inputPath,
    "-vf",
    `scale=-2:${params.height}`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-profile:v",
    "main",
    "-crf",
    "21",
    "-g",
    "48",
    "-keyint_min",
    "48",
    "-sc_threshold",
    "0",
    "-b:v",
    `${params.videoBitrateKbps}k`,
    "-maxrate",
    `${Math.round(params.videoBitrateKbps * 1.15)}k`,
    "-bufsize",
    `${params.videoBitrateKbps * 2}k`,
    "-c:a",
    "aac",
    "-b:a",
    `${params.audioBitrateKbps}k`,
    "-ac",
    "2",
    "-ar",
    "48000",
    "-hls_time",
    "6",
    "-hls_playlist_type",
    "vod",
    "-hls_flags",
    "independent_segments",
    "-hls_segment_filename",
    path.join(params.outputDir, `${baseName}_%03d.ts`),
    path.join(params.outputDir, params.playlistFileName),
  ]);
}

async function buildLessonStream(dayNumber: LessonDay) {
  const asset = getLessonStreamAsset(dayNumber);
  const inputPath = resolveExistingMediaFile(asset.sourceFileName);

  if (!inputPath) {
    throw new Error(`Nu am găsit sursa video pentru lecția ${dayNumber}: ${asset.sourceFileName}`);
  }

  const lessonDir = path.resolve(HLS_ROOT, asset.streamKey);
  await ensureDirectory(lessonDir);
  await ensureDirectory(POSTER_ROOT);

  for (const rendition of asset.renditions) {
    await buildRendition({
      inputPath,
      outputDir: lessonDir,
      height: rendition.height,
      videoBitrateKbps: rendition.videoBitrateKbps,
      audioBitrateKbps: rendition.audioBitrateKbps,
      playlistFileName: rendition.playlistFileName,
    });
  }

  await fs.writeFile(path.join(lessonDir, "master.m3u8"), buildMasterPlaylist(dayNumber), "utf8");
  await buildPoster(inputPath, path.join(POSTER_ROOT, asset.posterFileName));

  return {
    dayNumber,
    lessonKey: asset.lessonKey,
    sourceFileName: asset.sourceFileName,
    streamKey: asset.streamKey,
    renditions: asset.renditions.map((item) => item.height),
    generatedAt: new Date().toISOString(),
  };
}

async function main() {
  const selectedDays = getSelectedDaysFromArgs();
  await ensureDirectory(HLS_ROOT);
  await ensureDirectory(POSTER_ROOT);

  const manifest = [];
  for (const dayNumber of selectedDays) {
    manifest.push(await buildLessonStream(dayNumber));
  }

  await fs.writeFile(
    MANIFEST_PATH,
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        assets: manifest,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Stream assets generate cu succes pentru lecțiile: ${selectedDays.join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
