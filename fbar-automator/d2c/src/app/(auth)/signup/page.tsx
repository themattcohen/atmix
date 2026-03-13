"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { pushDataLayer, trackGadsConversion, setGtagUserData } from "@/lib/gtm";

function getUTMFromCookie(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const match = document.cookie.match(/fbar_utm=([^;]+)/);
  if (!match) return {};
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return {};
  }
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [existingSession, setExistingSession] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) setExistingSession(true);
      })
      .catch(() => {});
  }, []);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: [] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");
    setLoading(true);

    let signupSucceeded = false;
    try {
      Sentry.setContext("signup", { email: form.email });

      const utmData = getUTMFromCookie();
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({
          ...form,
          utmSource: utmData.utm_source,
          utmMedium: utmData.utm_medium,
          utmCampaign: utmData.utm_campaign,
          utmContent: utmData.utm_content,
          utmTerm: utmData.utm_term,
        }),
      });

      if (res.status === 429) {
        setGeneralError("Too many signup attempts. Please wait a minute and try again.");
        return;
      }

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch (jsonErr) {
        const rawText = await res.text().catch(() => "(unreadable)");
        console.error("Signup: failed to parse server response as JSON. Raw text:", rawText);
        Sentry.captureException(jsonErr);
        setGeneralError("Server returned an invalid response. Please try again or contact support.");
        return;
      }

      if (!res.ok) {
        if (data.details) {
          setErrors(data.details as Record<string, string[]>);
        } else {
          setGeneralError((data.error as string) || "Signup failed");
        }
        return;
      }

      signupSucceeded = true;
      setSignupSuccess(true);

      const verifyUrl = `/verify-email?email=${encodeURIComponent(form.email)}`;

      try {
        const result = await signIn("credentials", {
          email: form.email,
          password: form.password,
          redirect: false,
        });

        if (result?.error) {
          router.push(verifyUrl);
          return;
        }
      } catch (signInErr) {
        Sentry.captureException(signInErr, { extra: { context: "post_signup_auto_login" } });
        console.error("Signup: auto-login threw, redirecting to verify-email:", signInErr);
        router.push(verifyUrl);
        return;
      }

      try {
        pushDataLayer({ event: "fbar_signup_complete" });
        setGtagUserData(form.email);
        trackGadsConversion(process.env.NEXT_PUBLIC_GADS_SIGNUP_LABEL || '');
      } catch (gtmErr) {
        console.error("GTM tracking error (non-blocking):", gtmErr);
      }
      router.push(verifyUrl);
    } catch (err) {
      console.error("Signup flow error:", err);
      Sentry.captureException(err);
      if (signupSucceeded) {
        router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
      } else {
        setGeneralError("An unexpected error occurred. Please try again.");
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
          <h1 className="text-2xl font-bold text-navy-900">Create Your Account</h1>
          <p className="text-gray-600 mt-2">Start filing your FBAR today</p>
        </div>

        {existingSession && !signupSuccess && (
          <div role="status" aria-live="polite" className="bg-blue-50 text-blue-700 p-3 rounded-md mb-4 text-sm">
            You&apos;re already signed in.{" "}
            <Link href="/dashboard" className="font-medium underline">Go to Dashboard</Link>
            {" "}or{" "}
            <Link href="/api/auth/signout" className="font-medium underline">sign out</Link>
            {" "}to create a new account.
          </div>
        )}

        {signupSuccess ? (
          <div role="status" aria-live="polite" className="bg-green-50 text-green-700 p-3 rounded-md mb-4 text-sm">
            Account created! Redirecting to email verification...
          </div>
        ) : (
        <>

        {generalError && (
          <div role="alert" aria-live="polite" className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                value={form.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                required
                autoComplete="given-name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent"
              />
              {errors.firstName?.map((e, i) => (
                <p key={i} className="text-red-600 text-xs mt-1">{e}</p>
              ))}
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                value={form.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                required
                autoComplete="family-name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent"
              />
              {errors.lastName?.map((e, i) => (
                <p key={i} className="text-red-600 text-xs mt-1">{e}</p>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent"
              placeholder="you@example.com"
            />
            {errors.email?.map((e, i) => (
              <p key={i} className="text-red-600 text-xs mt-1">{e}</p>
            ))}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              required
              autoComplete="new-password"
              maxLength={128}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              8+ characters, 1 uppercase, 1 number
            </p>
            {errors.password?.map((e, i) => (
              <p key={i} className="text-red-600 text-xs mt-1">{e}</p>
            ))}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              required
              autoComplete="new-password"
              maxLength={128}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent"
            />
            {errors.confirmPassword?.map((e, i) => (
              <p key={i} className="text-red-600 text-xs mt-1">{e}</p>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-navy-900 text-white rounded-md hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-navy-900 font-medium hover:underline">
            Sign in
          </Link>
        </p>
        </>
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
