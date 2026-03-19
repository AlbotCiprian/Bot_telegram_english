import crypto from "node:crypto";
import { Context, Markup } from "telegraf";
import { SHARED_COPY, UI_LABELS } from "../../content/copy.js";
import {
  buildMarathonLandingMessage,
  buildMarathonOfferMessage,
  buildMarathonPackageMessage,
  getMarathonOffer,
  getMarathonPackageByKey,
  getMarathonPackageCatalog,
  isMarathonPackageKey,
  MarathonPackageKey,
} from "../../content/marathonContent.js";
import { prisma } from "../../db/client.js";
import { logUserEvent } from "../../services/eventService.js";
import { cancelPendingUserJobs, scheduleCrmJob } from "../../services/schedulerService.js";
import { clearSession, setSession, updateSessionPayload, updateSessionStep } from "../../services/sessionService.js";
import { ensureProfile } from "../../services/userService.js";
import { BotUser } from "../../types/bot.js";
import { MarathonInterestStep, SessionPayload } from "../../types/session.js";
import { isValidPhone, normalizePhone, normalizeWhitespace } from "../../utils/validators.js";
import { getMainMenuKeyboard, getPhoneRequestKeyboard } from "../menu.js";

type MarathonView = "packages" | "package" | "offer";

type MarathonSessionPayload = {
  view: MarathonView;
  packageKey: MarathonPackageKey | null;
  offerIndex: number | null;
};

function parseOfferIndex(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }

  return null;
}

function parseMarathonPayload(payload: SessionPayload): MarathonSessionPayload {
  const packageKey =
    typeof payload.packageKey === "string" && isMarathonPackageKey(payload.packageKey)
      ? payload.packageKey
      : null;
  const offerIndex = parseOfferIndex(
    typeof payload.offerIndex === "string" || typeof payload.offerIndex === "number" || payload.offerIndex == null
      ? payload.offerIndex
      : null,
  );
  const view =
    payload.view === "package" || payload.view === "offer"
      ? payload.view
      : "packages";

  return {
    view,
    packageKey,
    offerIndex,
  };
}

function getMarathonPackagesKeyboard() {
  const packageButtons = getMarathonPackageCatalog().map((item) => [Markup.button.callback(item.label, `marathon:package:${item.key}`)]);
  return Markup.inlineKeyboard([
    ...packageButtons,
    [Markup.button.callback(UI_LABELS.backToMenu, "marathon:menu")],
  ]);
}

function getMarathonPackageKeyboard(packageKey: MarathonPackageKey) {
  const marathonPackage = getMarathonPackageByKey(packageKey);
  if (!marathonPackage) {
    return getMarathonPackagesKeyboard();
  }

  const offerButtons = marathonPackage.availableOffers.map((offer) =>
    [Markup.button.callback(offer.cohortLabel, `marathon:offer:${packageKey}:${offer.index}`)],
  );

  return Markup.inlineKeyboard([
    ...offerButtons,
    [Markup.button.callback("⬅️ Înapoi la pachete", "marathon:packages")],
    [Markup.button.callback(UI_LABELS.backToMenu, "marathon:menu")],
  ]);
}

function getMarathonOfferKeyboard(packageKey: MarathonPackageKey, offerIndex: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(UI_LABELS.contactForPackage, `marathon:contact:${packageKey}:${offerIndex}`)],
    [Markup.button.callback("⬅️ Înapoi la date", `marathon:package:${packageKey}`)],
    [Markup.button.callback("⬅️ Înapoi la pachete", "marathon:packages")],
    [Markup.button.callback(UI_LABELS.backToMenu, "marathon:menu")],
  ]);
}

async function replyOrEditMarathon(
  ctx: Context,
  text: string,
  replyMarkup: ReturnType<typeof Markup.inlineKeyboard>,
): Promise<void> {
  const options = {
    parse_mode: "Markdown" as const,
    reply_markup: replyMarkup.reply_markup,
  };

  try {
    if ("callbackQuery" in ctx && ctx.callbackQuery) {
      await ctx.editMessageText(text, options);
      return;
    }
  } catch {
    // Fallback to a fresh message when the original message can no longer be edited.
  }

  await ctx.reply(text, options);
}

async function renderMarathonPackages(ctx: Context): Promise<void> {
  await replyOrEditMarathon(ctx, buildMarathonLandingMessage(), getMarathonPackagesKeyboard());
}

