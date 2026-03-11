import { FastifyPluginAsync } from "fastify";

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/webhook/telegram", async (_, reply) => {
    return reply.code(501).send({
      status: "not_enabled",
      message: "Webhook mode nu este activ in dezvoltarea locala. Foloseste polling mode.",
    });
  });
};
