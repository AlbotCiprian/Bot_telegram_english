import fs from "node:fs";
import path from "node:path";
import { SERVICE_VIDEO_FILES, STATIC_PAGES } from "../content/staticContent.js";
import { buildMediaAssetKey, sendVideoAsset } from "../services/mediaAssetService.js";
import { resolveExistingMediaFile } from "../utils/mediaAssets.js";
import { config, isConfigured } from "../utils/config.js";

function resolveTeachingMethodVideoPath(fileName: string): string | null {
  const exactPath = path.resolve(process.cwd(), "video", fileName);
  if (!fs.existsSync(exactPath)) {
    return null;
  }

  try {
    if (fs.statSync(exactPath).isFile()) {
      return exactPath;
    }
  } catch {
    return null;
  }

  return null;
}

async function main() {
  if (!isConfigured(config.MEDIA_WARMUP_CHAT_ID)) {
    throw new Error("MEDIA_WARMUP_CHAT_ID lipsește. Setează chatul în care vrei să preîncarci media.");
  }

  const assets = [
    {
      kind: "video",
      fileName: SERVICE_VIDEO_FILES.teachingMethod,
      assetKey: buildMediaAssetKey("service", SERVICE_VIDEO_FILES.teachingMethod),
      sourceFileName: SERVICE_VIDEO_FILES.teachingMethod,
      title: STATIC_PAGES.method.title,
      body: STATIC_PAGES.method.body,
    },
    {
      kind: "video",
      fileName: SERVICE_VIDEO_FILES.aboutAcademy,
      assetKey: buildMediaAssetKey("service", SERVICE_VIDEO_FILES.aboutAcademy),
      sourceFileName: SERVICE_VIDEO_FILES.aboutAcademy,
      title: STATIC_PAGES.academy.title,
      body: STATIC_PAGES.academy.body,
    },
    {
      kind: "video",
      fileName: SERVICE_VIDEO_FILES.fearSpeaking,
      assetKey: buildMediaAssetKey("service", SERVICE_VIDEO_FILES.fearSpeaking),
      sourceFileName: SERVICE_VIDEO_FILES.fearSpeaking,
      title: STATIC_PAGES.fear_speaking.title,
      body: STATIC_PAGES.fear_speaking.body,
    },
    {
      kind: "video",
      fileName: path.resolve(config.STREAM_MP4_ROOT, "career-astrology.mp4"),
      assetKey: buildMediaAssetKey("service", "career-astrology.mp4"),
      sourceFileName: "career-astrology.mp4",
      title: STATIC_PAGES.astrology.title,
      body: STATIC_PAGES.astrology.body,
    },
  ];

  for (const asset of assets) {
    const localPath = asset.fileName === SERVICE_VIDEO_FILES.teachingMethod
      ? resolveTeachingMethodVideoPath(asset.fileName)
      : resolveExistingMediaFile(asset.fileName);
    if (!localPath) {
      console.log(`Săr asset-ul ${asset.fileName}: fișierul nu există local.`);
      continue;
    }

    const commonParams = {
      chatId: config.MEDIA_WARMUP_CHAT_ID,
      assetKey: asset.assetKey,
      localFilePath: localPath,
      sourceFileName: asset.sourceFileName,
      uploadNoticeText: `Pregătesc asset-ul ${asset.fileName} pentru cache.`,
      options: {
        caption: `*${asset.title}*\n\n${asset.body}`,
        parse_mode: "Markdown" as const,
      },
    };

    const result = await sendVideoAsset({
      ...commonParams,
      options: {
        ...commonParams.options,
        supports_streaming: true,
      },
    });

    console.log(`${asset.fileName}: ${result}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