async function renderMarathonPackage(ctx: Context, packageKey: MarathonPackageKey): Promise<void> {
  const marathonPackage = getMarathonPackageByKey(packageKey);
  if (!marathonPackage) {
    await renderMarathonPackages(ctx);
    return;
  }

  await replyOrEditMarathon(ctx, buildMarathonPackageMessage(marathonPackage), getMarathonPackageKeyboard(packageKey));
}

async function renderMarathonOffer(ctx: Context, packageKey: MarathonPackageKey, offerIndex: number): Promise<void> {
  const marathonPackage = getMarathonPackageByKey(packageKey);
  const offer = getMarathonOffer(packageKey, offerIndex);
  if (!marathonPackage || !offer) {
    await renderMarathonPackage(ctx, packageKey);
    return;
  }

  await replyOrEditMarathon(ctx, buildMarathonOfferMessage(marathonPackage, offer), getMarathonOfferKeyboard(packageKey, offerIndex));
}

async function renderCurrentMarathonView(ctx: Context, payload: MarathonSessionPayload): Promise<void> {
  if (payload.view === "offer" && payload.packageKey && payload.offerIndex !== null) {
    await renderMarathonOffer(ctx, payload.packageKey, payload.offerIndex);
    return;
  }

  if (payload.view === "package" && payload.packageKey) {
    await renderMarathonPackage(ctx, payload.packageKey);
    return;
  }

  await renderMarathonPackages(ctx);
}

function getCurrentOffer(payload: MarathonSessionPayload) {
  if (!payload.packageKey || payload.offerIndex === null) {
    return null;
  }

  const marathonPackage = getMarathonPackageByKey(payload.packageKey);
  const offer = getMarathonOffer(payload.packageKey, payload.offerIndex);
  if (!marathonPackage || !offer) {
    return null;
  }

  return { marathonPackage, offer };
}

async function promptMarathonPhone(ctx: Context, payload: MarathonSessionPayload): Promise<void> {
  const currentOffer = getCurrentOffer(payload);
  if (!currentOffer) {
    await renderMarathonPackages(ctx);
    return;
  }

  await ctx.reply(
    `Te rog să trimiți numărul de telefon pentru ${currentOffer.marathonPackage.label}, start ${currentOffer.offer.cohortLabel}.`,
    {
      reply_markup: getPhoneRequestKeyboard().reply_markup,
    },
  );
}

async function finalizeMarathonInterest(
  ctx: Context,
  user: BotUser,
  payload: MarathonSessionPayload,
): Promise<void> {
  const currentOffer = getCurrentOffer(payload);
  if (!currentOffer) {
    await ctx.reply("Oferta selectată nu mai este disponibilă. Reiau meniul de pachete.", {
      reply_markup: getMainMenuKeyboard({ showLessons: Boolean(user.lesson1Unlocked || user.currentLessonDay > 0) }).reply_markup,
    });
    await clearSession(user.id);
    return;
  }

  await ensureProfile(user.id);
  await prisma.userProfile.update({
    where: { userId: user.id },
    data: { consultationWanted: true },
  });

  await clearSession(user.id);
  await cancelPendingUserJobs(user.id);

  await scheduleCrmJob({
    userId: user.id,
    action: "request_marathon_interest",
    packageKey: currentOffer.marathonPackage.key,
    packageLabel: currentOffer.marathonPackage.label,
    cohortLabel: currentOffer.offer.cohortLabel,
    priceLabel: currentOffer.offer.priceLabel,
    requestKey: crypto.randomUUID(),
  });

  await logUserEvent({
    userId: user.id,
    eventType: "marathon_interest_requested",
    metadata: {
      packageKey: currentOffer.marathonPackage.key,
      packageLabel: currentOffer.marathonPackage.label,
      cohortLabel: currentOffer.offer.cohortLabel,
      priceLabel: currentOffer.offer.priceLabel,
    },
  });

  await ctx.reply(
    [
      `Am trimis cererea ta pentru ${currentOffer.marathonPackage.label}.`,
      `Data aleasă: ${currentOffer.offer.cohortLabel}`,
      `Preț: ${currentOffer.offer.priceLabel}`,
      "Revenim cât mai curând cu toate detaliile.",
    ].join("\n"),
    {
      reply_markup: getMainMenuKeyboard({ showLessons: Boolean(user.lesson1Unlocked || user.currentLessonDay > 0) }).reply_markup,
    },
  );
}

