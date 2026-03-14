"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

function MfaVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl") || "/threshold";
  const callbackUrl = (rawCallback.startsWith("/") && !rawCallback.startsWith("//") && !rawCallback.includes("\\"))
    ? rawCallback
    : "/threshold";

  const [token, setToken] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body = useRecovery ? { recoveryCode } : { token };
      const res = await fetch("/api/auth/mfa/login-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(callbackUrl);
      } else if (res.status === 429) {
        setError("Too many attempts. Please wait 5 minutes.");
      } else {
        setError(data.error || "Invalid code");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gov-blue">Two-Factor Authentication</h1>
          <p className="text-gray-600 mt-2">
            {useRecovery
              ? "Enter one of your recovery codes"
              : "Enter the 6-digit code from your authenticator app"}
          </p>
        </div>

        {error && (
          <div role="alert" aria-live="polite" className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {useRecovery ? (
            <div>
              <label htmlFor="recoveryCode" className="block text-sm font-medium text-gray-700 mb-1">
                Recovery Code
              </label>
              <input
                id="recoveryCode"
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-transparent font-mono"
                placeholder="XXXX-XXXXXX"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
                Authentication Code
              </label>
              <input
                id="token"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-transparent text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-gov-blue text-white rounded-md hover:bg-gov-blue-dark focus:outline-none focus:ring-2 focus:ring-gov-blue focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <button
            type="button"
            onClick={() => {
              setUseRecovery(!useRecovery);
              setError("");
              setToken("");
              setRecoveryCode("");
            }}
            className="text-sm text-gov-blue hover:underline"
          >
            {useRecovery ? "Use authenticator app instead" : "Use a recovery code instead"}
          </button>

          <div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
    </>
  );
}

export default function MfaVerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-blue" />
      </div>
    }>
      <MfaVerifyForm />
    </Suspense>
  );
}
