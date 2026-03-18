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
};

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

export async function sendVideoAsset(params: SendVideoAssetParams): Promise<"cached" | "uploaded" | "missing"> {
  const telegram = getTelegramClient();
  const cachedAsset = await prisma.telegramMediaAsset.findUnique({
    where: { assetKey: params.assetKey },
  });

  if (cachedAsset?.telegramFileId) {
    try {
      await telegram.sendVideo(params.chatId, cachedAsset.telegramFileId, params.options);
      return "cached";
    } catch (error) {
      logger.warn({ err: error, assetKey: params.assetKey }, "Trimiterea prin telegram_file_id a esuat, reiau din fisier.");
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

  const message = await telegram.sendVideo(params.chatId, Input.fromLocalFile(params.localFilePath), params.options);
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