export async function startMarathonFlow(ctx: Context, user: BotUser): Promise<void> {
  await setSession({
    userId: user.id,
    flowType: "marathon_interest",
    step: "menu",
    payload: {
      view: "packages",
      packageKey: null,
      offerIndex: null,
    },
  });

  await renderMarathonPackages(ctx);

  await logUserEvent({
    userId: user.id,
    eventType: "marathon_opened",
  });
}

export async function resumeMarathonFlow(
  ctx: Context,
  step: MarathonInterestStep,
  payload: SessionPayload,
): Promise<void> {
  const parsed = parseMarathonPayload(payload);

  if (step === "phone") {
    await ctx.reply(SHARED_COPY.continueFromWhereLeftOff);
    await promptMarathonPhone(ctx, parsed);
    return;
  }

  await renderCurrentMarathonView(ctx, parsed);
}

export async function handleMarathonCallback(
  ctx: Context,
  user: BotUser,
  action: string,
): Promise<void> {
  const [command, firstArg, secondArg] = action.split(":");

  if (command === "menu") {
    await clearSession(user.id);
    await ctx.reply(SHARED_COPY.chooseHowToContinue, {
      reply_markup: getMainMenuKeyboard({ showLessons: Boolean(user.lesson1Unlocked || user.currentLessonDay > 0) }).reply_markup,
    });
    return;
  }

  if (command === "packages") {
    await setSession({
      userId: user.id,
      flowType: "marathon_interest",
      step: "menu",
      payload: {
        view: "packages",
        packageKey: null,
        offerIndex: null,
      },
    });
    await renderMarathonPackages(ctx);
    return;
  }

  if (command === "package" && firstArg && isMarathonPackageKey(firstArg)) {
    await setSession({
      userId: user.id,
      flowType: "marathon_interest",
      step: "menu",
      payload: {
        view: "package",
        packageKey: firstArg,
        offerIndex: null,
      },
    });
    await renderMarathonPackage(ctx, firstArg);
    return;
  }

  if (command === "offer" && firstArg && secondArg && isMarathonPackageKey(firstArg)) {
    const offerIndex = parseOfferIndex(secondArg);
    if (offerIndex === null) {
      await renderMarathonPackage(ctx, firstArg);
      return;
    }

    await setSession({
      userId: user.id,
      flowType: "marathon_interest",
      step: "menu",
      payload: {
        view: "offer",
        packageKey: firstArg,
        offerIndex,
      },
    });
    await renderMarathonOffer(ctx, firstArg, offerIndex);
    return;
  }

  if (command === "contact" && firstArg && secondArg && isMarathonPackageKey(firstArg)) {
    const offerIndex = parseOfferIndex(secondArg);
    if (offerIndex === null) {
      await renderMarathonPackage(ctx, firstArg);
      return;
    }

    const payload: MarathonSessionPayload = {
      view: "offer",
      packageKey: firstArg,
      offerIndex,
    };

    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (currentUser?.phone) {
      await finalizeMarathonInterest(ctx, user, payload);
      return;
    }

    await setSession({
      userId: user.id,
      flowType: "marathon_interest",
      step: "phone",
      payload,
    });
    await promptMarathonPhone(ctx, payload);
    return;
  }

  await renderMarathonPackages(ctx);
}

export async function handleMarathonContactInput(
  ctx: Context,
  user: BotUser,
  contact: { phone_number: string },
  payload: SessionPayload,
): Promise<void> {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      phone: normalizePhone(contact.phone_number),
    },
  });

  await finalizeMarathonInterest(ctx, user, parseMarathonPayload(payload));
}

export async function handleMarathonTextInput(
  ctx: Context,
  user: BotUser,
  step: MarathonInterestStep,
  text: string,
  payload: SessionPayload,
): Promise<void> {
  const parsed = parseMarathonPayload(payload);

  if (step === "menu") {
    await ctx.reply("Folosește butoanele de mai jos ca să alegi pachetul și data potrivită.");
    await renderCurrentMarathonView(ctx, parsed);
    return;
  }

  const value = normalizeWhitespace(text);
  if (value.toLowerCase() === UI_LABELS.writePhoneManually.toLowerCase()) {
    await ctx.reply(SHARED_COPY.phoneFormatPrompt);
    return;
  }

  if (!isValidPhone(value)) {
    await ctx.reply(SHARED_COPY.invalidPhonePrompt);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      phone: normalizePhone(value),
    },
  });

  await updateSessionStep(user.id, "phone");
  await updateSessionPayload(user.id, parsed);
  await finalizeMarathonInterest(ctx, user, parsed);
}
