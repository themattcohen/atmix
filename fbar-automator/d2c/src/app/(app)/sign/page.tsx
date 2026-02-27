"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { pushDataLayer } from "@/lib/gtm";

interface FilingData {
  id: string;
  calendarYear: number;
  accountCount: number;
  status: string;
}

interface UserData {
  firstName: string;
  lastName: string;
  middleName: string;
}

export default function SignPage() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [userName, setUserName] = useState<UserData>({ firstName: "", lastName: "", middleName: "" });
  const [filing, setFiling] = useState<{ id: string; calendarYear: number; accountCount: number } | null>(null);

  useEffect(() => {
    pushDataLayer({ event: "fbar_step_view", step: 5, step_name: "sign" });
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [userRes, filingRes] = await Promise.all([
          fetch("/api/user"),
          fetch("/api/filing"),
        ]);
        const userData = await userRes.json();
        const filingData = await filingRes.json();

        if (userData.data) {
          setUserName({
            firstName: userData.data.firstName || "",
            lastName: userData.data.lastName || "",
            middleName: userData.data.middleName || "",
          });
        }

        if (filingData.data?.length > 0) {
          // Prioritize active filing — don't redirect to /payment if user has a filing to sign
          const activeFiling = filingData.data.find(
            (f: FilingData) => f.status === "REVIEWED" || f.status === "IN_PROGRESS"
          );
          if (activeFiling) {
            setFiling(activeFiling);
          } else {
            // No active filing — if there's a SIGNED one, redirect to payment
            const signedFiling = filingData.data.find((f: FilingData) => f.status === "SIGNED");
            if (signedFiling) {
              router.push("/payment");
              return;
            }
          }
        }
      } catch {
        setError("Failed to load data");
      } finally {
        setInitialLoading(false);
      }
    }
    loadData();
  }, [router]);

  const expectedParts = [userName.firstName, userName.middleName, userName.lastName].filter(Boolean);
  const expectedName = expectedParts.join(" ").trim();
  const nameMatches = typedName.trim().toLowerCase() === expectedName.toLowerCase();

  const handleSign = async () => {
    if (!filing || !agreed || !nameMatches) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/filing/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({
          filingYearId: filing.id,
          fullName: typedName.trim(),
          agreed: true,
          signatureData: typedName.trim(),
          signatureType: "typed",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signing failed");
        return;
      }

      pushDataLayer({ event: "fbar_step_complete", step: 5, step_name: "sign" });
      // Track which filing was just signed so downstream pages select the right one
      sessionStorage.setItem("activeFilingYearId", filing.id);
      router.push("/payment");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <WizardLayout currentStep={5} onPrevious="/review">
    {initialLoading ? (
      <div className="flex justify-center py-12" aria-label="Loading signing page">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    ) : (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-navy-900 mb-2">Sign Form 114a</h1>
      <p className="text-gray-600 mb-6">
        By signing below, you certify that the information in your FBAR filing is true and correct.
        You also authorize FBAR Direct to electronically file your FBAR on your behalf.
      </p>

      {error && (
        <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      {filing && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm" aria-label="Filing summary">
          <p className="font-medium text-navy-900">Filing Summary</p>
          <p className="text-gray-600">Calendar Year: {filing.calendarYear}</p>
          <p className="text-gray-600">Accounts: {filing.accountCount}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Authorization Statement</h2>
        <div className="bg-gray-50 p-4 rounded text-sm text-gray-700 mb-6 leading-relaxed">
          <p>
            I certify that I am the filer of this Report of Foreign Bank and Financial
            Accounts (FBAR), and that the information provided in the report is true,
            correct, and complete to the best of my knowledge and belief.
          </p>
          <p className="mt-3">
            I authorize FBAR Direct to electronically file this FBAR on my behalf through
            the BSA E-Filing System. I understand that I remain responsible for the
            accuracy and completeness of the information reported.
          </p>
          <p className="mt-3 font-medium text-navy-900">
            Willfully filing a false FBAR may result in penalties under 31 U.S.C. 5322,
            including fines and imprisonment.
          </p>
        </div>

        <fieldset className="mb-6">
          <legend className="sr-only">Certification agreement</legend>
          <label htmlFor="agree-checkbox" className="flex items-start gap-3 cursor-pointer">
            <input
              id="agree-checkbox"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-navy-900 focus:ring-navy-900"
              aria-describedby="agree-description"
            />
            <span id="agree-description" className="text-sm text-gray-700">
              I have read and agree to the above authorization statement. I certify that
              the information in my FBAR is true and correct to the best of my knowledge.
            </span>
          </label>
        </fieldset>

        <div className="mb-6">
          <label htmlFor="typed-signature" className="block text-sm font-medium text-gray-700 mb-2">
            Type your full legal name as it appears on your filing
          </label>
          <input
            id="typed-signature"
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={expectedName || "First Last"}
            className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent font-mono text-lg"
            aria-label="Typed signature"
            aria-describedby="signature-hint"
            aria-invalid={typedName.length > 0 && !nameMatches ? "true" : undefined}
          />
          <p id="signature-hint" className="text-gray-500 text-xs mt-1">
            Your typed name serves as your electronic signature.
          </p>
          {typedName && !nameMatches && (
            <p className="text-amber-600 text-xs mt-1" role="alert">
              Name must match: {expectedName}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={handleSign}
        disabled={loading || !agreed || !nameMatches || !filing}
        className="w-full py-3 px-6 bg-navy-900 text-white rounded-md hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
        aria-busy={loading}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Signing...
          </span>
        ) : (
          "Sign and Continue to Payment"
        )}
      </button>
    </div>
    )}
    </WizardLayout>
  );
}
