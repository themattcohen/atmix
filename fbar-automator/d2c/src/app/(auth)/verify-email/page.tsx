"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

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
          // Auto-login using HMAC token from verification response
          let autoLoginToken: string | undefined;
          try {
            const data = await res.json();
            autoLoginToken = data.autoLoginToken;
          } catch {}

          if (autoLoginToken) {
            const loginResult = await signIn("credentials", {
              autoLoginToken,
              redirect: false,
            });
            if (loginResult?.ok) {
              setTimeout(() => router.push("/dashboard"), 2000);
              return;
            }
          }
          // Fallback: redirect to login with verified banner
          sessionStorage.setItem("emailVerified", "true");
          setTimeout(() => router.push("/login"), 2000);
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
        body: JSON.stringify({ email: emailParam }),
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
    <>
      {status === "verifying" && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-blue mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gov-blue mb-2">Verifying your email...</h2>
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
          <h2 className="text-xl font-bold text-gov-blue mb-2">Email Verified!</h2>
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
          <h2 className="text-xl font-bold text-gov-blue mb-2">Verify Your Email</h2>
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

          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full py-2 px-4 bg-gov-blue text-white rounded-md hover:bg-gov-blue-dark focus:outline-none focus:ring-2 focus:ring-gov-blue focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {resending ? "Sending..." : "Resend Verification Email"}
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-gray-600">
        <Link href="/login" className="text-gov-blue font-medium hover:underline">
          Back to Sign In
        </Link>
      </p>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-blue" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
