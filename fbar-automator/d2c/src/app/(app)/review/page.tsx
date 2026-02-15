"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { ReviewTable } from "@/components/wizard/ReviewTable";
import { maskTIN, formatDate } from "@/lib/utils";
import type { AccountDisplay, UserProfile } from "@/types";
import Link from "next/link";

export default function ReviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<AccountDisplay[]>([]);
  const [filing, setFiling] = useState<{ id: string; calendarYear: number; status: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAll() {
      try {
        // First fetch the filing to get the correct calendar year
        const filingRes = await fetch("/api/filing");
        const filingData = await filingRes.json();

        let year = new Date().getFullYear() - 1;
        let activeFiling = null;
        if (filingData.data?.length > 0) {
          const active = filingData.data.find((f: any) =>
            ["IN_PROGRESS", "REVIEWED", "SIGNED", "PAID"].includes(f.status)
          );
          if (active) {
            activeFiling = active;
            year = active.calendarYear;
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
        return { label: "Everything Looks Correct — Continue to Sign", path: "/sign" };
    }
  };

  const handleContinue = () => {
    const config = getCtaConfig();
    router.push(config.path);
  };

  if (loading) {
    return (
      <WizardLayout currentStep={4}>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
        </div>
      </WizardLayout>
    );
  }

  const ctaConfig = getCtaConfig();
  const canContinue = accounts.length > 0;

  return (
    <WizardLayout currentStep={4} onPrevious="/accounts">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Review Your FBAR</h1>
        <p className="text-gray-600 mb-8">Please verify all information is correct before signing.</p>

        {error && <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">{error}</div>}

        {/* Personal Information */}
        <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-navy-900">Personal Information</h2>
            <Link href="/personal" className="text-sm text-navy-900 hover:underline">Edit</Link>
          </div>
          {user && (
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <span className="text-gray-500">Name</span>
                <p className="font-medium">{[user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ")}</p>
              </div>
              <div>
                <span className="text-gray-500">TIN</span>
                <p className="font-medium">{user.tinLast4 ? maskTIN(user.tinLast4) : "Not provided"} ({user.tinType})</p>
              </div>
              <div>
                <span className="text-gray-500">Date of Birth</span>
                <p className="font-medium">{user.dateOfBirth ? formatDate(user.dateOfBirth) : "Not provided"}</p>
              </div>
              <div>
                <span className="text-gray-500">Address</span>
                <p className="font-medium">
                  {user.usAddress
                    ? `${user.usAddress.street}, ${user.usAddress.city}, ${user.usAddress.state} ${user.usAddress.zip}`
                    : "Not provided"}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Filing Information */}
        <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Filing Information</h2>
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <div>
              <span className="text-gray-500">Calendar Year</span>
              <p className="font-medium">{filing?.calendarYear || new Date().getFullYear() - 1}</p>
            </div>
            <div>
              <span className="text-gray-500">Filing Type</span>
              <p className="font-medium">Original</p>
            </div>
            <div>
              <span className="text-gray-500">Number of Accounts</span>
              <p className="font-medium">{accounts.length}</p>
            </div>
          </div>
        </section>

        {/* Foreign Accounts */}
        <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-navy-900">Foreign Accounts</h2>
            <Link href="/accounts" className="text-sm text-navy-900 hover:underline">Edit</Link>
          </div>
          <ReviewTable accounts={accounts} />
        </section>

        {/* Actions */}
        <div className="space-y-3">
          {!canContinue && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md mb-4 text-sm">
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
