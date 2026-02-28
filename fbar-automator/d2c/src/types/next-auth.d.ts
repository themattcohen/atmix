import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      mfaEnabled?: boolean;
      emailVerified?: boolean;
    } & DefaultSession["user"];
    tokenVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    mfaEnabled?: boolean;
    emailVerified?: boolean;
    tokenVersion?: number;
  }
}
