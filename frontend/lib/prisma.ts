import { PrismaClient } from "@prisma/client";

// On serverless (Vercel), each function instance opens its own Prisma pool.
// Without a cap, many instances quickly exhaust Supabase's free connection
// pooler → intermittent "Registration failed" / DB errors. Cap each instance to
// a single connection (the recommended serverless + pgbouncer setting).
function databaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (!url) return url;
  if (!/[?&]connection_limit=/.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "connection_limit=1";
  }
  return url;
}

// Reuse a single PrismaClient across hot reloads in development.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
