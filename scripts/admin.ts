/**
 * Grant, revoke or list access to the admin portal (/admin). The only way to become an admin: the
 * app has no screen for it, and an email address alone never grants it.
 *
 *   npm run db:admin -- grant <email>
 *   npm run db:admin -- revoke <email>
 *   npm run db:admin -- list
 *
 * Runs against DATABASE_URL (production: set it to the production database for the one command).
 * The user must have signed up first. Uses relative imports + the pg driver adapter so it runs
 * under plain `tsx` (mirrors scripts/set-password.ts).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const USAGE = "Usage: npm run db:admin -- grant <email> | revoke <email> | list";

async function main() {
  const [command, email] = process.argv.slice(2);
  if (command === "list") {
    const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { email: true, name: true }, orderBy: { email: "asc" } });
    console.log(admins.length ? admins.map((admin) => `${admin.email}${admin.name ? ` (${admin.name})` : ""}`).join("\n") : "No admins.");
    return;
  }
  if ((command !== "grant" && command !== "revoke") || !email) {
    console.error(USAGE);
    process.exit(1);
  }
  const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } }, select: { id: true, email: true } });
  if (!user) {
    console.error(`No user found with email "${email}". They must sign up first.`);
    process.exit(1);
  }
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: command === "grant" } });
  console.log(command === "grant" ? `✓ ${user.email} can open /admin.` : `✓ ${user.email} can no longer open /admin.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
