// src/lib/mfa-cookie.ts — Edge-compatible MFA verification cookie using HMAC + Web Crypto

const COOKIE_NAME = "__mfa_verified";
const MAX_AGE = 24 * 60 * 60; // 24 hours (matches JWT maxAge in auth.ts)

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
  // Convert to hex string (Edge-compatible, no Buffer needed)
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacVerify(payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(payload);
  // Timing-safe comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

export async function createMfaCookie(
  userId: string,
  tokenVersion: number
): Promise<{ name: string; value: string; options: Record<string, unknown> }> {
  const payload = `mfa:${userId}:${tokenVersion}`;
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

export async function validateMfaCookie(
  cookieValue: string | undefined,
  expectedUserId: string,
  expectedTokenVersion: number
): Promise<boolean> {
  if (!cookieValue) return false;

  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot === -1) return false;

  const payload = cookieValue.slice(0, lastDot);
  const signature = cookieValue.slice(lastDot + 1);

  // Verify HMAC
  const valid = await hmacVerify(payload, signature);
  if (!valid) return false;

  // Verify payload matches expected user and token version
  const expectedPayload = `mfa:${expectedUserId}:${expectedTokenVersion}`;
  return payload === expectedPayload;
}

export function clearMfaCookieOptions(): {
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
