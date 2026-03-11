import { prisma } from "../db/client.js";
import { SessionFlow, SessionPayload, SessionStep } from "../types/session.js";
import { asJson } from "../utils/json.js";

export async function getSession(userId: number) {
  return prisma.botSession.findUnique({
    where: { userId },
  });
}

export async function setSession(params: {
  userId: number;
  flowType: SessionFlow;
  step: SessionStep;
  payload?: SessionPayload;
}) {
  return prisma.botSession.upsert({
    where: { userId: params.userId },
    update: {
      flowType: params.flowType,
      step: params.step,
      payload: asJson(params.payload ?? {}),
    },
    create: {
      userId: params.userId,
      flowType: params.flowType,
      step: params.step,
      payload: asJson(params.payload ?? {}),
    },
  });
}

export async function updateSessionPayload(
  userId: number,
  patch: SessionPayload,
){
  const current = await getSession(userId);
  if (!current) {
    return null;
  }

  return prisma.botSession.update({
    where: { userId },
    data: {
      payload: asJson({
        ...(current.payload as SessionPayload | null),
        ...patch,
      }),
    },
  });
}

export async function updateSessionStep(userId: number, step: SessionStep) {
  return prisma.botSession.update({
    where: { userId },
    data: { step },
  });
}

export async function clearSession(userId: number): Promise<void> {
  await prisma.botSession.deleteMany({
    where: { userId },
  });
}
