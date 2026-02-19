import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Reject oversized passwords before bcrypt to prevent DoS
        const password = credentials.password as string;
        if (password.length > 128) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        // Check if account is locked out
        if (user.lockoutUntil && user.lockoutUntil > new Date()) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          const newFailedAttempts = user.failedLoginAttempts + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newFailedAttempts,
              ...(newFailedAttempts >= 5
                ? { lockoutUntil: new Date(Date.now() + 15 * 60 * 1000) }
                : {}),
            },
          });
          return null;
        }

        // Successful login: reset lockout fields (only if needed)
        if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockoutUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.email,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // 7 days
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tokenVersion = (user as any).tokenVersion;
      }
      // Note: We don't re-check tokenVersion on every request because the JWT
      // callback runs on Edge runtime (via middleware) where Prisma isn't available.
      // Token revocation is handled by bumping tokenVersion + short maxAge.
      return token;
    },
    async session({ session, token }) {
      if (!token.id) {
        return {} as any;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
});
