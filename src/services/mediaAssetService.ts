import { Input } from "telegraf";
import { ForceReply, InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove } from "telegraf/types";
import { prisma } from "../db/client.js";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { releaseRedisLock, tryAcquireRedisLock } from "./redis.js";
import { getTelegramClient } from "./telegram.js";

type VideoSendOptions = {
  caption: string;
  parse_mode?: "Markdown";
  supports_streaming?: boolean;
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;
};

type SendVideoAssetParams = {
  chatId: string;
  assetKey: string;
  localFilePath: string | null;
  sourceFileName?: string | null;
  options: VideoSendOptions;
  uploadNoticeText?: string;
  missingFileText?: string;
  uploadFailedText?: string;
};

type DocumentSendOptions = {
  caption: string;
  parse_mode?: "Markdown";
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;
  disable_content_type_detection?: boolean;
};

type SendDocumentAssetParams = {
  chatId: string;
  assetKey: string;
  localFilePath: string | null;
  sourceFileName?: string | null;
  options: DocumentSendOptions;
  uploadNoticeText?: string;
  missingFileText?: string;
  uploadFailedText?: string;
};

type SendMediaAssetStatus = "cached" | "uploaded" | "missing" | "failed";

type InvalidateMediaAssetCacheParams = {
  assetKeys?: string[];
  sourceFileNames?: string[];
};

function getTelegramErrorDescription(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const response = (error as { response?: { description?: string } }).response;
  return typeof response?.description === "string" ? response.description : null;
}

function extractTelegramFileId(message: unknown): { fileId?: string; uniqueId?: string } {
  if (!message || typeof message !== "object") {
    return {};
  }

  const video = (message as { video?: { file_id?: string; file_unique_id?: string } }).video;
  if (video?.file_id) {
    return {
      fileId: video.file_id,
      uniqueId: video.file_unique_id,
    };
  }

  const document = (message as { document?: { file_id?: string; file_unique_id?: string } }).document;
  if (document?.file_id) {
    return {
      fileId: document.file_id,
      uniqueId: document.file_unique_id,
    };
  }

  return {};
}

