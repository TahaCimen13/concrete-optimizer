import { PrismaClient } from "@prisma/client";

// Force the two flags Supabase + Prisma need on serverless, regardless of how
// the env value was entered:
//   pgbouncer=true     → Prisma stops using named prepared statements, which
//                        collide under the transaction-mode pooler
//                        (PostgresError 42P05 "prepared statement already exists").
//   connection_limit=1 → each function instance uses one connection, so many
//                        instances don't exhaust the free pooler.
function databaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (!url) return url;
  const extra: string[] = [];
  if (!/[?&]pgbouncer=/.test(url)) extra.push("pgbouncer=true");
  if (!/[?&]connection_limit=/.test(url)) extra.push("connection_limit=1");
  if (extra.length) url += (url.includes("?") ? "&" : "?") + extra.join("&");
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
