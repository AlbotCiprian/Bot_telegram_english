export type BotUser = {
  id: number;
  telegramId: bigint;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  leadFormCompleted: boolean;
  currentLessonDay: number;
  lesson1Unlocked?: boolean;
  lesson2Unlocked?: boolean;
  lesson3Unlocked?: boolean;
  lesson2UnlockTime?: Date | null;
  lesson3UnlockTime?: Date | null;
};