async function waitForCachedAsset(assetKey: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const cachedAsset = await prisma.telegramMediaAsset.findUnique({
      where: { assetKey },
    });

    if (cachedAsset?.telegramFileId) {
      return cachedAsset;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return null;
}

export function buildMediaAssetKey(scope: string, fileName: string): string {
  return `${scope}:${fileName}`;
}

export async function invalidateMediaAssetCache(params: InvalidateMediaAssetCacheParams) {
  const assetKeys = params.assetKeys?.filter(Boolean) ?? [];
  const sourceFileNames = params.sourceFileNames?.filter(Boolean) ?? [];

  if (assetKeys.length === 0 && sourceFileNames.length === 0) {
    return { count: 0 };
  }

  const orConditions: Array<Record<string, unknown>> = [];
  if (assetKeys.length > 0) {
    orConditions.push({
      assetKey: {
        in: assetKeys,
      },
    });
  }

  if (sourceFileNames.length > 0) {
    orConditions.push({
      sourceFileName: {
        in: sourceFileNames,
      },
    });
  }

  return prisma.telegramMediaAsset.deleteMany({
    where: {
      OR: orConditions,
    },
  });
}

export async function sendVideoAsset(params: SendVideoAssetParams): Promise<SendMediaAssetStatus> {
  const telegram = getTelegramClient();
  const cachedAsset = await prisma.telegramMediaAsset.findUnique({
    where: { assetKey: params.assetKey },
  });

  if (cachedAsset?.telegramFileId) {
    try {
      await telegram.sendVideo(params.chatId, cachedAsset.telegramFileId, params.options);
      return "cached";
    } catch (error) {
      logger.warn({ err: error, assetKey: params.assetKey }, "Trimiterea prin telegram_file_id a eșuat, reiau din fișier.");
    }
  }

  if (!params.localFilePath) {
    logger.warn(
      {
        assetKey: params.assetKey,
        sourceFileName: params.sourceFileName ?? null,
      },
      "Asset video local lipseste; flow-ul va cadea pe fallback.",
    );

    if (params.missingFileText) {
      await telegram.sendMessage(params.chatId, params.missingFileText, {
        parse_mode: params.options.parse_mode,
        reply_markup: params.options.reply_markup,
      });
    }
    return "missing";
  }

  const lockKey = `media:upload:${params.assetKey}`;
  const lockToken = await tryAcquireRedisLock(lockKey, config.MEDIA_UPLOAD_LOCK_TTL_SEC * 1000);

  if (!lockToken) {
    const awaitedAsset = await waitForCachedAsset(params.assetKey, Math.min(config.MEDIA_UPLOAD_LOCK_TTL_SEC * 1000, 120_000));
    if (awaitedAsset?.telegramFileId) {
      await telegram.sendVideo(params.chatId, awaitedAsset.telegramFileId, params.options);
      return "cached";
    }
  }

  if (params.uploadNoticeText) {
    await telegram.sendMessage(params.chatId, params.uploadNoticeText);
  }

  let uploadToken = lockToken;
  if (!uploadToken) {
    uploadToken = await tryAcquireRedisLock(lockKey, config.MEDIA_UPLOAD_LOCK_TTL_SEC * 1000);
  }

  let message: Awaited<ReturnType<typeof telegram.sendVideo>>;
  try {
    message = await telegram.sendVideo(params.chatId, Input.fromLocalFile(params.localFilePath), params.options);
  } catch (error) {
    logger.error({ err: error, assetKey: params.assetKey }, "Upload-ul video din fișier local a eșuat.");

    if (params.uploadFailedText) {
      const description = getTelegramErrorDescription(error);
      await telegram.sendMessage(
        params.chatId,
        description ? `${params.uploadFailedText}\n\nDetaliu Telegram: ${description}` : params.uploadFailedText,
        {
          parse_mode: params.options.parse_mode,
          reply_markup: params.options.reply_markup,
        },
      );
    }

    if (uploadToken) {
      await releaseRedisLock(lockKey, uploadToken);
    }

    return "failed";
  }

  const uploadedFile = extractTelegramFileId(message);

  if (uploadedFile.fileId) {
    await prisma.telegramMediaAsset.upsert({
      where: { assetKey: params.assetKey },
      update: {
        telegramFileId: uploadedFile.fileId,
        telegramFileUniqueId: uploadedFile.uniqueId ?? null,
        sourceFileName: params.sourceFileName ?? null,
      },
      create: {
        assetKey: params.assetKey,
        telegramFileId: uploadedFile.fileId,
        telegramFileUniqueId: uploadedFile.uniqueId ?? null,
        sourceFileName: params.sourceFileName ?? null,
      },
    });
  }

  if (uploadToken) {
    await releaseRedisLock(lockKey, uploadToken);
  }

  return "uploaded";
}

export async function sendDocumentAsset(params: SendDocumentAssetParams): Promise<SendMediaAssetStatus> {
  const telegram = getTelegramClient();
  const cachedAsset = await prisma.telegramMediaAsset.findUnique({
    where: { assetKey: params.assetKey },
  });

  if (cachedAsset?.telegramFileId) {
    try {
      await telegram.sendDocument(params.chatId, cachedAsset.telegramFileId, params.options);
      return "cached";
    } catch (error) {
      logger.warn({ err: error, assetKey: params.assetKey }, "Trimiterea documentului prin telegram_file_id a eșuat, reiau din fișier.");
    }
  }

  if (!params.localFilePath) {
    logger.warn(
      {
        assetKey: params.assetKey,
        sourceFileName: params.sourceFileName ?? null,
      },
      "Asset document local lipseste; flow-ul va cadea pe fallback.",
    );

    if (params.missingFileText) {
      await telegram.sendMessage(params.chatId, params.missingFileText, {
        parse_mode: params.options.parse_mode,
        reply_markup: params.options.reply_markup,
      });
    }
    return "missing";
  }

  const lockKey = `media:upload:${params.assetKey}`;
  const lockToken = await tryAcquireRedisLock(lockKey, config.MEDIA_UPLOAD_LOCK_TTL_SEC * 1000);

  if (!lockToken) {
    const awaitedAsset = await waitForCachedAsset(params.assetKey, Math.min(config.MEDIA_UPLOAD_LOCK_TTL_SEC * 1000, 120_000));
    if (awaitedAsset?.telegramFileId) {
      await telegram.sendDocument(params.chatId, awaitedAsset.telegramFileId, params.options);
      return "cached";
    }
  }

  if (params.uploadNoticeText) {
    await telegram.sendMessage(params.chatId, params.uploadNoticeText);
  }

  let uploadToken = lockToken;
  if (!uploadToken) {
    uploadToken = await tryAcquireRedisLock(lockKey, config.MEDIA_UPLOAD_LOCK_TTL_SEC * 1000);
  }

  let message: Awaited<ReturnType<typeof telegram.sendDocument>>;
  try {
    message = await telegram.sendDocument(params.chatId, Input.fromLocalFile(params.localFilePath), params.options);
  } catch (error) {
    logger.error({ err: error, assetKey: params.assetKey }, "Upload-ul documentului din fișier local a eșuat.");

    if (params.uploadFailedText) {
      const description = getTelegramErrorDescription(error);
      await telegram.sendMessage(
        params.chatId,
        description ? `${params.uploadFailedText}\n\nDetaliu Telegram: ${description}` : params.uploadFailedText,
        {
          parse_mode: params.options.parse_mode,
          reply_markup: params.options.reply_markup,
        },
      );
    }

    if (uploadToken) {
      await releaseRedisLock(lockKey, uploadToken);
    }

    return "failed";
  }

  const uploadedFile = extractTelegramFileId(message);

  if (uploadedFile.fileId) {
    await prisma.telegramMediaAsset.upsert({
      where: { assetKey: params.assetKey },
      update: {
        telegramFileId: uploadedFile.fileId,
        telegramFileUniqueId: uploadedFile.uniqueId ?? null,
        sourceFileName: params.sourceFileName ?? null,
      },
      create: {
        assetKey: params.assetKey,
        telegramFileId: uploadedFile.fileId,
        telegramFileUniqueId: uploadedFile.uniqueId ?? null,
        sourceFileName: params.sourceFileName ?? null,
      },
    });
  }

  if (uploadToken) {
    await releaseRedisLock(lockKey, uploadToken);
  }

  return "uploaded";
}
