/**
 * Set (reset) a user's password from the command line — for dev/admin use when
 * you need a known password without going through the forgot-password flow.
 *
 *   npm run db:set-password -- <email> <password>
 *   # e.g. npm run db:set-password -- adityanalluri@gmail.com 123456
 *
 * Bypasses the signup strength policy on purpose (admin override). The password
 * is bcrypt-hashed the same way signup does. Uses relative imports + the pg
 * driver adapter so it runs under plain `tsx` (mirrors scripts/seed-demo.ts).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npm run db:set-password -- <email> <password>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    console.error(`No user found with email "${email}".`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { email }, data: { passwordHash } });
  console.log(`✓ Password updated for ${email}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
