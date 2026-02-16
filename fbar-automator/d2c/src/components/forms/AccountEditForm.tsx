"use client";

import { useState } from "react";
import { COUNTRIES, CURRENCIES } from "@/lib/countries";
import type { AccountDisplay } from "@/types";

interface AccountEditFormProps {
  account: AccountDisplay;
  calendarYear: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AccountEditForm({ account, calendarYear, onSuccess, onCancel }: AccountEditFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    institutionName: account.institutionName,
    accountNumber: `****${account.accountNumberLast4}`, // Show masked value
    accountType: account.accountType,
    ownershipType: account.ownershipType,
    countryCode: account.countryCode,
    currencyCode: account.currencyCode,
    maxValueLocal: account.maxValueLocal.toString(),
    isJointAccount: account.isJointAccount,
    jointOwnerInfo: account.jointOwnerInfo || "",
  });

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});

    try {
      // Prepare update payload - only include accountNumber if it was changed from masked value
      const payload: Record<string, unknown> = {
        institutionName: form.institutionName,
        accountType: form.accountType,
        ownershipType: form.ownershipType,
        countryCode: form.countryCode,
        currencyCode: form.currencyCode,
        maxValueLocal: parseFloat(form.maxValueLocal),
        isJointAccount: form.isJointAccount,
        jointOwnerInfo: form.jointOwnerInfo || null,
      };

      // Only include accountNumber if user changed it (doesn't start with ****)
      if (!form.accountNumber.startsWith("****")) {
        payload.accountNumber = form.accountNumber;
      }

      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        if (data.details && typeof data.details === "object") {
          const errors: Record<string, string> = {};
          for (const [key, val] of Object.entries(data.details)) {
            errors[key] = Array.isArray(val) ? (val as string[])[0] : String(val);
          }
          setFieldErrors(errors);
        } else {
          setError(data.error || "Failed to update account");
        }
        return;
      }

      onSuccess();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Use the account ID to create truly unique IDs when multiple edit forms could be open
  const idPrefix = `edit-account-${account.id.slice(0, 8)}`;

  return (
    <div className="bg-white rounded-lg shadow-md border p-6">
      <h3 className="text-lg font-semibold text-navy-900 mb-4">Edit Account</h3>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={`${idPrefix}-institutionName`} className="block text-sm font-medium text-gray-700 mb-1">
            Institution Name <span aria-hidden="true">*</span>
          </label>
          <input
            id={`${idPrefix}-institutionName`}
            type="text"
            value={form.institutionName}
            onChange={(e) => updateField("institutionName", e.target.value)}
            required
            aria-required="true"
            aria-describedby={fieldErrors.institutionName ? `${idPrefix}-institutionName-error` : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            placeholder="e.g., HSBC, Deutsche Bank"
          />
          {fieldErrors.institutionName && (
            <p id={`${idPrefix}-institutionName-error`} className="text-red-600 text-xs mt-1" role="alert">
              {fieldErrors.institutionName}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${idPrefix}-accountNumber`} className="block text-sm font-medium text-gray-700 mb-1">
            Account Number <span aria-hidden="true">*</span>
          </label>
          <input
            id={`${idPrefix}-accountNumber`}
            type="text"
            value={form.accountNumber}
            onChange={(e) => updateField("accountNumber", e.target.value)}
            required
            aria-required="true"
            aria-describedby={`${idPrefix}-accountNumber-hint`}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
          />
          <p id={`${idPrefix}-accountNumber-hint`} className="text-xs text-gray-500 mt-1">
            Account number is encrypted. Enter a new value to change it, or leave as-is.
          </p>
          {fieldErrors.accountNumber && (
            <p id={`${idPrefix}-accountNumber-error`} className="text-red-600 text-xs mt-1" role="alert">
              {fieldErrors.accountNumber}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${idPrefix}-accountType`} className="block text-sm font-medium text-gray-700 mb-1">
              Account Type <span aria-hidden="true">*</span>
            </label>
            <select
              id={`${idPrefix}-accountType`}
              value={form.accountType}
              onChange={(e) => updateField("accountType", e.target.value)}
              aria-required="true"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            >
              <option value="BANK">Bank Account</option>
              <option value="SECURITIES">Securities Account</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-ownershipType`} className="block text-sm font-medium text-gray-700 mb-1">
              Ownership Type <span aria-hidden="true">*</span>
            </label>
            <select
              id={`${idPrefix}-ownershipType`}
              value={form.ownershipType}
              onChange={(e) => updateField("ownershipType", e.target.value)}
              aria-required="true"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            >
              <option value="FINANCIAL_INTEREST">Financial Interest</option>
              <option value="SIGNATURE_AUTHORITY">Signature Authority</option>
              <option value="BOTH">Both</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${idPrefix}-countryCode`} className="block text-sm font-medium text-gray-700 mb-1">
              Country <span aria-hidden="true">*</span>
            </label>
            <select
              id={`${idPrefix}-countryCode`}
              value={form.countryCode}
              onChange={(e) => updateField("countryCode", e.target.value)}
              required
              aria-required="true"
              aria-describedby={fieldErrors.countryCode ? `${idPrefix}-countryCode-error` : undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            {fieldErrors.countryCode && (
              <p id={`${idPrefix}-countryCode-error`} className="text-red-600 text-xs mt-1" role="alert">
                {fieldErrors.countryCode}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${idPrefix}-currencyCode`} className="block text-sm font-medium text-gray-700 mb-1">
              Currency <span aria-hidden="true">*</span>
            </label>
            <select
              id={`${idPrefix}-currencyCode`}
              value={form.currencyCode}
              onChange={(e) => updateField("currencyCode", e.target.value)}
              required
              aria-required="true"
              aria-describedby={fieldErrors.currencyCode ? `${idPrefix}-currencyCode-error` : undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            >
              <option value="">Select currency</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {fieldErrors.currencyCode && (
              <p id={`${idPrefix}-currencyCode-error`} className="text-red-600 text-xs mt-1" role="alert">
                {fieldErrors.currencyCode}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-maxValueLocal`} className="block text-sm font-medium text-gray-700 mb-1">
            Maximum Account Value (in local currency) <span aria-hidden="true">*</span>
          </label>
          <input
            id={`${idPrefix}-maxValueLocal`}
            type="number"
            step="0.01"
            min="0"
            value={form.maxValueLocal}
            onChange={(e) => updateField("maxValueLocal", e.target.value)}
            required
            aria-required="true"
            aria-describedby={fieldErrors.maxValueLocal ? `${idPrefix}-maxValueLocal-error` : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            placeholder="0.00"
          />
          {fieldErrors.maxValueLocal && (
            <p id={`${idPrefix}-maxValueLocal-error`} className="text-red-600 text-xs mt-1" role="alert">
              {fieldErrors.maxValueLocal}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`${idPrefix}-isJoint`}
            checked={form.isJointAccount}
            onChange={(e) => updateField("isJointAccount", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-navy-900"
          />
          <label htmlFor={`${idPrefix}-isJoint`} className="text-sm text-gray-700">This is a joint account</label>
        </div>

        {form.isJointAccount && (
          <div>
            <label htmlFor={`${idPrefix}-jointOwnerInfo`} className="block text-sm font-medium text-gray-700 mb-1">
              Joint Owner Information
            </label>
            <input
              id={`${idPrefix}-jointOwnerInfo`}
              type="text"
              value={form.jointOwnerInfo}
              onChange={(e) => updateField("jointOwnerInfo", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
              placeholder="Name of joint owner"
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 px-4 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
