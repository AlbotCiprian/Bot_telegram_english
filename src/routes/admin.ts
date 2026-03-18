import { FastifyPluginAsync } from "fastify";
import { prisma } from "../db/client.js";

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => ({
    status: "ok",
    service: "allengual-telegram-bot",
    time: new Date().toISOString(),
  }));

  fastify.get("/admin/stats", async () => {
    const [users, formsCompleted, lessonsSent, aiQuestions, crmSuccess, crmFailed, urgentRequests, consultRequests, marathonRequests, mediaCache] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { leadFormCompleted: true } }),
      prisma.userEvent.count({ where: { eventType: "lesson_delivered" } }),
      prisma.userEvent.count({ where: { eventType: "ai_question_answered" } }),
      prisma.crmSyncLog.count({ where: { status: "success" } }),
      prisma.crmSyncLog.count({ where: { status: "failed" } }),
      prisma.crmSyncLog.count({
        where: {
          action: "request_consultation",
          requestPayload: {
            path: ["priority"],
            equals: "urgent_contact",
          },
        },
      }),
      prisma.crmSyncLog.count({
        where: {
          action: "request_consultation",
          requestPayload: {
            path: ["priority"],
            equals: "consultation",
          },
        },
      }),
      prisma.crmSyncLog.count({
        where: {
          action: "request_marathon_interest",
        },
      }),
      prisma.telegramMediaAsset.count(),
    ]);

    return {
      users,
      formsCompleted,
      lessonsSent,
      aiQuestions,
      crmSuccess,
      crmFailed,
      urgentRequests,
      consultRequests,
      marathonRequests,
      mediaCache,
    };
  });

  fastify.get("/admin/jobs", async () => {
    const jobs = await prisma.scheduledJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        jobId: true,
        queueName: true,
        jobType: true,
        status: true,
        runAt: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return {
      jobs,
    };
  });
};
