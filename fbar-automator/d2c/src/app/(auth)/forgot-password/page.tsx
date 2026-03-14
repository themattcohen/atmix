"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setError("Too many requests. Please wait a minute and try again.");
        return;
      }

      if (!res.ok) {
        setError(data.error || "An error occurred");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gov-blue mb-4">Check Your Email</h1>
            <p className="text-gray-600 mb-6">
              If an account exists with that email, we&apos;ve sent password reset
              instructions.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Didn&apos;t receive an email? Check your spam folder or try again.
            </p>
            <Link
              href="/login"
              className="text-gov-blue font-medium hover:underline"
            >
              Back to sign in
            </Link>
          </div>
    );
  }

  return (
    <>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gov-blue">Reset Your Password</h1>
          <p className="text-gray-600 mt-2">
            Enter your email and we&apos;ll send you reset instructions
          </p>
        </div>

        {error && (
          <div role="alert" aria-live="polite" className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-gov-blue text-white rounded-md hover:bg-gov-blue-dark focus:outline-none focus:ring-2 focus:ring-gov-blue focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Sending..." : "Send Reset Instructions"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Remember your password?{" "}
          <Link href="/login" className="text-gov-blue font-medium hover:underline">
            Sign in
          </Link>
        </p>
    </>
  );
}
