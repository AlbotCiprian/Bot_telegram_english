import { prisma } from "../db/client.js";
import { asJson } from "../utils/json.js";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { normalizeWhitespace } from "../utils/validators.js";

type PageDocumentInput = {
  source: string;
  url: string;
  title?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
};

type VectorSearchRow = {
  id: number;
  source: string;
  url: string;
  title: string | null;
  content: string;
  score: number;
};

export function splitIntoChunks(text: string, chunkSize = 500, overlap = 60): string[] {
  const words = normalizeWhitespace(text).split(" ").filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

function hashToken(token: string, dimension: number): number {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return hash % dimension;
}

export function embedTextLocally(text: string, dimension = config.EMBEDDING_DIMENSION): number[] {
  const vector = Array.from({ length: dimension }, () => 0);
  const tokens = normalizeWhitespace(text).toLowerCase().split(" ").filter(Boolean);

  for (const token of tokens) {
    const index = hashToken(token, dimension);
    vector[index] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(8)));
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export async function upsertPageDocument(input: PageDocumentInput): Promise<void> {
  await prisma.document.upsert({
    where: {
      url_kind_chunkIndex: {
        url: input.url,
        kind: "page",
        chunkIndex: 0,
      },
    },
    update: {
      source: input.source,
      title: input.title ?? null,
      content: input.content,
      metadata: asJson(input.metadata ?? {}),
    },
    create: {
      source: input.source,
      url: input.url,
      title: input.title ?? null,
      kind: "page",
      chunkIndex: 0,
      content: input.content,
      metadata: asJson(input.metadata ?? {}),
    },
  });
}

export async function replaceChunkDocuments(page: {
  source: string;
  url: string;
  title: string | null;
  content: string;
}): Promise<number> {
  const chunks = splitIntoChunks(page.content);

  await prisma.document.deleteMany({
    where: {
      url: page.url,
      kind: "chunk",
    },
  });

  for (const [index, chunk] of chunks.entries()) {
    const embedding = toVectorLiteral(embedTextLocally(chunk));
    const metadata = JSON.stringify({
      sourceUrl: page.url,
      chunkLength: chunk.length,
    });

    await prisma.$executeRaw`
      INSERT INTO "documents" (
        "source",
        "url",
        "title",
        "kind",
        "chunk_index",
        "content",
        "metadata",
        "embedding",
        "created_at",
        "updated_at"
      )
      VALUES (
        ${page.source},
        ${page.url},
        ${page.title},
        'chunk',
        ${index + 1},
        ${chunk},
        ${metadata}::jsonb,
        ${embedding}::vector,
        NOW(),
        NOW()
      )
      ON CONFLICT ("url", "kind", "chunk_index")
      DO UPDATE SET
        "title" = EXCLUDED."title",
        "content" = EXCLUDED."content",
        "metadata" = EXCLUDED."metadata",
        "embedding" = EXCLUDED."embedding",
        "updated_at" = NOW();
    `;
  }

  logger.info({ url: page.url, chunks: chunks.length }, "Chunk-uri actualizate.");
  return chunks.length;
}

export async function searchRelevantDocuments(question: string, topK = 5): Promise<VectorSearchRow[]> {
  const embedding = toVectorLiteral(embedTextLocally(question));
  const result = (await prisma.$queryRaw`
    SELECT
      "id",
      "source",
      "url",
      "title",
      "content",
      1 - ("embedding" <=> ${embedding}::vector) AS "score"
    FROM "documents"
    WHERE "kind" = 'chunk'
      AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${embedding}::vector
    LIMIT ${topK};
  `) as VectorSearchRow[];

  return result;
}
