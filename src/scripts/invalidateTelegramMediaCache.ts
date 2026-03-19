import { invalidateMediaAssetCache } from "../services/mediaAssetService.js";
import { closeResetResources } from "../services/resetService.js";

async function main(): Promise<void> {
  const values = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);

  if (values.length === 0) {
    console.error("Furnizează cel puțin un assetKey sau sourceFileName pentru invalidare.");
    process.exit(1);
  }

  const result = await invalidateMediaAssetCache({
    assetKeys: values,
    sourceFileNames: values,
  });

  console.log(`Au fost invalidate ${result.count} intrări din cache-ul media Telegram.`);
}

main()
  .catch(async (error) => {
    console.error("Invalidarea cache-ului media Telegram a eșuat.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeResetResources();
  });
