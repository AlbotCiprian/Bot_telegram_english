import { Context, Input } from "telegraf";
import { SHARED_COPY } from "../../content/copy.js";
import { STATIC_PAGES } from "../../content/staticContent.js";
import { logUserEvent } from "../../services/eventService.js";
import { BotUser } from "../../types/bot.js";
import { config } from "../../utils/config.js";
import { logger } from "../../utils/logger.js";
import { resolveExistingMediaFile } from "../../utils/mediaAssets.js";
import { buildHelpMessage, getMainMenuKeyboard, getPublicMenuKeyboard } from "../menu.js";

function buildWelcomeCaption(showMainMenu: boolean, showLessons: boolean): string {
  const lines: string[] = [STATIC_PAGES.welcome.title];

  if (STATIC_PAGES.welcome.body.trim()) {
    lines.push("", STATIC_PAGES.welcome.body);
  }

  return lines.join("\n");
}

async function replyWelcomeCard(ctx: Context, caption: string, showMainMenu: boolean, showLessons: boolean): Promise<void> {
  const replyMarkup = showMainMenu
    ? getMainMenuKeyboard({ showLessons }).reply_markup
    : getPublicMenuKeyboard().reply_markup;
  const localWelcomeImage = resolveExistingMediaFile(config.WELCOME_IMAGE_PATH);

  if (localWelcomeImage) {
    try {
      await ctx.replyWithPhoto(Input.fromLocalFile(localWelcomeImage), {
        caption,
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      });
      return;
    } catch (error) {
      logger.warn({ err: error, localWelcomeImage }, "Nu am putut trimite imaginea de bun venit din fișier local.");
    }
  }

  if (config.WELCOME_IMAGE_URL.trim()) {
    try {
      await ctx.replyWithPhoto(config.WELCOME_IMAGE_URL, {
        caption,
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      });
      return;
    } catch (error) {
      logger.warn({ err: error }, "Nu am putut trimite imaginea de bun venit din URL.");
    }
  }

  await ctx.reply(caption, {
    parse_mode: "Markdown",
    reply_markup: replyMarkup,
  });
}

export async function handleStart(
  ctx: Context,
  user: BotUser,
  options?: { showMainMenu?: boolean; showLessons?: boolean },
): Promise<void> {
  const showMainMenu = options?.showMainMenu ?? true;
  const showLessons = options?.showLessons ?? false;

  await replyWelcomeCard(ctx, buildWelcomeCaption(showMainMenu, showLessons), showMainMenu, showLessons);

  await logUserEvent({
    userId: user.id,
    eventType: "bot_started",
    metadata: {
      showMainMenu,
      showLessons,
    },
  });
}

export async function handleMenu(ctx: Context, options?: { showLessons?: boolean }): Promise<void> {
  await ctx.reply(SHARED_COPY.chooseHowToContinue, {
    reply_markup: getMainMenuKeyboard({ showLessons: options?.showLessons }).reply_markup,
  });
}

export async function handleHelp(ctx: Context, userId?: number, options?: { showLessons?: boolean }): Promise<void> {
  await ctx.reply(buildHelpMessage(), {
    parse_mode: "Markdown",
    reply_markup: getMainMenuKeyboard({ showLessons: options?.showLessons }).reply_markup,
  });

  await logUserEvent({
    userId,
    eventType: "help_opened",
  });
}
