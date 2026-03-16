import { Context } from "telegraf";
import { STATIC_PAGES } from "../../content/staticContent.js";
import { logUserEvent } from "../../services/eventService.js";
import { BotUser } from "../../types/bot.js";
import { config } from "../../utils/config.js";
import { buildHelpMessage, getMainMenuKeyboard, getPublicMenuKeyboard } from "../menu.js";

function buildWelcomeCaption(showMainMenu: boolean, showLessons: boolean): string {
  return [
    `*${STATIC_PAGES.welcome.title}*`,
    "",
    STATIC_PAGES.welcome.body,
    ...(showMainMenu
      ? ["", showLessons ? "Alege ce vrei sa faci mai departe." : "Alege serviciul de care ai nevoie."]
      : []),
  ].join("\n");
}

async function replyWelcomeCard(ctx: Context, caption: string, showMainMenu: boolean, showLessons: boolean): Promise<void> {
  const replyMarkup = showMainMenu
    ? getMainMenuKeyboard({ showLessons }).reply_markup
    : getPublicMenuKeyboard().reply_markup;

  try {
    await ctx.replyWithPhoto(config.WELCOME_IMAGE_URL, {
      caption,
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
    });
    return;
  } catch {
    await ctx.reply(caption, {
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
    });
  }
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
  await ctx.reply("Alege serviciul de care ai nevoie.", {
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
