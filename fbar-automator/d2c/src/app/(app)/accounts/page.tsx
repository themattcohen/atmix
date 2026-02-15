"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { AccountForm } from "@/components/forms/AccountForm";
import { AccountEditForm } from "@/components/forms/AccountEditForm";
import type { AccountDisplay } from "@/types";

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear() - 1);

  const loadData = async () => {
    try {
      // First fetch the active filing to get the correct calendar year
      const filingRes = await fetch("/api/filing");
      const filingData = await filingRes.json();

      let year = new Date().getFullYear() - 1;
      if (filingData.data?.length > 0) {
        const active = filingData.data.find((f: any) =>
          ["IN_PROGRESS", "REVIEWED"].includes(f.status)
        );
        if (active) {
          year = active.calendarYear;
        }
      }
      setCalendarYear(year);

      // Now fetch accounts using the correct year
      const res = await fetch(`/api/accounts?calendarYear=${year}`);
      const data = await res.json();
      if (data.data) setAccounts(data.data);
    } catch {
      console.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this account?")) return;
    try {
      await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      console.error("Failed to delete account");
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

  return (
    <WizardLayout currentStep={3} onPrevious="/personal">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Foreign Accounts</h1>
        <p className="text-gray-600 mb-8">Add all foreign financial accounts for the calendar year.</p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
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
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="text-sm text-red-600 hover:text-red-800"
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
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center mb-6">
                <p className="text-gray-700 mb-2">
                  You need to add at least one foreign account to continue your filing.
                </p>
                <p className="text-sm text-gray-600">
                  Click the button below to add your first account.
                </p>
              </div>
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
