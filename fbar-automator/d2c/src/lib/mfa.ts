import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import crypto from "crypto";

const ISSUER = "FBAR Direct";
const DIGITS = 6;
const PERIOD = 30;

export function generateSecret(email: string): { secret: string; otpauthUri: string } {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: DIGITS,
    period: PERIOD,
    secret: new OTPAuth.Secret({ size: 20 }),
  });

  return {
    secret: totp.secret.base32,
    otpauthUri: totp.toString(),
  };
}

export function verifyTotp(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Allow 1 window before/after for clock skew
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

export async function generateQrCode(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

export function generateRecoveryCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(5);
    const code = bytes.toString("hex").toUpperCase();
    // Format as XXXX-XXXXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(code.toUpperCase().replace(/-/g, "")).digest("hex");
}
