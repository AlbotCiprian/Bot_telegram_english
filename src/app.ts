import Fastify from "fastify";
import { adminRoutes } from "./routes/admin.js";
import { webhookRoutes } from "./routes/webhook.js";
import { logger } from "./utils/logger.js";

export function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
  });

  app.register(adminRoutes);
  app.register(webhookRoutes);

  return app;
}
