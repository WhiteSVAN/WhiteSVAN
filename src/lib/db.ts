/**
 * Prisma client singleton.
 *
 * Prisma 7's `prisma-client` generator is driver-adapter based: the schema
 * carries no datasource `url`, so the connection is supplied at runtime via a
 * driver adapter (here `@prisma/adapter-pg`, reading `DATABASE_URL`).
 *
 * Next.js dev hot-reloads modules, which would otherwise spawn a new client
 * (and connection pool) on every reload — so we cache one on `globalThis`
 * outside production. The client is imported from the custom generated location
 * (see prisma/schema.prisma `generator.output`), NOT `@prisma/client`.
 */
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
