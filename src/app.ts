import fs from "node:fs";
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

  const streamHlsRoot = path.resolve(config.STREAM_HLS_ROOT);
  const streamPosterRoot = path.resolve(config.STREAM_POSTER_ROOT);

  if (config.streamingEnabled && fs.existsSync(streamHlsRoot)) {
    app.register(fastifyStatic, {
      root: streamHlsRoot,
      prefix: "/stream/hls/",
      decorateReply: false,
      immutable: false,
      maxAge: "5m",
    });
  }

  if (config.streamingEnabled && fs.existsSync(streamPosterRoot)) {
    app.register(fastifyStatic, {
      root: streamPosterRoot,
      prefix: "/stream/posters/",
      decorateReply: false,
      immutable: true,
      maxAge: "30d",
    });
  }

  app.register(adminRoutes);
  app.register(webhookRoutes);
  app.register(streamingRoutes);

  return app;
}
