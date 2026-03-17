"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { pushDataLayer, trackGadsConversion, setGtagUserData } from "@/lib/gtm";
import { Suspense } from "react";

type ConfirmationStatus =
  | "loading"
  | "verifying_payment"
  | "slow_webhook"
  | "paid"
  | "submitting"
  | "submitted"
  | "accepted"
  | "rejected"
  | "error";

interface FilingInfo {
  id: string;
  calendarYear: number;
  bsaId: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  form114aUrl: string | null;
  tier: string | null;
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const hasSubmitted = useRef(false);
  const hasFiredPurchase = useRef(false);
  const pollCount = useRef(0);
  const [status, setStatus] = useState<ConfirmationStatus>("loading");
  const [error, setError] = useState<string>("");
  const [filing, setFiling] = useState<FilingInfo | null>(null);

  // Fire purchase event once when status transitions to paid
  useEffect(() => {
    if (status === 'paid' && !hasFiredPurchase.current) {
      hasFiredPurchase.current = true;
      const value = filing?.tier?.toUpperCase() === 'PREMIUM' ? 79 : 59;

      // Set Enhanced Conversions user data (hashed email)
      fetch("/api/auth/session")
        .then((r) => r.json())
        .then((s) => { if (s?.user?.email) setGtagUserData(s.user.email); })
        .catch(() => {});

      pushDataLayer({
        event: 'purchase',
        ecommerce: {
          transaction_id: filing?.id || '',
          currency: 'USD',
          value,
        },
      });
      trackGadsConversion(
        process.env.NEXT_PUBLIC_GADS_PURCHASE_LABEL || '',
        value,
        filing?.id || '',
      );
    }
  }, [status, filing]);

  // Anchored filing ID from Stripe session verification (set in init)
  const anchoredFilingIdRef = useRef<string | null>(null);

