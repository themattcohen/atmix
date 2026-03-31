"use client";

import { useState } from "react";
import { COUNTRIES, CURRENCIES } from "@/lib/countries";
import type { MappedAccount } from "@/lib/extraction-mapper";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ExtractedAccountReviewProps {
  accounts: MappedAccount[];
  calendarYear: number;
  coverageData?: { monthsCovered: number[]; monthsMissing: number[] } | null;
  onSaveAll: (accounts: AccountToSave[]) => void;
  onDismiss: () => void;
}


export interface AccountToSave {
  institutionName: string;
  accountNumber: string;
  accountType: "BANK" | "SECURITIES" | "OTHER";
  ownershipType: "FINANCIAL_INTEREST" | "SIGNATURE_AUTHORITY" | "BOTH";
  countryCode: string;
  currencyCode: string;
  maxValueLocal: number;
  isJointAccount: boolean;
  calendarYear: number;
  sourceStatementId?: string;
}

function confidenceColor(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high": return "text-green-600";
    case "medium": return "text-amber-600";
    case "low": return "text-red-600";
  }
}

function confidenceBg(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high": return "";
    case "medium": return "bg-amber-50";
    case "low": return "bg-red-50";
  }
}

export function ExtractedAccountReview({
  accounts,
  calendarYear,
  coverageData,
  onSaveAll,
  onDismiss,
}: ExtractedAccountReviewProps) {
  const [editedAccounts, setEditedAccounts] = useState<AccountToSave[]>(
    accounts.map((a) => ({
      institutionName: a.account.institutionName,
      accountNumber: a.account.accountNumber,
      accountType: a.account.accountType,
      ownershipType: a.account.ownershipType,
      countryCode: a.account.countryCode,
      currencyCode: a.account.currencyCode,
      maxValueLocal: a.account.maxValueLocal,
      isJointAccount: a.account.isJointAccount,
      calendarYear,
      sourceStatementId: a.statementId,
    }))
  );
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const updateAccount = (index: number, field: string, value: string | number | boolean) => {
    setEditedAccounts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleExclude = (index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSaveAll = () => {
    const toSave = editedAccounts.filter((_, i) => !excluded.has(i));
    if (toSave.length === 0) {
      onDismiss();
      return;
    }
    setSaving(true);
    onSaveAll(toSave);
  };

  const coveredSet = new Set(coverageData?.monthsCovered ?? []);
  const hasCoverageGaps = coverageData && coverageData.monthsMissing.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-md border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-navy-900">
          Review Extracted Accounts ({accounts.length})
        </h3>
        <span className="text-sm text-gray-500">
          AI-extracted — please verify before saving
        </span>
      </div>

      {/* Coverage FYI header with month bar — non-blocking info style */}
      {coverageData && (
        <div className={`rounded-md p-3 mb-4 text-sm ${hasCoverageGaps ? "bg-slate-50 border border-slate-200 text-slate-700" : "bg-green-50 border border-green-200 text-green-800"}`}>
          <div className="flex items-start gap-2">
            <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={hasCoverageGaps ? "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" : "M5 13l4 4L19 7"} />
            </svg>
            <div className="flex-1">
              {hasCoverageGaps ? (
                <p>
                  Statements cover {coverageData.monthsCovered.map((m) => MONTH_ABBR[m - 1]).join(", ")}.{" "}
                  {coverageData.monthsMissing.map((m) => MONTH_ABBR[m - 1]).join(", ")}{" "}
                  {coverageData.monthsMissing.length === 1 ? "is" : "are"} not covered
                  — if the max balance below looks correct, you can proceed.
                </p>
              ) : (
                <p>All 12 months of {calendarYear} are covered by your statements.</p>
              )}
              {/* Month coverage bar */}
              <div className="flex gap-1 mt-2" aria-label={`Statement coverage for ${calendarYear}`}>
                {MONTH_ABBR.map((abbr, i) => {
                  const monthNum = i + 1;
                  const isCovered = coveredSet.has(monthNum);
                  return (
                    <div
                      key={monthNum}
                      className={`flex-1 text-center text-[10px] py-0.5 rounded ${
                        isCovered
                          ? "bg-green-200 text-green-800"
                          : "bg-gray-100 text-gray-400"
                      }`}
                      title={`${abbr}: ${isCovered ? "covered" : "not covered"}`}
                    >
                      {abbr}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success banner when no coverage data and no notes */}
      {!coverageData && accounts.every((a) => !a.structuredNotes?.length) && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4 flex items-center gap-2 text-sm text-green-800" role="status">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Extraction complete. Please verify the details below.
        </div>
      )}

      <div className="space-y-6">
        {accounts.map((mapped, index) => {
          const notes = mapped.structuredNotes ?? [];
          const history = mapped.balanceHistory ?? [];

          return (
            <div
              key={index}
              className={`border rounded-lg p-4 ${excluded.has(index) ? "opacity-50 bg-gray-50" : ""}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-navy-900">Account {index + 1}</span>
                  <span className={`text-xs font-medium ${confidenceColor(mapped.confidence.overall)}`}>
                    {mapped.confidence.overall} confidence
                  </span>
                </div>
                <button
                  onClick={() => toggleExclude(index)}
                  className="text-sm text-gray-500 hover:text-red-600"
                >
                  {excluded.has(index) ? "Include" : "Exclude"}
                </button>
              </div>

              {!excluded.has(index) && (
                <>
                  {/* Structured notes dropdown */}
                  {notes.length > 0 && (
                    <details className="mb-3 group">
                      <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 select-none flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {notes.length} extraction note{notes.length !== 1 ? "s" : ""}
                      </summary>
                      <ul className="mt-1.5 ml-5 text-xs text-gray-600 space-y-1 list-disc list-inside">
                        {notes.map((note, i) => <li key={i}>{note.message}</li>)}
                      </ul>
                    </details>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={confidenceBg(mapped.confidence.bank_name)}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Institution Name
                        {mapped.confidence.bank_name !== "high" && (
                          <span className={`ml-1 ${confidenceColor(mapped.confidence.bank_name)}`}>
                            ({mapped.confidence.bank_name})
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={editedAccounts[index].institutionName}
                        onChange={(e) => updateAccount(index, "institutionName", e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-navy-900"
                      />
                    </div>

                    <div className={confidenceBg(mapped.confidence.account_number)}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Account Number
                        {mapped.confidence.account_number !== "high" && (
                          <span className={`ml-1 ${confidenceColor(mapped.confidence.account_number)}`}>
                            ({mapped.confidence.account_number})
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={editedAccounts[index].accountNumber}
                        onChange={(e) => updateAccount(index, "accountNumber", e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-navy-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Account Type</label>
                      <select
                        value={editedAccounts[index].accountType}
                        onChange={(e) => updateAccount(index, "accountType", e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-navy-900"
                      >
                        <option value="BANK">Bank Account</option>
                        <option value="SECURITIES">Securities Account</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ownership Type</label>
                      <select
                        value={editedAccounts[index].ownershipType}
                        onChange={(e) => updateAccount(index, "ownershipType", e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-navy-900"
                      >
                        <option value="FINANCIAL_INTEREST">Financial Interest</option>
                        <option value="SIGNATURE_AUTHORITY">Signature Authority</option>
                        <option value="BOTH">Both</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                      <select
                        value={editedAccounts[index].countryCode}
                        onChange={(e) => updateAccount(index, "countryCode", e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-navy-900"
                      >
                        <option value="">Select country</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className={confidenceBg(mapped.confidence.currency)}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Currency
                        {mapped.confidence.currency !== "high" && (
                          <span className={`ml-1 ${confidenceColor(mapped.confidence.currency)}`}>
                            ({mapped.confidence.currency})
                          </span>
                        )}
                      </label>
                      <select
                        value={editedAccounts[index].currencyCode}
                        onChange={(e) => updateAccount(index, "currencyCode", e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-navy-900"
                      >
                        <option value="">Select currency</option>
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className={confidenceBg(mapped.confidence.max_balance)}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Max Value (local currency)
                        {mapped.confidence.max_balance !== "high" && (
                          <span className={`ml-1 ${confidenceColor(mapped.confidence.max_balance)}`}>
                            ({mapped.confidence.max_balance})
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editedAccounts[index].maxValueLocal}
                        onChange={(e) => updateAccount(index, "maxValueLocal", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-navy-900"
                      />
                    </div>
                  </div>

                  {/* Balance History table */}
                  {history.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 select-none">
                        Balance history ({history.length} statement{history.length !== 1 ? "s" : ""})
                      </summary>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-500 border-b">
                              <th className="pb-1 pr-4 font-medium">Period</th>
                              <th className="pb-1 pr-4 font-medium text-right">Max Balance</th>
                              <th className="pb-1 font-medium">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((entry, i) => (
                              <tr
                                key={i}
                                className={`border-b border-gray-100 ${entry.isYearMax ? "font-semibold" : ""}`}
                              >
                                <td className="py-1 pr-4 text-gray-700">{entry.periodLabel}</td>
                                <td className="py-1 pr-4 text-right text-gray-700">
                                  {entry.maxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {entry.isYearMax && (
                                    <span className="ml-1.5 inline-block bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                      year max
                                    </span>
                                  )}
                                </td>
                                <td className="py-1 text-gray-500">{entry.maxDate || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleSaveAll}
          disabled={saving || editedAccounts.filter((_, i) => !excluded.has(i)).length === 0}
          className="flex-1 py-2 px-4 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : `Add ${editedAccounts.filter((_, i) => !excluded.has(i)).length} Account${editedAccounts.filter((_, i) => !excluded.has(i)).length !== 1 ? "s" : ""} to Filing`}
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
