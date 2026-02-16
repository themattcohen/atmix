import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function maskTIN(tin: string): string {
  if (!tin || tin.length < 4) return "XXX-XX-XXXX";
  return `XXX-XX-${tin.slice(-4)}`;
}

export function maskAccountNumber(num: string): string {
  if (!num || num.length < 4) return "****";
  return `****${num.slice(-4)}`;
}

export function formatSSN(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/**
 * Check if a fetch response indicates an expired/invalid session.
 * Redirects to login if unauthorized.
 */
export function handleAuthError(res: Response): boolean {
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login?callbackUrl=" + encodeURIComponent(window.location.pathname);
    }
    return true;
  }
  return false;
}

/**
 * Check if the auth session cookie is missing (session likely expired).
 * Only runs client-side; returns false on the server.
 */
export function isSessionExpired(): boolean {
  if (typeof document === "undefined") return false;
  const cookies = document.cookie.split(";").map((c) => c.trim());
  return !cookies.some((c) => c.startsWith("authjs.session-token="));
}

/**
 * If the session cookie is missing, redirect to login with an expired flag.
 */
export function handleSessionExpiry() {
  if (isSessionExpired()) {
    window.location.href = "/login?expired=true";
  }
}
