"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { Suspense } from "react";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const hasSubmitted = useRef(false);
  const [status, setStatus] = useState<"loading" | "paid" | "submitted" | "accepted" | "rejected">("loading");
  const [filing, setFiling] = useState<{
    id: string;
    calendarYear: number;
    bsaId: string | null;
    rejectionReason: string | null;
    submittedAt: string | null;
    form114aUrl: string | null;
  } | null>(null);

  const loadFiling = useCallback(async () => {
    try {
      const res = await fetch("/api/filing");
      const data = await res.json();
      if (data.data?.length > 0) {
        const latest = data.data[0];
        setFiling(latest);

        if (latest.status === "ACCEPTED") setStatus("accepted");
        else if (latest.status === "REJECTED") setStatus("rejected");
        else if (latest.status === "SUBMITTED") setStatus("submitted");
        else if (latest.status === "PAID") setStatus("paid");
        else setStatus("paid");
      }
    } catch {
      console.error("Failed to load filing");
    }
  }, []);

  useEffect(() => { loadFiling(); }, [loadFiling]);

  // Auto-submit after payment (once only)
  useEffect(() => {
    if (status === "paid" && filing?.id && !hasSubmitted.current) {
      hasSubmitted.current = true;
      const submit = async () => {
        try {
          await fetch("/api/sdtm/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filingYearId: filing.id }),
          });
          setStatus("submitted");
          loadFiling();
        } catch {
          console.error("Auto-submit failed");
        }
      };
      submit();
    }
  }, [status, filing?.id, loadFiling]);

  // Poll for acknowledgement
  useEffect(() => {
    if (status !== "submitted" || !filing?.id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sdtm/status?filingYearId=${filing.id}`);
        const data = await res.json();
        if (data.data?.status === "accepted") {
          setStatus("accepted");
          loadFiling();
          clearInterval(interval);
        } else if (data.data?.status === "rejected") {
          setStatus("rejected");
          loadFiling();
          clearInterval(interval);
        }
      } catch {
        console.error("Status poll failed");
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [status, filing?.id, loadFiling]);

  return (
    <WizardLayout currentStep={7}>
      <div className="max-w-2xl mx-auto">
        {status === "loading" && (
          <div className="flex flex-col items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mb-4" />
            <p className="text-gray-600">Loading your filing status...</p>
          </div>
        )}

        {status === "paid" && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-navy-900 mb-2">Payment Received</h1>
            <p className="text-gray-600">Submitting your FBAR to FinCEN...</p>
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
                {/* TODO: Create proper presigned URL download endpoint at /api/filing/form114a */}
                <a href={`/api/filing/form114a?id=${filing.id}`} target="_blank" rel="noopener noreferrer" className="text-navy-900 hover:underline font-medium">
                  Download Form 114a (PDF)
                </a>
              </p>
            )}
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
            {filing.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-6 text-left max-w-md mx-auto">
                <p className="text-sm font-medium text-red-900">Rejection Reason:</p>
                <p className="text-sm text-red-800 mt-1">{filing.rejectionReason}</p>
              </div>
            )}
            <p className="text-gray-600">Our team will review your filing and contact you with next steps.</p>
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
