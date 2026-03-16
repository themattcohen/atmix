"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { AccountForm } from "@/components/forms/AccountForm";
import { AccountEditForm } from "@/components/forms/AccountEditForm";
import { MultiStatementUpload, type UploadedFileInfo } from "@/components/forms/MultiStatementUpload";
import { ExtractedAccountReview } from "@/components/forms/ExtractedAccountReview";
import type { AccountToSave } from "@/components/forms/ExtractedAccountReview";
import type { MappedAccount } from "@/lib/extraction-mapper";
import { ImportBanner } from "@/components/ImportBanner";
import { PRICING } from "@/lib/pricing";
import { pushDataLayer } from "@/lib/gtm";
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
  const [filingYearId, setFilingYearId] = useState<string | null>(null);
  const [tier, setTier] = useState<"BASIC" | "PREMIUM">("BASIC");
  const [tierSelected, setTierSelected] = useState(false);
  const [extractedAccounts, setExtractedAccounts] = useState<MappedAccount[] | null>(null);
  const [savingExtracted, setSavingExtracted] = useState(false);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [coverageWarning, setCoverageWarning] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);

  const loadData = useCallback(async () => {
    try {
      setError("");
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
        const active = filingData.data.find((f: { status: string; calendarYear: number; id: string; tier: string }) =>
          ["IN_PROGRESS", "REVIEWED"].includes(f.status)
        );
        if (active) {
          year = active.calendarYear;
          setFilingYearId(active.id);
          setTier(active.tier || "BASIC");
          // If tier was already explicitly set to PREMIUM, skip tier selection
          if (active.tier === "PREMIUM") {
            setTierSelected(true);
          }
        }
      }
      setCalendarYear(year);

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
      if (data.data) {
        setAccounts(data.data);
        // If user already has accounts, skip tier selection
        if (data.data.length > 0) setTierSelected(true);
      }
      if (data.priorYears) setPriorYears(data.priorYears);
    } catch {
      setError("Unable to connect to the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    pushDataLayer({ event: "fbar_step_view", step: 3, step_name: "accounts" });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
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

  const handleTierSelect = async (selectedTier: "BASIC" | "PREMIUM") => {
    if (!filingYearId) return;
    setTier(selectedTier);
    setTierSelected(true);

    // Update tier on server
    try {
      await fetch("/api/filing/tier", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ filingYearId, tier: selectedTier }),
      });
    } catch {
      // Non-blocking — tier will default to BASIC if this fails
    }
  };

  const handleAllExtracted = (mapped: MappedAccount[], warnings: string[]) => {
    setExtractedAccounts(mapped);
    setUploadWarnings(warnings);
  };

  const handleSaveExtracted = async (accountsToSave: AccountToSave[]) => {
    setSavingExtracted(true);
    try {
      for (const account of accountsToSave) {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify(account),
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Failed to save extracted account");
          break;
        }
      }
      setExtractedAccounts(null);
      setCoverageWarning(null);
      setUploadedFiles([]);
      await loadData();
    } catch {
      setError("Failed to save extracted accounts. Please try again.");
    } finally {
      setSavingExtracted(false);
    }
  };

  // Tier selection view — shown when no accounts and tier not yet chosen
  if (!loading && accounts.length === 0 && !tierSelected && filingYearId) {
    return (
      <WizardLayout currentStep={3} onPrevious="/personal">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-navy-900 mb-2">Choose Your Filing Method</h1>
          <p className="text-gray-600 mb-8">Select how you&apos;d like to add your foreign accounts.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic */}
            <button
              onClick={() => handleTierSelect("BASIC")}
              className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6 text-left hover:border-navy-900 transition-colors group"
            >
              <p className="text-2xl font-bold text-navy-900 mb-1">${PRICING.basic.amountDollars}</p>
              <p className="text-sm font-medium text-navy-900 mb-3">{PRICING.basic.name}</p>
              <p className="text-sm text-gray-600 mb-4">Enter your foreign account details manually using our guided form.</p>
              <span className="text-sm text-navy-900 font-medium group-hover:underline">
                Enter accounts manually →
              </span>
            </button>

            {/* Premium */}
            <button
              onClick={() => handleTierSelect("PREMIUM")}
              className="bg-white rounded-lg shadow-md border-2 border-gold-500 p-6 text-left hover:border-gold-600 transition-colors group relative"
            >
              <div className="absolute -top-2.5 left-4 bg-gold-500 text-navy-900 text-xs font-bold px-2 py-0.5 rounded-full">
                Recommended
              </div>
              <p className="text-2xl font-bold text-navy-900 mb-1">${PRICING.premium.amountDollars}</p>
              <p className="text-sm font-medium text-navy-900 mb-3">{PRICING.premium.name}</p>
              <p className="text-sm text-gray-600 mb-4">Upload bank statements and let AI extract your account details automatically.</p>
              <span className="text-sm text-navy-900 font-medium group-hover:underline">
                Upload statements →
              </span>
            </button>
          </div>
        </div>
      </WizardLayout>
    );
  }

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
            {accounts.length === 0 && !showForm && !extractedAccounts && (
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
                  {tier === "PREMIUM"
                    ? "Upload a bank statement above, or add an account manually below."
                    : "Add your first foreign financial account to continue your FBAR filing."}
                </p>
              </div>
            )}

            {/* Import banner */}
            {accounts.length === 0 && priorYears.length > 0 && !extractedAccounts && (
              <ImportBanner priorYears={priorYears} onImport={handleImport} />
            )}

            {/* Statement upload — premium only */}
            {tier === "PREMIUM" && filingYearId && !extractedAccounts && !showForm && (
              <div className="mb-6">
                <MultiStatementUpload
                  filingYearId={filingYearId}
                  calendarYear={calendarYear}
                  onAllExtracted={handleAllExtracted}
                  onCoverageWarning={setCoverageWarning}
                  onError={(err) => setError(err)}
                  onFilesChanged={setUploadedFiles}
                />
              </div>
            )}

            {/* Uploaded files list — persists during review */}
            {uploadedFiles.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Uploaded Statements</h3>
                <div className="space-y-1">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={
                        f.status === "done" ? "text-green-600" :
                        f.status === "error" ? "text-red-600" :
                        f.status === "uploading" ? "text-navy-900" :
                        "text-gray-400"
                      }>
                        {f.status === "done" ? "✓" :
                         f.status === "error" ? "✗" :
                         f.status === "uploading" ? "⟳" :
                         "○"}
                      </span>
                      {f.status === "done" && f.confidence && (
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            f.confidence === "high" ? "bg-green-500" :
                            f.confidence === "medium" ? "bg-amber-500" :
                            "bg-red-500"
                          }`}
                          title={`${f.confidence} confidence`}
                          aria-label={`${f.confidence} extraction confidence`}
                        />
                      )}
                      <span className="text-gray-700 truncate">{f.name}</span>
                      <span className="text-gray-400 text-xs">
                        {f.size < 1024 ? `${f.size} B` :
                         f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)} KB` :
                         `${(f.size / 1024 / 1024).toFixed(1)} MB`}
                      </span>
                      {f.errorMessage && <span className="text-red-600 text-xs">{f.errorMessage}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coverage warning — persists during review */}
            {coverageWarning && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4" role="alert">
                <p className="text-sm text-amber-800">{coverageWarning}</p>
              </div>
            )}

            {/* Extracted account review */}
            {extractedAccounts && (
              <div className="mb-6">
                <ExtractedAccountReview
                  accounts={extractedAccounts}
                  calendarYear={calendarYear}
                  warnings={uploadWarnings}
                  onSaveAll={handleSaveExtracted}
                  onDismiss={() => { setExtractedAccounts(null); setCoverageWarning(null); setUploadedFiles([]); }}
                />
                {savingExtracted && (
                  <div className="mt-2 text-center text-sm text-gray-500">Saving accounts...</div>
                )}
              </div>
            )}

            {/* Add account form */}
            {showForm ? (
              <AccountForm
                calendarYear={calendarYear}
                onSaved={handleSaved}
                onCancel={() => { setShowForm(false); }}
              />
            ) : !extractedAccounts && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-3 px-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-navy-900 hover:text-navy-900 font-medium"
              >
                + Add Foreign Account
              </button>
            )}

            {/* Continue */}
            {accounts.length > 0 && !showForm && !extractedAccounts && (
              <button
                onClick={() => {
                  pushDataLayer({ event: "fbar_step_complete", step: 3, step_name: "accounts", account_count: accounts.length });
                  router.push("/review");
                }}
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
