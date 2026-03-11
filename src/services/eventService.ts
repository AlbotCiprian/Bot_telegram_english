import { prisma } from "../db/client.js";
import { asJson } from "../utils/json.js";

export async function logUserEvent(params: {
  userId?: number | null;
  eventType: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.userEvent.create({
    data: {
      userId: params.userId ?? null,
      eventType: params.eventType,
      metadata: asJson(params.metadata ?? {}),
    },
  });
}
