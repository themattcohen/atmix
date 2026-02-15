import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

// ---------------------------------------------------------------------------
// Type augmentation: extend NextAuth session & JWT with app-specific fields
// ---------------------------------------------------------------------------

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      practiceId: string
    }
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId: string
    email: string
    name: string
    role: string
    practiceId: string
  }
}

// ---------------------------------------------------------------------------
// NextAuth v5 configuration
// ---------------------------------------------------------------------------

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        })

        if (!user) {
          // Perform a dummy bcrypt compare to prevent timing attacks that
          // could reveal whether an email address exists in the system.
          await bcrypt.compare(password, "$2a$12$000000000000000000000000000000000000000000000000000000")
          return null
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          practiceId: user.practiceId,
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — reasonable for a financial application
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, `user` is the object returned by `authorize`.
      if (user) {
        token.userId = user.id as string
        token.email = user.email as string
        token.name = user.name as string
        token.role = (user as Record<string, unknown>).role as string
        token.practiceId = (user as Record<string, unknown>).practiceId as string
      }
      return token
    },

    async session({ session, token }) {
      session.user.id = token.userId as string
      session.user.email = token.email as string
      session.user.name = token.name as string
      session.user.role = token.role as string
      session.user.practiceId = token.practiceId as string
      return session
    },
  },

  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
      },
    },
  },
})
