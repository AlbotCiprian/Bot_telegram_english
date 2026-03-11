import { PrismaClient } from "@prisma/client";
import "../utils/config.js";

declare global {
  // eslint-disable-next-line no-var
  var __allengualPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__allengualPrisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__allengualPrisma = prisma;
}
