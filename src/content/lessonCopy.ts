export function buildLessonDeliveryText(title: string, messageText: string): string {
  const trimmedMessageText = messageText.trim();
  return trimmedMessageText ? [`*${title}*`, "", trimmedMessageText].join("\n") : `*${title}*`;
}

export function buildLessonQuizPrompt(dayNumber: number, unlocked: boolean): string {
  return unlocked
    ? `Testul pentru Lecția ${dayNumber} este pregătit. Apasă pe buton și deschide secțiunea de test.`
    : `Testul pentru Lecția ${dayNumber} se activează după ce urmărești puțin lecția.`;
}
