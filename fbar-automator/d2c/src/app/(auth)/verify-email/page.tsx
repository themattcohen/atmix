"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResendOrSignIn({ resending, onResend }: { resending: boolean; onResend: () => void }) {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setHasSession(!!data?.user))
      .catch(() => setHasSession(false));
  }, []);

  if (hasSession === null) return null;

  if (!hasSession) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Didn&apos;t receive the email? Sign in to resend it.
        </p>
        <Link
          href="/login"
          className="w-full inline-block text-center py-2 px-4 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-medium"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <button
      onClick={onResend}
      disabled={resending}
      className="w-full py-2 px-4 bg-navy-900 text-white rounded-md hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
    >
      {resending ? "Sending..." : "Resend Verification Email"}
    </button>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email");

  const [status, setStatus] = useState<"verifying" | "success" | "error" | "idle">(
    token ? "verifying" : "idle"
  );
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (!token || verifiedRef.current) return;
    verifiedRef.current = true;

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
          // Check if user is authenticated to decide redirect target
          const sessionRes = await fetch("/api/auth/session").catch(() => null);
          const sessionData = sessionRes ? await sessionRes.json().catch(() => null) : null;
          if (sessionData?.user) {
            setTimeout(() => router.push("/threshold"), 2000);
          } else {
            // Set sessionStorage flag so login page shows verified banner (not forgeable via URL)
            sessionStorage.setItem("emailVerified", "true");
            setTimeout(() => router.push("/login"), 2000);
          }
        } else {
          let data: any = {};
          try { data = await res.json(); } catch {}
          setError(data.error || `Verification failed (${res.status})`);
          setStatus("error");
        }
      })
      .catch(() => {
        setError("An unexpected error occurred");
        setStatus("error");
      });
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    setResendSuccess(false);
    setError("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (res.ok) {
        setResendSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to resend verification email");
      }
    } catch {
      setError("Failed to resend verification email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <Link href="/" className="flex justify-center mb-8">
          <div className="text-2xl font-bold text-navy-900">FBAR Direct</div>
        </Link>

        {status === "verifying" && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-navy-900 mb-2">Verifying your email...</h2>
            <p className="text-gray-600">Please wait while we verify your email address.</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">Email Verified!</h2>
            <p className="text-gray-600">Your email has been verified. Redirecting you now...</p>
          </div>
        )}

        {(status === "error" || status === "idle") && (
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">Verify Your Email</h2>
            <p className="text-gray-600 mb-6">
              {status === "error"
                ? (error || "Your verification link is invalid or expired. Request a new one below.")
                : emailParam
                  ? <>We sent a verification link to <strong>{emailParam}</strong>. Check your inbox and click the link to verify your account.</>
                  : "We sent a verification link to your email. Click it to verify your account."}
            </p>

            {error && (
              <div role="alert" aria-live="polite" className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
                {error}
              </div>
            )}

            {resendSuccess && (
              <div role="status" aria-live="polite" className="bg-green-50 text-green-700 p-3 rounded-md mb-4 text-sm">
                Verification email sent! Check your inbox.
              </div>
            )}

            <ResendOrSignIn resending={resending} onResend={handleResend} />
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/login" className="text-navy-900 font-medium hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
