// src/lib/email-verification-cookie.ts — Edge-compatible email verification cookie using HMAC + Web Crypto

const COOKIE_NAME = "__email_verified";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be set");
  return secret;
}

async function hmacSign(payload: string): Promise<string> {
  const secret = getSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacVerify(payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(payload);
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

export async function createEmailVerificationCookie(
  userId: string,
  tokenVersion: number
): Promise<{ name: string; value: string; options: Record<string, unknown> }> {
  const payload = `email_verified:${userId}:${tokenVersion}`;
  const signature = await hmacSign(payload);
  const value = `${payload}.${signature}`;
  return {
    name: COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
      maxAge: MAX_AGE,
    },
  };
}

export async function validateEmailVerificationCookie(
  cookieValue: string | undefined,
  expectedUserId: string,
  expectedTokenVersion: number
): Promise<boolean> {
  if (!cookieValue) return false;

  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot === -1) return false;

  const payload = cookieValue.slice(0, lastDot);
  const signature = cookieValue.slice(lastDot + 1);

  const valid = await hmacVerify(payload, signature);
  if (!valid) return false;

  const expectedPayload = `email_verified:${expectedUserId}:${expectedTokenVersion}`;
  return payload === expectedPayload;
}

export function clearEmailVerificationCookieOptions(): {
  name: string;
  value: string;
  options: Record<string, unknown>;
} {
  return {
    name: COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
      maxAge: 0,
    },
  };
}

export { COOKIE_NAME };
