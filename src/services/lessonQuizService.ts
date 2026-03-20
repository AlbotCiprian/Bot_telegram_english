import { prisma } from "../db/client.js";
import { LESSON_ONE_QUIZ } from "../content/staticContent.js";
import { logUserEvent } from "./eventService.js";
import { verifyLessonWatchToken } from "./streamingService.js";
import type { LessonDay } from "./lessonService.js";

type LessonQuizQuestion = {
  question: string;
  options: readonly string[];
  correctOptionIndex: number;
};

export type ClientLessonQuizQuestion = {
  id: number;
  prompt: string;
  options: string[];
};

export type LessonQuizState = {
  enabled: boolean;
  unlocked: boolean;
  title: string | null;
  intro: string | null;
  submitUrl: string | null;
  questions: ClientLessonQuizQuestion[];
  latestResult: {
    attemptCount: number;
    latestCorrectAnswers: number;
    latestTotalQuestions: number;
    latestPercentage: number;
    bestPercentage: number;
    bestCorrectAnswers: number;
    lastAttemptAt: string | null;
  } | null;
};

const LESSON_QUIZZES: Partial<Record<LessonDay, { title: string; intro: string; questions: readonly LessonQuizQuestion[] }>> = {
  1: {
    title: "Test după lecție",
    intro: "Verifică rapid Present Simple. Poți repeta testul ori de câte ori vrei, iar ultimul scor se salvează.",
    questions: LESSON_ONE_QUIZ,
  },
};

function getQuizDefinition(dayNumber: LessonDay) {
  return LESSON_QUIZZES[dayNumber] ?? null;
}

export function hasLessonQuiz(dayNumber: LessonDay): boolean {
  return Boolean(getQuizDefinition(dayNumber));
}

export function buildLessonQuizUrl(watchUrl: string): string {
  return `${watchUrl}#quiz-section`;
}

function sanitizeQuestions(questions: readonly LessonQuizQuestion[]): ClientLessonQuizQuestion[] {
  return questions.map((item, index) => ({
    id: index + 1,
    prompt: item.question,
    options: [...item.options],
  }));
}

export async function getLessonQuizState(userId: number, dayNumber: LessonDay): Promise<LessonQuizState> {
  const definition = getQuizDefinition(dayNumber);
  if (!definition) {
    return {
      enabled: false,
      unlocked: false,
      title: null,
      intro: null,
      submitUrl: null,
      questions: [],
      latestResult: null,
    };
  }

  const [progress, result] = await Promise.all([
    prisma.lessonProgress.findUnique({
      where: {
        userId_dayNumber: {
          userId,
          dayNumber,
        },
      },
      select: {
        quizAvailableAt: true,
      },
    }),
    prisma.lessonQuizResult.findUnique({
      where: {
        userId_dayNumber: {
          userId,
          dayNumber,
        },
      },
    }),
  ]);

  const unlocked = Boolean(progress?.quizAvailableAt && progress.quizAvailableAt <= new Date());

  return {
    enabled: true,
    unlocked,
    title: definition.title,
    intro: definition.intro,
    submitUrl: "/api/stream/quiz/submit",
    questions: sanitizeQuestions(definition.questions),
    latestResult: result
      ? {
          attemptCount: result.attemptCount,
          latestCorrectAnswers: result.latestCorrectAnswers,
          latestTotalQuestions: result.latestTotalQuestions,
          latestPercentage: result.latestPercentage,
          bestPercentage: result.bestPercentage,
          bestCorrectAnswers: result.bestCorrectAnswers,
          lastAttemptAt: result.lastAttemptAt?.toISOString() ?? null,
        }
      : null,
  };
}

export async function submitLessonQuiz(params: {
  token: string;
  answers: number[];
}): Promise<{
  unlocked: boolean;
  correctAnswers: number;
  totalQuestions: number;
  percentage: number;
  attemptCount: number;
  bestPercentage: number;
  bestCorrectAnswers: number;
}> {
  const payload = verifyLessonWatchToken(params.token);
  if (!payload) {
    throw new Error("Token-ul pentru quiz este invalid sau expirat.");
  }

  const definition = getQuizDefinition(payload.dayNumber);
  if (!definition) {
    throw new Error("Nu există quiz pentru această lecție.");
  }

  const progress = await prisma.lessonProgress.findUnique({
    where: {
      userId_dayNumber: {
        userId: payload.userId,
        dayNumber: payload.dayNumber,
      },
    },
    select: {
      quizAvailableAt: true,
    },
  });

  const unlocked = Boolean(progress?.quizAvailableAt && progress.quizAvailableAt <= new Date());
  if (!unlocked) {
    throw new Error("Testul nu este încă deblocat pentru această lecție.");
  }

  if (!Array.isArray(params.answers) || params.answers.length !== definition.questions.length) {
    throw new Error("Trimite toate răspunsurile înainte de a finaliza testul.");
  }

  for (const [index, answer] of params.answers.entries()) {
    if (!Number.isInteger(answer) || answer < 0 || answer >= definition.questions[index].options.length) {
      throw new Error("Unul dintre răspunsuri este invalid.");
    }
  }

  const correctAnswers = definition.questions.reduce((total, item, index) => {
    return total + (params.answers[index] === item.correctOptionIndex ? 1 : 0);
  }, 0);
  const totalQuestions = definition.questions.length;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);
  const now = new Date();

  const existingResult = await prisma.lessonQuizResult.findUnique({
    where: {
      userId_dayNumber: {
        userId: payload.userId,
        dayNumber: payload.dayNumber,
      },
    },
  });

  const attemptCount = (existingResult?.attemptCount ?? 0) + 1;
  const bestCorrectAnswers = Math.max(existingResult?.bestCorrectAnswers ?? 0, correctAnswers);
  const bestPercentage = Math.max(existingResult?.bestPercentage ?? 0, percentage);

  if (existingResult) {
    await prisma.lessonQuizResult.update({
      where: { id: existingResult.id },
      data: {
        attemptCount,
        latestCorrectAnswers: correctAnswers,
        latestTotalQuestions: totalQuestions,
        latestPercentage: percentage,
        bestCorrectAnswers,
        bestPercentage,
        lastAnswers: params.answers,
        lastAttemptAt: now,
      },
    });
  } else {
    await prisma.lessonQuizResult.create({
      data: {
        userId: payload.userId,
        dayNumber: payload.dayNumber,
        attemptCount,
        latestCorrectAnswers: correctAnswers,
        latestTotalQuestions: totalQuestions,
        latestPercentage: percentage,
        bestCorrectAnswers,
        bestPercentage,
        lastAnswers: params.answers,
        lastAttemptAt: now,
      },
    });
  }

  await prisma.lessonProgress.upsert({
    where: {
      userId_dayNumber: {
        userId: payload.userId,
        dayNumber: payload.dayNumber,
      },
    },
    update: {
      quizCompletedAt: now,
    },
    create: {
      userId: payload.userId,
      dayNumber: payload.dayNumber,
      openedAt: now,
      quizAvailableAt: now,
      quizCompletedAt: now,
    },
  });

  await logUserEvent({
    userId: payload.userId,
    eventType: "lesson_quiz_submitted",
    metadata: {
      dayNumber: payload.dayNumber,
      correctAnswers,
      totalQuestions,
      percentage,
      attemptCount,
      bestPercentage,
    },
  });

  return {
    unlocked: true,
    correctAnswers,
    totalQuestions,
    percentage,
    attemptCount,
    bestPercentage,
    bestCorrectAnswers,
  };
}
