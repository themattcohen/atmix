"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/wizard/WizardLayout";

export default function ThresholdPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [calendarYear, setCalendarYear] = useState(currentYear - 1);
  const [hadAccounts, setHadAccounts] = useState<boolean | null>(null);
  const [exceededThreshold, setExceededThreshold] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canProceed = hadAccounts === true && exceededThreshold === true;
  const showNoFilingMessage = hadAccounts === false || exceededThreshold === false;

  const handleContinue = async () => {
    if (!canProceed) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/filing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarYear }),
      });

      const data = await res.json();

      if (res.status === 409) {
        // Filing already exists, continue
        router.push("/personal");
        return;
      }

      if (!res.ok) {
        setError(data.error || "Failed to create filing");
        return;
      }

      router.push("/personal");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <WizardLayout currentStep={1}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Do You Need to File an FBAR?</h1>
        <p className="text-gray-600 mb-4">Answer these questions to determine if you need to file.</p>

        {/* Threshold explanation */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 text-sm text-blue-900">
          <p className="font-medium mb-1">What is the FBAR?</p>
          <p className="text-blue-800">
            If you are a U.S. person and the combined value of all your foreign financial accounts
            was more than <strong>$10,000</strong> at any point during the year, you are required
            to file a Report of Foreign Bank and Financial Accounts (FBAR) with FinCEN.
            This includes bank accounts, brokerage accounts, mutual funds, and other financial
            accounts held outside the United States.
          </p>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-8">
          {/* Year selector */}
          <div>
            <label htmlFor="calendar-year" className="block text-sm font-medium text-gray-700 mb-2">
              Which calendar year are you filing for?
            </label>
            <select
              id="calendar-year"
              value={calendarYear}
              onChange={(e) => setCalendarYear(Number(e.target.value))}
              className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            >
              {Array.from({ length: 5 }, (_, i) => currentYear - 1 - i).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Question 1 */}
          <fieldset className="bg-white rounded-lg shadow-sm border p-6">
            <legend className="font-medium text-navy-900 mb-4">
              During {calendarYear}, did you have a financial interest in, or signature authority
              over, any financial accounts in a foreign country?
            </legend>
            <div className="flex gap-4" role="radiogroup" aria-label="Had foreign accounts">
              <button
                onClick={() => setHadAccounts(true)}
                role="radio"
                aria-checked={hadAccounts === true}
                className={`px-6 py-2 rounded-md font-medium ${
                  hadAccounts === true
                    ? "bg-navy-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setHadAccounts(false)}
                role="radio"
                aria-checked={hadAccounts === false}
                className={`px-6 py-2 rounded-md font-medium ${
                  hadAccounts === false
                    ? "bg-navy-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                No
              </button>
            </div>
          </fieldset>

          {/* Question 2 */}
          {hadAccounts === true && (
            <fieldset className="bg-white rounded-lg shadow-sm border p-6">
              <legend className="font-medium text-navy-900 mb-4">
                At any time during {calendarYear}, did the combined value of ALL your foreign
                financial accounts exceed $10,000 (USD)?
              </legend>
              <p className="text-sm text-gray-500 mb-4">
                Add up the highest balances of all your foreign accounts during the year.
                If the total was over $10,000 at any point, even for a single day, select &quot;Yes.&quot;
              </p>
              <div className="flex gap-4" role="radiogroup" aria-label="Exceeded $10,000 threshold">
                <button
                  onClick={() => setExceededThreshold(true)}
                  role="radio"
                  aria-checked={exceededThreshold === true}
                  className={`px-6 py-2 rounded-md font-medium ${
                    exceededThreshold === true
                      ? "bg-navy-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => setExceededThreshold(false)}
                  role="radio"
                  aria-checked={exceededThreshold === false}
                  className={`px-6 py-2 rounded-md font-medium ${
                    exceededThreshold === false
                      ? "bg-navy-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  No
                </button>
              </div>
            </fieldset>
          )}

          {/* No filing needed message */}
          {showNoFilingMessage && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6" role="status">
              <h2 className="font-semibold text-blue-900 mb-2">You May Not Need to File</h2>
              <p className="text-blue-800 text-sm">
                Based on your answers, you may not be required to file an FBAR for {calendarYear}.
                The FBAR is required only if the combined value of all foreign accounts exceeded
                $10,000 at any time during the year.
              </p>
              <p className="text-blue-800 text-sm mt-2">
                If you&apos;re unsure, consult a tax professional.
              </p>
            </div>
          )}

          {/* Continue button */}
          {canProceed && (
            <button
              onClick={handleContinue}
              disabled={loading}
              className="w-full py-3 px-6 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-medium disabled:opacity-50"
              aria-busy={loading}
            >
              {loading ? "Setting up your filing..." : "Continue to Personal Information"}
            </button>
          )}
        </div>
      </div>
    </WizardLayout>
  );
}
