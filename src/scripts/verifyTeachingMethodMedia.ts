import fs from "node:fs";
import path from "node:path";
import { SERVICE_VIDEO_FILES } from "../content/staticContent.js";
import { prisma } from "../db/client.js";
import { buildMediaAssetKey } from "../services/mediaAssetService.js";
import { resolveExistingMediaFile } from "../utils/mediaAssets.js";

async function main() {
  const sourceFileName = SERVICE_VIDEO_FILES.teachingMethod;
  const assetKey = buildMediaAssetKey("service", sourceFileName);
  const expectedPath = path.resolve(process.cwd(), "video", sourceFileName);
  const exactExists = fs.existsSync(expectedPath);
  const exactSize = exactExists ? fs.statSync(expectedPath).size : 0;
  const resolvedPath = resolveExistingMediaFile(sourceFileName);
  let cachedAsset: Awaited<ReturnType<typeof prisma.telegramMediaAsset.findUnique>> | null = null;
  let cacheError: string | null = null;

  try {
    cachedAsset = await prisma.telegramMediaAsset.findUnique({
      where: { assetKey },
    });
  } catch (error) {
    cacheError = error instanceof Error ? error.message : String(error);
  }

  console.log("Teaching method media verification");
  console.log(`asset_key=${assetKey}`);
  console.log(`source_file_name=${sourceFileName}`);
  console.log(`expected_path=${expectedPath}`);
  console.log(`expected_exists=${exactExists}`);
  console.log(`expected_size=${exactSize}`);
  console.log(`resolved_path=${resolvedPath ?? ""}`);
  console.log(`cache_present=${Boolean(cachedAsset)}`);
  console.log(`cache_source_file_name=${cachedAsset?.sourceFileName ?? ""}`);
  console.log(`cache_updated_at=${cachedAsset?.updatedAt?.toISOString() ?? ""}`);
  console.log(`cache_error=${cacheError ?? ""}`);

  await prisma.$disconnect();

  if (!exactExists) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
