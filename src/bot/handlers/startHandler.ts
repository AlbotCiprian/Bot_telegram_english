import { Context } from "telegraf";
import { STATIC_PAGES } from "../../content/staticContent.js";
import { logUserEvent } from "../../services/eventService.js";
import { BotUser } from "../../types/bot.js";
import { config } from "../../utils/config.js";
import { buildHelpMessage, getMainMenuKeyboard, getStartFreeLessonsKeyboard } from "../menu.js";

function buildWelcomeCaption(showMenu: boolean): string {
  return [
    `*${STATIC_PAGES.welcome.title}* 🇬🇧`,
    "",
    STATIC_PAGES.welcome.body,
    "",
    showMenu
      ? "Meniul tau este activ. Recomandat: continua cu seria de 3 lectii gratuite."
      : "Poti incepe cu seria gratuita sau poti vedea direct preturile si raspunsurile AI.",
  ].join("\n");
}

async function replyWelcomeCard(ctx: Context, caption: string, showMenu: boolean): Promise<void> {
  const replyMarkup = showMenu ? getMainMenuKeyboard().reply_markup : getStartFreeLessonsKeyboard().reply_markup;

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

export async function handleStart(ctx: Context, user: BotUser, showMenu = true): Promise<void> {
  await replyWelcomeCard(ctx, buildWelcomeCaption(showMenu), showMenu);

  await logUserEvent({
    userId: user.id,
    eventType: "bot_started",
    metadata: {
      showMenu,
    },
  });
}

export async function handleMenu(ctx: Context): Promise<void> {
  await ctx.reply("Alege ce vrei sa faci mai departe. Recomandarea noastra: incepe cu 3 lectii gratuite.", {
    reply_markup: getMainMenuKeyboard().reply_markup,
  });
}

export async function handleHelp(ctx: Context, userId?: number): Promise<void> {
  await ctx.reply(buildHelpMessage(), {
    parse_mode: "Markdown",
    reply_markup: getMainMenuKeyboard().reply_markup,
  });

  await logUserEvent({
    userId,
    eventType: "help_opened",
  });
}
