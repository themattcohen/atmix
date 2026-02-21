import * as OTPAuth from "otpauth";

/**
 * Generate a valid TOTP token from a base32 secret.
 * Uses the same algorithm as the D2C app (SHA1, 6 digits, 30s period).
 */
export function generateTotpToken(base32Secret: string): string {
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
  return totp.generate();
}
