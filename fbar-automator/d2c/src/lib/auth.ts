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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        // Check if account is locked out
        if (user.lockoutUntil && user.lockoutUntil > new Date()) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

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

        // Successful login: reset lockout fields
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockoutUntil: null },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.email,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tokenVersion = (user as any).tokenVersion;
      } else if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tokenVersion: true },
        });
        if (!dbUser || dbUser.tokenVersion !== token.tokenVersion) {
          return {};
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
