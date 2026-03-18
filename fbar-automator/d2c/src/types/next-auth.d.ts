import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      mfaEnabled: boolean;
      emailVerified: boolean;
    } & DefaultSession["user"];
    tokenVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tokenVersion: number;
    mfaEnabled: boolean;
    emailVerified: boolean;
  }
}
