"use client";

import { useState } from "react";
import { COUNTRIES, CURRENCIES } from "@/lib/countries";
import type { MappedAccount } from "@/lib/extraction-mapper";

interface ExtractedAccountReviewProps {
  accounts: MappedAccount[];
  calendarYear: number;
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

      {accounts.some((a) => a.warnings.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-sm text-amber-800">
          <p className="font-medium mb-1">Extraction Warnings</p>
          <ul className="list-disc list-inside space-y-1">
            {accounts.flatMap((a, i) =>
              a.warnings.map((w, j) => <li key={`${i}-${j}`}>{w}</li>)
            )}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {accounts.map((mapped, index) => (
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
            )}
          </div>
        ))}
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