  // Load filing data from the filing API
  const loadFiling = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/filing");
      if (!res.ok) {
        setError("Failed to load filing status");
        setStatus("error");
        return null;
      }
      const data = await res.json();
      if (data.data?.length > 0) {
        const postPaymentStatuses = ["PAID", "SUBMITTING", "SUBMITTED", "ACCEPTED", "REJECTED"];

        // Anchor 1: filing ID from Stripe session verification (most reliable)
        // Anchor 2: activeFilingYearId from sessionStorage (set by sign page)
        const activeId = anchoredFilingIdRef.current
          || (typeof window !== "undefined" ? sessionStorage.getItem("activeFilingYearId") : null);

        const postPayment = activeId
          ? data.data.find((f: any) => f.id === activeId && postPaymentStatuses.includes(f.status))
            || data.data.find((f: any) => postPaymentStatuses.includes(f.status))
          : data.data.find((f: any) => postPaymentStatuses.includes(f.status));

        const signed = data.data.find((f: any) => f.status === "SIGNED");
        const target = postPayment || signed;

        if (!target) {
          return null;
        }

        setFiling(target);
        return target.status as string;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Verify Stripe session payment status — returns { status, filingId }
  const verifyStripeSession = useCallback(async (): Promise<{ status: string | null; filingId: string | null }> => {
    if (!sessionId) return { status: null, filingId: null };
    try {
      const res = await fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return { status: null, filingId: null };
      const data = await res.json();
      return {
        status: data.data?.status || null,
        filingId: data.data?.filingId || null,
      };
    } catch {
      return { status: null, filingId: null };
    }
  }, [sessionId]);

  // Initial load: check filing status and optionally verify Stripe session
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // If we have a session_id from Stripe redirect, verify payment first
      if (sessionId) {
        setStatus("verifying_payment");
        const verifyResult = await verifyStripeSession();

        if (cancelled) return;

        if (verifyResult.status === "completed") {
          // Anchor the filing ID from the Stripe session for correct year selection
          if (verifyResult.filingId) {
            anchoredFilingIdRef.current = verifyResult.filingId;
          }
          // Payment confirmed, load filing data
          const filingStatus = await loadFiling();
          if (cancelled) return;
          updateStatusFromFiling(filingStatus);
        } else {
          // Payment not yet confirmed (webhook may not have fired) — start polling
          setStatus("verifying_payment");
        }
      } else {
        // No session_id — just load filing status directly
        const filingStatus = await loadFiling();
        if (cancelled) return;
        if (!filingStatus) {
          setError("No filing found. Please check your dashboard.");
          setStatus("error");
        } else {
          updateStatusFromFiling(filingStatus);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [sessionId, loadFiling, verifyStripeSession]);

  // Poll for webhook completion when verifying payment
  useEffect(() => {
    if (status !== "verifying_payment" || !sessionId) return;

    pollCount.current = 0;
    const maxAttempts = 15; // 30 seconds at 2s intervals

    const interval = setInterval(async () => {
      pollCount.current++;

      const verifyResult = await verifyStripeSession();

      if (verifyResult.status === "completed") {
        clearInterval(interval);
        if (verifyResult.filingId) {
          anchoredFilingIdRef.current = verifyResult.filingId;
        }
        const filingStatus = await loadFiling();
        updateStatusFromFiling(filingStatus);
        return;
      }

      if (pollCount.current >= maxAttempts) {
        clearInterval(interval);
        // After 30s, assume payment went through but webhook is slow
        const filingStatus = await loadFiling();
        if (filingStatus && ["PAID", "SUBMITTING", "SUBMITTED", "ACCEPTED"].includes(filingStatus)) {
          updateStatusFromFiling(filingStatus);
        } else {
          // Payment likely received, webhook just hasn't fired yet — show slow-path status
          setStatus("slow_webhook" as ConfirmationStatus);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status, sessionId, verifyStripeSession, loadFiling]);

  // Auto-submit after payment (once only)
  // The Stripe webhook now submits server-side, so re-check status first
  useEffect(() => {
    if (status === "paid" && filing?.id && !hasSubmitted.current) {
      hasSubmitted.current = true;

      const checkAndSubmit = async () => {
        // Re-check filing status — webhook may have already submitted server-side
        const latestStatus = await loadFiling();
        if (latestStatus && ["SUBMITTED", "ACCEPTED", "REJECTED", "SUBMITTING"].includes(latestStatus)) {
          updateStatusFromFiling(latestStatus);
          return;
        }

        // Still PAID — fall back to browser-initiated submission
        setStatus("submitting");
        try {
          const res = await fetch("/api/sdtm/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
            body: JSON.stringify({ filingYearId: filing.id }),
          });

          if (res.ok) {
            setStatus("submitted");
            await loadFiling();
          } else {
            const filingStatus = await loadFiling();
            if (filingStatus === "SUBMITTED" || filingStatus === "ACCEPTED") {
              updateStatusFromFiling(filingStatus);
            } else {
              Sentry.captureException(new Error("Auto-submit failed"), { extra: { status: res.status, context: "auto_submit_status" } });
              console.error("Auto-submit failed, status:", res.status);
              setStatus("paid");
              hasSubmitted.current = false;
            }
          }
        } catch (err) {
          Sentry.captureException(err, { extra: { context: "auto_submit" } });
          console.error("Auto-submit failed");
          setStatus("paid");
          hasSubmitted.current = false;
        }
      };
      checkAndSubmit();
    }
  }, [status, filing?.id, loadFiling]);

  // Poll for acknowledgement when submitted
  useEffect(() => {
    if (status !== "submitted" || !filing?.id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sdtm/status?filingYearId=${filing.id}`);
        const data = await res.json();
        if (data.data?.status === "accepted") {
          setStatus("accepted");
          await loadFiling();
          clearInterval(interval);
        } else if (data.data?.status === "rejected") {
          setStatus("rejected");
          await loadFiling();
          clearInterval(interval);
        }
      } catch (err) {
        Sentry.captureException(err, { extra: { context: "ack_poll" } });
        console.error("Status poll failed");
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [status, filing?.id, loadFiling]);

  function updateStatusFromFiling(filingStatus: string | null) {
    switch (filingStatus) {
      case "ACCEPTED":
        setStatus("accepted");
        break;
      case "REJECTED":
        setStatus("rejected");
        break;
      case "SUBMITTED":
        setStatus("submitted");
        break;
      case "SUBMITTING":
        setStatus("submitting");
        break;
      case "PAID":
        setStatus("paid");
        break;
      case "SIGNED":
        // Came to confirmation but payment not yet reflected
        setStatus("verifying_payment");
        break;
      default:
        if (!filingStatus) {
          setError("No filing found in a post-payment state.");
          setStatus("error");
        } else {
          setStatus("paid");
        }
    }
  }

  return (
    <WizardLayout currentStep={7}>
      <div className="max-w-2xl mx-auto">
        {status === "loading" && (
          <div className="flex flex-col items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mb-4" />
            <p className="text-gray-600">Loading your filing status...</p>
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-navy-900 mb-2">Something Went Wrong</h1>
            <p className="text-gray-600 mb-6">{error || "An unexpected error occurred."}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setError("");
                  setStatus("loading");
                  pollCount.current = 0;
                  hasSubmitted.current = false;
                  loadFiling().then((s) => {
                    if (s) updateStatusFromFiling(s);
                    else {
                      setError("No filing found. Please check your dashboard.");
                      setStatus("error");
                    }
                  });
                }}
                className="py-3 px-6 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-bold"
              >
                Try Again
              </button>
              <Link href="/dashboard" className="py-3 px-6 border border-navy-900 text-navy-900 rounded-md hover:bg-gray-50 font-bold">
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}

        {status === "verifying_payment" && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-navy-900 mb-2">Verifying Payment</h1>
            <p className="text-gray-600">Confirming your payment with Stripe. This usually takes a few seconds...</p>
          </div>
        )}

        {status === "slow_webhook" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-navy-900 mb-2">Payment Received — Setting Up Your Filing</h1>
            <p className="text-gray-600 mb-4">
              Your payment was received successfully. We&apos;re finalizing your filing setup — this can take up to a minute.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              You can safely navigate away. Your filing will appear on your dashboard once it&apos;s ready.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setStatus("verifying_payment");
                  pollCount.current = 0;
                }}
                className="py-3 px-6 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-bold"
              >
                Check Again
              </button>
              <Link href="/dashboard" className="py-3 px-6 border border-navy-900 text-navy-900 rounded-md hover:bg-gray-50 font-bold">
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}

        {status === "paid" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-navy-900 mb-2">Payment Received</h1>
            <p className="text-gray-600">Preparing to submit your FBAR to FinCEN...</p>
          </div>
        )}

        {status === "submitting" && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-navy-900 mb-2">Submitting Your FBAR</h1>
            <p className="text-gray-600">Your filing is being submitted to FinCEN via the BSA E-Filing System...</p>
          </div>
        )}

        {status === "submitted" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-navy-900 mb-2">FBAR Submitted to FinCEN</h1>
            <p className="text-gray-600 mb-4">
              Your FBAR has been submitted through the BSA E-Filing System.
              Processing typically takes 1-2 business days.
            </p>
            {filing && (
              <div className="bg-gray-50 rounded-lg p-4 inline-block text-left text-sm">
                <p><span className="text-gray-500">Filing ID:</span> <span className="font-medium font-mono">{filing.id}</span></p>
                <p><span className="text-gray-500">Calendar Year:</span> <span className="font-medium">{filing.calendarYear}</span></p>
                {filing.submittedAt && (
                  <p><span className="text-gray-500">Submitted:</span> <span className="font-medium">{new Date(filing.submittedAt).toLocaleDateString()}</span></p>
                )}
              </div>
            )}
            <p className="text-sm text-gray-500 mt-6">We&apos;ll check for your BSA ID automatically. You can also check back later.</p>
          </div>
        )}

        {status === "accepted" && filing && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-navy-900 mb-2">Your FBAR Has Been Filed Successfully</h1>
            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-8 my-8 inline-block">
              <p className="text-sm text-gray-500 mb-1">BSA Tracking ID</p>
              <p className="text-4xl font-bold text-navy-900">{filing.bsaId}</p>
            </div>
            <p className="text-gray-600 font-medium mb-2">Save this number for your records.</p>
            <p className="text-sm text-gray-500 mb-8">A confirmation email has been sent to your email address.</p>
            {filing.form114aUrl && (
              <p className="text-sm mb-6">
                <a href={`/api/filing/form114a?id=${filing.id}`} target="_blank" rel="noopener noreferrer" className="text-navy-900 hover:underline font-medium">
                  Download Form 114a (PDF)
                </a>
              </p>
            )}
            <div className="bg-gray-50 rounded-lg p-4 inline-block text-left text-sm mb-8">
              <p><span className="text-gray-500">Filing ID:</span> <span className="font-medium font-mono">{filing.id}</span></p>
              <p><span className="text-gray-500">Calendar Year:</span> <span className="font-medium">{filing.calendarYear}</span></p>
              {filing.submittedAt && (
                <p><span className="text-gray-500">Submitted:</span> <span className="font-medium">{new Date(filing.submittedAt).toLocaleDateString()}</span></p>
              )}
            </div>
            <div className="flex gap-4 justify-center mt-8">
              <Link
                href="/threshold"
                className="py-3 px-6 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-bold"
              >
                File for Another Year
              </Link>
              <Link
                href="/dashboard"
                className="py-3 px-6 border border-navy-900 text-navy-900 rounded-md hover:bg-gray-50 font-bold"
              >
                View My Filings
              </Link>
            </div>
          </div>
        )}

        {status === "rejected" && filing && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-navy-900 mb-2">Submission Needs Attention</h1>
            <p className="text-gray-600 mb-4">FinCEN rejected your FBAR submission. Our team will work with you to resolve this.</p>
            {filing.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-6 text-left max-w-md mx-auto">
                <p className="text-sm font-medium text-red-900">Rejection Reason from FinCEN:</p>
                <p className="text-sm text-red-800 mt-1">{filing.rejectionReason}</p>
              </div>
            )}
            {!filing.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-6 text-left max-w-md mx-auto">
                <p className="text-sm text-red-800">No specific reason was provided by FinCEN. Please contact our support team for assistance.</p>
              </div>
            )}
            <p className="text-gray-600 mb-6">Please contact our support team and we&apos;ll help you resubmit at no additional cost.</p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/contact"
                className="py-3 px-6 bg-red-600 text-white rounded-md hover:bg-red-700 font-bold"
              >
                Contact Support
              </Link>
              <Link
                href="/dashboard"
                className="py-3 px-6 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-bold"
              >
                View My Filings
              </Link>
            </div>
          </div>
        )}
      </div>
    </WizardLayout>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
