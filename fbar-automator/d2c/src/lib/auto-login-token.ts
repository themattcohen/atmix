import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET!;
const TTL_MS = 2 * 60 * 1000; // 2 minutes

export function createAutoLoginToken(userId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${userId}:${exp}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyAutoLoginToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [userId, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (Date.now() > exp) return null;
    const expectedSig = crypto
      .createHmac("sha256", SECRET)
      .update(`${userId}:${expStr}`)
      .digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig)))
      return null;
    return userId;
  } catch {
    return null;
  }
}
