"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { ReviewTable } from "@/components/wizard/ReviewTable";
import { maskTIN, formatDate } from "@/lib/utils";
import { pushDataLayer } from "@/lib/gtm";
import type { AccountDisplay, UserProfile } from "@/types";
import Link from "next/link";

interface FilingInfo {
  id: string;
  calendarYear: number;
  status: string;
}

export default function ReviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<AccountDisplay[]>([]);
  const [filing, setFiling] = useState<FilingInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    pushDataLayer({ event: "fbar_step_view", step: 4, step_name: "review" });
  }, []);

  useEffect(() => {
    async function loadAll() {
      try {
        // First fetch the filing to get the correct calendar year
        const filingRes = await fetch("/api/filing");
        const filingData = await filingRes.json();

        let year = new Date().getFullYear() - 1;
        let activeFiling: FilingInfo | null = null;
        if (filingData.data?.length > 0) {
          const activeId = sessionStorage.getItem("activeFilingYearId");
          // Prefer the filing the user selected from the dashboard, then fall back to status-based search
          const active =
            (activeId && filingData.data.find((f: FilingInfo) =>
              f.id === activeId && ["IN_PROGRESS", "REVIEWED"].includes(f.status)
            )) ||
            filingData.data.find((f: FilingInfo) =>
              ["IN_PROGRESS", "REVIEWED"].includes(f.status)
            ) ||
            (activeId && filingData.data.find((f: FilingInfo) =>
              f.id === activeId && ["SIGNED", "PAID"].includes(f.status)
            )) ||
            filingData.data.find((f: FilingInfo) =>
              ["SIGNED", "PAID"].includes(f.status)
            );
          if (active) {
            activeFiling = active;
            year = active.calendarYear;
            // Track the active filing for downstream wizard pages
            sessionStorage.setItem("activeFilingYearId", active.id);
          }
        }

        // Now fetch user and accounts using the correct year
        const [userRes, accountsRes] = await Promise.all([
          fetch("/api/user"),
          fetch(`/api/accounts?calendarYear=${year}`),
        ]);

        const userData = await userRes.json();
        const accountsData = await accountsRes.json();

        if (userData.data) setUser(userData.data);
        if (accountsData.data) setAccounts(accountsData.data);
        if (activeFiling) setFiling(activeFiling);
      } catch {
        setError("Failed to load filing data");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const getCtaConfig = () => {
    if (!filing) return { label: "Continue to Sign", path: "/sign" };

    switch (filing.status) {
      case "SIGNED":
        return { label: "Continue to Payment", path: "/payment" };
      case "PAID":
        return { label: "View Confirmation", path: "/confirmation" };
      case "REVIEWED":
      case "IN_PROGRESS":
      default:
        return { label: "Everything Looks Correct \u2014 Continue to Sign", path: "/sign" };
    }
  };

  const handleContinue = async () => {
    const config = getCtaConfig();

    // If filing is IN_PROGRESS, confirm review before proceeding to sign
    if (filing && filing.status === "IN_PROGRESS") {
      try {
        const res = await fetch("/api/filing/review", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify({ filingYearId: filing.id }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to confirm review");
          return;
        }
      } catch {
        setError("An unexpected error occurred");
        return;
      }
    }

    pushDataLayer({ event: "fbar_step_complete", step: 4, step_name: "review" });
    router.push(config.path);
  };

  if (loading) {
    return (
      <WizardLayout currentStep={4}>
        <div className="flex justify-center py-12" aria-label="Loading review page">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" role="status">
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      </WizardLayout>
    );
  }

  const ctaConfig = getCtaConfig();
  const canContinue = accounts.length > 0;

  return (
    <WizardLayout currentStep={4} onPrevious="/accounts">
      <div className="max-w-3xl mx-auto print:max-w-full">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Review Your FBAR</h1>
        <p className="text-gray-600 mb-8 print:mb-4">Please verify all information is correct before signing.</p>

        {error && <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-md mb-6 print:hidden">{error}</div>}

        {/* Personal Information */}
        <section className="bg-white rounded-lg shadow-sm border p-6 mb-6 print:shadow-none print:border-gray-300" aria-labelledby="personal-info-heading">
          <div className="flex justify-between items-center mb-4">
            <h2 id="personal-info-heading" className="text-lg font-semibold text-navy-900">Personal Information</h2>
            <Link href="/personal" className="text-sm text-navy-900 hover:underline print:hidden">Edit</Link>
          </div>
          {user && (
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium">{[user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ")}</dd>
              </div>
              <div>
                <dt className="text-gray-500">TIN</dt>
                <dd className="font-medium">{user.tinLast4 ? maskTIN(user.tinLast4) : "Not provided"} ({user.tinType})</dd>
              </div>
              <div>
                <dt className="text-gray-500">Date of Birth</dt>
                <dd className="font-medium">{user.dateOfBirth ? formatDate(user.dateOfBirth) : "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Address</dt>
                <dd className="font-medium">
                  {user.usAddress
                    ? `${user.usAddress.street}, ${user.usAddress.city}, ${user.usAddress.state} ${user.usAddress.zip}`
                    : "Not provided"}
                </dd>
              </div>
              {user.phone && (
                <div>
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="font-medium">{user.phone}</dd>
                </div>
              )}
            </dl>
          )}
        </section>

        {/* Filing Information */}
        <section className="bg-white rounded-lg shadow-sm border p-6 mb-6 print:shadow-none print:border-gray-300" aria-labelledby="filing-info-heading">
          <h2 id="filing-info-heading" className="text-lg font-semibold text-navy-900 mb-4">Filing Information</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Calendar Year</dt>
              <dd className="font-medium">{filing?.calendarYear || new Date().getFullYear() - 1}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Filing Type</dt>
              <dd className="font-medium">Original</dd>
            </div>
            <div>
              <dt className="text-gray-500">Number of Accounts</dt>
              <dd className="font-medium">{accounts.length}</dd>
            </div>
          </dl>
        </section>

        {/* Foreign Accounts */}
        <section className="bg-white rounded-lg shadow-sm border p-6 mb-6 print:shadow-none print:border-gray-300" aria-labelledby="accounts-heading">
          <div className="flex justify-between items-center mb-4">
            <h2 id="accounts-heading" className="text-lg font-semibold text-navy-900">Foreign Accounts</h2>
            <Link href="/accounts" className="text-sm text-navy-900 hover:underline print:hidden">Edit</Link>
          </div>
          <ReviewTable accounts={accounts} />
        </section>

        {/* Actions */}
        <div className="space-y-3 print:hidden">
          {!canContinue && (
            <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md mb-4 text-sm">
              Add at least one foreign account to continue.
            </div>
          )}
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full py-3 px-6 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ctaConfig.label}
          </button>
          <div className="flex justify-center gap-6 text-sm">
            <Link href="/personal" className="text-navy-900 hover:underline">Edit personal info</Link>
            <Link href="/accounts" className="text-navy-900 hover:underline">Edit accounts</Link>
          </div>
        </div>
      </div>
    </WizardLayout>
  );
}
