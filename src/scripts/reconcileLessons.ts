import { prisma } from "../db/client.js";
import { campaignQueue } from "../services/queue.js";
import { parseLessonRecoveryBackfill, reconcileFreeLessonNotifications } from "../services/lessonRecoveryService.js";
import { logger } from "../utils/logger.js";

type CliOptions = {
  mode: "dry-run" | "apply";
  backfill: ReturnType<typeof parseLessonRecoveryBackfill>;
};

function parseCliArgs(argv: string[]): CliOptions {
  const hasApply = argv.includes("--apply");
  const hasDryRun = argv.includes("--dry-run");
  const backfillArg = argv.find((value) => value.startsWith("--backfill="));

  return {
    mode: hasApply ? "apply" : hasDryRun ? "dry-run" : "dry-run",
    backfill: parseLessonRecoveryBackfill(backfillArg?.split("=")[1]),
  };
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const report = await reconcileFreeLessonNotifications(options);

  logger.info(
    {
      mode: report.mode,
      backfill: report.backfill,
      summary: report.summary,
      actionsPreview: report.actions.slice(0, 20),
    },
    "Lesson notifications reconciliation finished.",
  );

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Lesson notifications reconciliation failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await campaignQueue.close();
    await prisma.$disconnect();
  });
