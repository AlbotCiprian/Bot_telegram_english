import fs from "node:fs";
import path from "node:path";
import {
  getLessonStreamAsset,
  getServiceStreamAsset,
  listLessonStreamAssets,
  listServiceStreamAssets,
} from "../services/streamingAssets.js";

const STREAM_ROOT = path.resolve(process.cwd(), "stream");

function assertExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Lipsește fișierul: ${filePath}`);
  }
}

async function main() {
  const errors: string[] = [];

  for (const asset of listLessonStreamAssets()) {
    try {
      const lessonDir = path.resolve(STREAM_ROOT, "hls", asset.streamKey);
      const posterPath = path.resolve(STREAM_ROOT, "posters", asset.posterFileName);
      assertExists(path.join(lessonDir, "master.m3u8"));
      assertExists(posterPath);

      for (const rendition of getLessonStreamAsset(asset.dayNumber).renditions) {
        assertExists(path.join(lessonDir, rendition.playlistFileName));
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  for (const asset of listServiceStreamAssets()) {
    try {
      const serviceAsset = getServiceStreamAsset(asset.serviceKey);
      assertExists(path.resolve(STREAM_ROOT, "mp4", serviceAsset.outputFileName));
      assertExists(path.resolve(STREAM_ROOT, "posters", serviceAsset.posterFileName));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  console.log("Toate asset-urile de streaming au fost verificate cu succes.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
