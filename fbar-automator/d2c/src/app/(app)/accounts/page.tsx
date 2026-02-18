"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { AccountForm } from "@/components/forms/AccountForm";
import { AccountEditForm } from "@/components/forms/AccountEditForm";
import { ImportBanner } from "@/components/ImportBanner";
import type { AccountDisplay, PriorYearInfo } from "@/types";

function AccountSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 flex justify-between items-center animate-pulse">
      <div className="flex-1">
        <div className="h-5 bg-gray-200 rounded w-40 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-64" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 bg-gray-200 rounded w-8" />
        <div className="h-5 bg-gray-200 rounded w-12" />
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear() - 1);
  const [priorYears, setPriorYears] = useState<PriorYearInfo[]>([]);

  const loadData = async () => {
    try {
      setError("");
      // First fetch the active filing to get the correct calendar year
      const filingRes = await fetch("/api/filing");
      if (filingRes.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!filingRes.ok) {
        setError("Failed to load filing data. Please try again.");
        setLoading(false);
        return;
      }
      const filingData = await filingRes.json();

      let year = new Date().getFullYear() - 1;
      if (filingData.data?.length > 0) {
        const active = filingData.data.find((f: { status: string; calendarYear: number }) =>
          ["IN_PROGRESS", "REVIEWED"].includes(f.status)
        );
        if (active) {
          year = active.calendarYear;
        }
      }
      setCalendarYear(year);

      // Now fetch accounts using the correct year
      const res = await fetch(`/api/accounts?calendarYear=${year}`);
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setError("Failed to load accounts. Please try again.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.data) setAccounts(data.data);
      if (data.priorYears) setPriorYears(data.priorYears);
    } catch {
      setError("Unable to connect to the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account? This action cannot be undone.")) return;
    setDeleteError("");
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE", headers: { "X-Requested-With": "XMLHttpRequest" } });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setDeleteError("Failed to delete account. Please try again.");
        return;
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setDeleteError("Failed to delete account. Please try again.");
    }
  };

  const handleSaved = () => {
    setShowForm(false);
    loadData();
  };

  const handleEdited = () => {
    setEditingId(null);
    loadData();
  };

  const handleImport = async (sourceCalendarYear: number) => {
    const res = await fetch("/api/accounts/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ sourceCalendarYear }),
    });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to import accounts");
      return;
    }
    await loadData();
  };

  return (
    <WizardLayout currentStep={3} onPrevious="/personal">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Foreign Accounts</h1>
        <p className="text-gray-600 mb-8">Add all foreign financial accounts for the calendar year.</p>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6" role="alert">
            <p>{error}</p>
            <button
              onClick={() => { setError(""); setLoading(true); loadData(); }}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {deleteError && (
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6" role="alert">
            <p>{deleteError}</p>
            <button
              onClick={() => setDeleteError("")}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4" aria-label="Loading accounts" role="status">
            <AccountSkeleton />
            <AccountSkeleton />
            <AccountSkeleton />
          </div>
        ) : (
          <>
            {/* Account list */}
            {accounts.length > 0 && (
              <div className="space-y-4 mb-6">
                {accounts.map((account) => (
                  editingId === account.id ? (
                    <AccountEditForm
                      key={account.id}
                      account={account}
                      calendarYear={calendarYear}
                      onSuccess={handleEdited}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div key={account.id} className="bg-white rounded-lg shadow-sm border p-4 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-navy-900">{account.institutionName}</p>
                        <p className="text-sm text-gray-500">
                          {account.countryCode} &middot; ****{account.accountNumberLast4} &middot;{" "}
                          {account.currencyCode} {account.maxValueLocal.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(account.id)}
                          className="text-sm text-navy-900 hover:text-navy-700"
                          aria-label={`Edit ${account.institutionName} account`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                          aria-label={`Delete ${account.institutionName} account`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* Empty state */}
            {accounts.length === 0 && !showForm && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center mb-6">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                <p className="text-gray-700 font-medium mb-2">
                  No accounts added yet
                </p>
                <p className="text-sm text-gray-600">
                  Add your first foreign financial account to continue your FBAR filing.
                </p>
              </div>
            )}

            {/* Import banner — shown only in empty state when prior years exist */}
            {accounts.length === 0 && priorYears.length > 0 && (
              <ImportBanner priorYears={priorYears} onImport={handleImport} />
            )}

            {/* Add account form */}
            {showForm ? (
              <AccountForm
                calendarYear={calendarYear}
                onSaved={handleSaved}
                onCancel={() => { setShowForm(false); }}
              />
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-3 px-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-navy-900 hover:text-navy-900 font-medium"
              >
                + Add Foreign Account
              </button>
            )}

            {/* Continue */}
            {accounts.length > 0 && !showForm && (
              <button
                onClick={() => router.push("/review")}
                className="w-full mt-6 py-3 px-6 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-medium"
              >
                Continue to Review ({accounts.length} account{accounts.length !== 1 ? "s" : ""})
              </button>
            )}
          </>
        )}
      </div>
    </WizardLayout>
  );
}
