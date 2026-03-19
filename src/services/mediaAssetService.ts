import { Input } from "telegraf";
import { ForceReply, InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove } from "telegraf/types";
import { prisma } from "../db/client.js";
import { getTelegramClient } from "./telegram.js";
import { logger } from "../utils/logger.js";

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

type SendVideoAssetStatus = "cached" | "uploaded" | "missing" | "failed";

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

export async function sendVideoAsset(params: SendVideoAssetParams): Promise<SendVideoAssetStatus> {
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
    if (params.missingFileText) {
      await telegram.sendMessage(params.chatId, params.missingFileText, {
        parse_mode: params.options.parse_mode,
        reply_markup: params.options.reply_markup,
      });
    }
    return "missing";
  }

  if (params.uploadNoticeText) {
    await telegram.sendMessage(params.chatId, params.uploadNoticeText);
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

  return "uploaded";
}
