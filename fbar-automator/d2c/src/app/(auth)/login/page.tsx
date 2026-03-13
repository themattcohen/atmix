"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl") || "/threshold";
  const callbackUrl = (rawCallback.startsWith("/") && !rawCallback.startsWith("//") && !rawCallback.includes("\\"))
    ? rawCallback
    : "/threshold";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);

  useEffect(() => {
    // Show verified banner only if set by the verify-email flow (sessionStorage), not from URL alone
    if (sessionStorage.getItem("emailVerified") === "true") {
      setShowVerifiedBanner(true);
      sessionStorage.removeItem("emailVerified");
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then(async (data) => {
        if (data?.user && !showVerifiedBanner) {
          // Validate user still exists in DB (ghost session detection)
          try {
            const userRes = await fetch("/api/user");
            if (userRes.status === 404 || userRes.status === 401) {
              // User was deleted — clear stale JWT cookie
              await signOut({ redirect: false });
              setAuthChecked(true);
              return;
            }
            if (!userRes.ok) {
              // Transient error — don't destroy the session
              setAuthChecked(true);
              return;
            }
          } catch {
            // Network error — don't destroy the session
            setAuthChecked(true);
            return;
          }
          router.replace(callbackUrl);
        } else {
          setAuthChecked(true);
        }
      })
      .catch(() => setAuthChecked(true));
  }, [router, callbackUrl, showVerifiedBanner]);

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const key = `loginFails:${email}`;
        const stored = parseInt(sessionStorage.getItem(key) || "0", 10);
        const count = stored + 1;
        sessionStorage.setItem(key, count.toString());
        if (count >= 5) {
          setError("Account may be temporarily locked. Please try again in 15 minutes.");
        } else {
          setError("Invalid email or password");
        }
      } else {
        // Check if user has MFA enabled — redirect to verification page
        try {
          const sessionRes = await fetch("/api/auth/session");
          const sessionData = await sessionRes.json();
          if (sessionData?.user?.mfaEnabled) {
            router.push(`/mfa-verify?callbackUrl=${encodeURIComponent(callbackUrl)}`);
          } else {
            router.push(callbackUrl);
          }
        } catch (sessionErr) {
          Sentry.captureException(sessionErr, { extra: { context: "post_login_session_check" } });
          console.error("Session check after login failed:", sessionErr);
          // If session check fails, proceed to callbackUrl (middleware will catch MFA)
          router.push(callbackUrl);
        }
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { context: "login_flow" } });
      console.error("Login flow error:", err);
      if (err instanceof Error && err.message.includes("fetch")) {
        setError("Too many login attempts. Please wait a minute and try again.");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <Link href="/" className="flex justify-center mb-8">
          <div className="text-2xl font-bold text-navy-900">FBAR Direct</div>
        </Link>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-navy-900">Sign in to FBAR Direct</h1>
          <p className="text-gray-600 mt-2">File your FBAR in 10 minutes</p>
        </div>

        {showVerifiedBanner && (
          <div role="status" aria-live="polite" className="bg-green-50 text-green-700 p-3 rounded-md mb-4 text-sm">
            Email verified! Please sign in to continue.
          </div>
        )}

        {error && (
          <div role="alert" aria-live="polite" className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={128}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent"
            />
            <div className="mt-2 text-right">
              <Link href="/forgot-password" className="text-sm text-navy-900 hover:underline">
                Forgot Password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-navy-900 text-white rounded-md hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-navy-900 font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
