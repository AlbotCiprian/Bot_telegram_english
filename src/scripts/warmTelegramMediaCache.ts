import { SERVICE_VIDEO_FILES, STATIC_PAGES } from "../content/staticContent.js";
import { buildMediaAssetKey, sendVideoAsset } from "../services/mediaAssetService.js";
import { resolveExistingMediaFile } from "../utils/mediaAssets.js";
import { config, isConfigured } from "../utils/config.js";

async function main() {
  if (!isConfigured(config.MEDIA_WARMUP_CHAT_ID)) {
    throw new Error("MEDIA_WARMUP_CHAT_ID lipsește. Setează chatul în care vrei să preîncarci media.");
  }

  const assets = [
    {
      scope: "service",
      fileName: SERVICE_VIDEO_FILES.teachingMethod,
      title: STATIC_PAGES.method.title,
      body: STATIC_PAGES.method.body,
    },
    {
      scope: "service",
      fileName: SERVICE_VIDEO_FILES.aboutAcademy,
      title: STATIC_PAGES.academy.title,
      body: STATIC_PAGES.academy.body,
    },
    {
      scope: "service",
      fileName: SERVICE_VIDEO_FILES.fearSpeaking,
      title: STATIC_PAGES.fear_speaking.title,
      body: STATIC_PAGES.fear_speaking.body,
    },
  ];

  for (const asset of assets) {
    const localPath = resolveExistingMediaFile(asset.fileName);
    if (!localPath) {
      console.log(`Săr asset-ul ${asset.fileName}: fișierul nu există local.`);
      continue;
    }

    const result = await sendVideoAsset({
      chatId: config.MEDIA_WARMUP_CHAT_ID,
      assetKey: buildMediaAssetKey(asset.scope, asset.fileName),
      localFilePath: localPath,
      sourceFileName: asset.fileName,
      uploadNoticeText: `Pregătesc asset-ul ${asset.fileName} pentru cache.`,
      options: {
        caption: `*${asset.title}*\n\n${asset.body}`,
        parse_mode: "Markdown",
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
