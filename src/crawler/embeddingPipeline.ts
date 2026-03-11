import { prisma } from "../db/client.js";
import { replaceChunkDocuments } from "../services/vectorService.js";
import { logger } from "../utils/logger.js";

async function runEmbeddingPipeline(): Promise<void> {
  const pages = await prisma.document.findMany({
    where: { kind: "page" },
    orderBy: { url: "asc" },
  });

  let totalChunks = 0;
  for (const page of pages) {
    totalChunks += await replaceChunkDocuments({
      source: page.source,
      url: page.url,
      title: page.title,
      content: page.content,
    });
  }

  logger.info({ pages: pages.length, totalChunks }, "Embedding pipeline finalizat.");
}

runEmbeddingPipeline().catch((error) => {
  logger.error({ err: error }, "Embedding pipeline esuat.");
  process.exit(1);
});
