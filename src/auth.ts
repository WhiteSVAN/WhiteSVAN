/**
 * Auth.js (NextAuth v5) configuration — email/password credentials, plus Google
 * when AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are set.
 *
 * JWT sessions (the required strategy for credentials: there is no database
 * Session row to look up). Google sign-ins are mapped onto our own `User` row in
 * the `jwt` callback (see linkGoogleUser) so `token.id` is always our user id.
 * `authorize` runs on the Node.js runtime because it touches Prisma + bcrypt.
 *
 * Exposes the standard v5 surface: `handlers` (for the route handler),
 * `auth` (read the session in Server Components / actions), `signIn`/`signOut`.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/auth/schemas";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

/** Google sign-in is offered only when its OAuth credentials are configured. */
export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

/**
 * Find-or-create our User for a Google identity and record the provider link.
 * An existing credentials account with the same email is linked only because
 * the signIn callback already required Google to vouch for the email.
 */
async function linkGoogleUser(input: {
  providerAccountId: string;
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<string> {
  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: input.providerAccountId } },
    select: { userId: true },
  });
  if (linked) return linked.userId;

  const email = input.email.toLowerCase();
  const user =
    (await prisma.user.findUnique({ where: { email }, select: { id: true } })) ??
    (await prisma.user.create({
      data: { email, name: input.name ?? null, image: input.image ?? null, emailVerified: new Date() },
      select: { id: true },
    }));
  await prisma.account.create({
    data: {
      userId: user.id,
      type: "oidc",
      provider: "google",
      providerAccountId: input.providerAccountId,
    },
  });
  return user.id;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
    ...(googleEnabled ? [Google] : []),
  ],
  callbacks: {
    signIn({ account, profile }) {
      // Never link or create an account from an unverified Google email.
      if (account?.provider === "google") return profile?.email_verified === true && !!profile.email;
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        token.id = await linkGoogleUser({
          providerAccountId: account.providerAccountId,
          email: profile.email,
          name: profile.name,
          image: typeof profile.picture === "string" ? profile.picture : null,
        });
      } else if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
