// Per-user rate limit: 5 attempts per 5 minutes (in-memory)

export const loginVerifyAttempts = new Map<string, { count: number; resetTime: number }>();

export function checkLoginVerifyRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = loginVerifyAttempts.get(userId);
  if (!entry || now > entry.resetTime) {
    loginVerifyAttempts.set(userId, { count: 1, resetTime: now + 5 * 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}
