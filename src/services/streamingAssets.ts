import fs from "node:fs";
import path from "node:path";
import { LESSON_SEED_CONTENT } from "../content/staticContent.js";
import { config } from "../utils/config.js";

export type LessonDay = 1 | 2 | 3;

export type StreamRendition = {
  height: 480 | 720;
  bandwidth: number;
  averageBandwidth: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  playlistFileName: string;
};

export type LessonStreamAsset = {
  dayNumber: LessonDay;
  lessonKey: string;
  title: string;
  sourceFileName: string;
  streamKey: string;
  posterFileName: string;
  deliveryMode: "internal_stream";
  renditions: StreamRendition[];
};

const DEFAULT_RENDITIONS: StreamRendition[] = [
  {
    height: 480,
    bandwidth: 646_000,
    averageBandwidth: 590_000,
    videoBitrateKbps: 550,
    audioBitrateKbps: 96,
    playlistFileName: "480p.m3u8",
  },
  {
    height: 720,
    bandwidth: 1_046_000,
    averageBandwidth: 980_000,
    videoBitrateKbps: 900,
    audioBitrateKbps: 96,
    playlistFileName: "720p.m3u8",
  },
];

const LESSON_STREAM_ASSETS: LessonStreamAsset[] = LESSON_SEED_CONTENT.map((lesson) => ({
  dayNumber: lesson.dayNumber as LessonDay,
  lessonKey: lesson.key,
  title: lesson.title,
  sourceFileName: lesson.mediaUrl,
  streamKey: `lesson-${lesson.dayNumber}`,
  posterFileName: `lesson-${lesson.dayNumber}.jpg`,
  deliveryMode: "internal_stream",
  renditions: DEFAULT_RENDITIONS,
}));

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function listLessonStreamAssets(): LessonStreamAsset[] {
  return LESSON_STREAM_ASSETS;
}

export function getLessonStreamAsset(dayNumber: LessonDay): LessonStreamAsset {
  const asset = LESSON_STREAM_ASSETS.find((item) => item.dayNumber === dayNumber);
  if (!asset) {
    throw new Error(`Nu există asset de streaming pentru lecția ${dayNumber}.`);
  }

  return asset;
}

export function getStreamPublicBaseUrl(): string {
  return stripTrailingSlash(config.STREAM_PUBLIC_BASE_URL);
}

export function getStreamManifestPath(asset: LessonStreamAsset): string {
  return path.resolve(config.STREAM_HLS_ROOT, asset.streamKey, "master.m3u8");
}

export function getStreamPosterPath(asset: LessonStreamAsset): string {
  return path.resolve(config.STREAM_POSTER_ROOT, asset.posterFileName);
}

export function getStreamManifestUrl(asset: LessonStreamAsset): string {
  return `/stream/hls/${asset.streamKey}/master.m3u8`;
}

export function getStreamPosterUrl(asset: LessonStreamAsset): string {
  return `/stream/posters/${asset.posterFileName}`;
}

export function getAbsoluteWatchUrl(dayNumber: LessonDay, token: string): string {
  return `${getStreamPublicBaseUrl()}/watch/lesson/${dayNumber}?token=${encodeURIComponent(token)}`;
}

export function isLessonStreamReady(dayNumber: LessonDay): boolean {
  const asset = getLessonStreamAsset(dayNumber);
  return fs.existsSync(getStreamManifestPath(asset)) && fs.existsSync(getStreamPosterPath(asset));
}

export function getStreamAssetSummary(dayNumber: LessonDay) {
  const asset = getLessonStreamAsset(dayNumber);
  return {
    dayNumber: asset.dayNumber,
    lessonKey: asset.lessonKey,
    title: asset.title,
    sourceFileName: asset.sourceFileName,
    streamKey: asset.streamKey,
    deliveryMode: asset.deliveryMode,
    manifestPath: getStreamManifestPath(asset),
    posterPath: getStreamPosterPath(asset),
    manifestUrl: getStreamManifestUrl(asset),
    posterUrl: getStreamPosterUrl(asset),
    ready: isLessonStreamReady(dayNumber),
  };
}
