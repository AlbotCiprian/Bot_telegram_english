import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { adminRoutes } from "./routes/admin.js";
import { streamingRoutes } from "./routes/streaming.js";
import { webhookRoutes } from "./routes/webhook.js";
import { config } from "./utils/config.js";
import { logger } from "./utils/logger.js";

export function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
  });

  app.register(fastifyStatic, {
    root: path.resolve(process.cwd(), "node_modules", "hls.js", "dist"),
    prefix: "/vendor/hls/",
  });

  app.register(adminRoutes);
  app.register(webhookRoutes);
  app.register(streamingRoutes);

  return app;
}
