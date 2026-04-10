"use client";

import { useState } from "react";
import { COUNTRIES, CURRENCIES } from "@/lib/countries";
import { ProvinceStateSelect } from "@/components/forms/ProvinceStateSelect";

interface AccountFormProps {
  calendarYear: number;
  onSaved: () => void;
  onCancel: () => void;
}

export function AccountForm({ calendarYear, onSaved, onCancel }: AccountFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    institutionName: "",
    accountNumber: "",
    accountType: "BANK",
    ownershipType: "FINANCIAL_INTEREST",
    countryCode: "",
    currencyCode: "",
    maxValueLocal: "",
    isJointAccount: false,
    jointOwnerInfo: "",
    institutionState: "",
    jointOwnerFirstName: "",
    jointOwnerLastName: "",
    jointOwnerCountry: "",
    jointOwnerStreet: "",
    jointOwnerCity: "",
    jointOwnerState: "",
    jointOwnerZip: "",
    jointOwnerTin: "",
    jointOwnerTinType: "",
  });

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Clear province/state when country changes away from CA/MX
      if (field === "countryCode" && value !== "CA" && value !== "MX") {
        next.institutionState = "";
      }
      // When ownershipType changes to SIGNATURE_AUTHORITY, uncheck joint account and clear fields
      if (field === "ownershipType" && value === "SIGNATURE_AUTHORITY") {
        next.isJointAccount = false;
        next.jointOwnerInfo = "";
        next.jointOwnerFirstName = "";
        next.jointOwnerLastName = "";
        next.jointOwnerCountry = "";
        next.jointOwnerStreet = "";
        next.jointOwnerCity = "";
        next.jointOwnerState = "";
        next.jointOwnerZip = "";
        next.jointOwnerTin = "";
        next.jointOwnerTinType = "";
      }
      // When unchecking isJointAccount, clear all joint owner fields
      if (field === "isJointAccount" && value === false) {
        next.jointOwnerInfo = "";
        next.jointOwnerFirstName = "";
        next.jointOwnerLastName = "";
        next.jointOwnerCountry = "";
        next.jointOwnerStreet = "";
        next.jointOwnerCity = "";
        next.jointOwnerState = "";
        next.jointOwnerZip = "";
        next.jointOwnerTin = "";
        next.jointOwnerTinType = "";
      }
      // Clear TIN type when TIN is cleared
      if (field === "jointOwnerTin" && value === "") {
        next.jointOwnerTinType = "";
      }
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({
          ...form,
          maxValueLocal: parseFloat(form.maxValueLocal),
          calendarYear,
          institutionAddress: (form.countryCode === "CA" || form.countryCode === "MX") && form.institutionState
            ? { state: form.institutionState, country: form.countryCode }
            : undefined,
          jointOwnerInfo: form.isJointAccount
            ? `${form.jointOwnerFirstName} ${form.jointOwnerLastName}`.trim()
            : "",
          jointOwnerFirstName: form.jointOwnerFirstName || undefined,
          jointOwnerLastName: form.jointOwnerLastName || undefined,
          jointOwnerAddress: form.isJointAccount && form.jointOwnerCountry
            ? {
                street: form.jointOwnerStreet || undefined,
                city: form.jointOwnerCity || undefined,
                state: form.jointOwnerState || undefined,
                country: form.jointOwnerCountry,
                zip: form.jointOwnerZip || undefined,
              }
            : undefined,
          jointOwnerTin: form.jointOwnerTin || undefined,
          jointOwnerTinType: form.jointOwnerTin ? form.jointOwnerTinType || undefined : undefined,
        }),
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
          setError(data.error || "Failed to save account");
        }
        return;
      }

      onSaved();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const showJointOwnerSection = form.isJointAccount && form.ownershipType !== "SIGNATURE_AUTHORITY";

  return (
    <div className="bg-white rounded-lg shadow-md border p-6">
      <h3 className="text-lg font-semibold text-navy-900 mb-4">Add Foreign Account</h3>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="new-account-institutionName" className="block text-sm font-medium text-gray-700 mb-1">
            Institution Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="new-account-institutionName"
            type="text"
            value={form.institutionName}
            onChange={(e) => updateField("institutionName", e.target.value)}
            required
            aria-required="true"
            aria-describedby={fieldErrors.institutionName ? "new-account-institutionName-error" : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            placeholder="e.g., HSBC, Deutsche Bank"
          />
          {fieldErrors.institutionName && (
            <p id="new-account-institutionName-error" className="text-red-600 text-xs mt-1" role="alert">
              {fieldErrors.institutionName}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="new-account-accountNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Account Number <span aria-hidden="true">*</span>
          </label>
          <input
            id="new-account-accountNumber"
            type="text"
            value={form.accountNumber}
            onChange={(e) => updateField("accountNumber", e.target.value)}
            required
            aria-required="true"
            aria-describedby={fieldErrors.accountNumber ? "new-account-accountNumber-error" : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            placeholder="e.g., 001-234567-890"
          />
          {fieldErrors.accountNumber && (
            <p id="new-account-accountNumber-error" className="text-red-600 text-xs mt-1" role="alert">
              {fieldErrors.accountNumber}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="new-account-accountType" className="block text-sm font-medium text-gray-700 mb-1">
              Account Type <span aria-hidden="true">*</span>
            </label>
            <select
              id="new-account-accountType"
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
            <label htmlFor="new-account-ownershipType" className="block text-sm font-medium text-gray-700 mb-1">
              Ownership Type <span aria-hidden="true">*</span>
            </label>
            <select
              id="new-account-ownershipType"
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
            <label htmlFor="new-account-countryCode" className="block text-sm font-medium text-gray-700 mb-1">
              Country <span aria-hidden="true">*</span>
            </label>
            <select
              id="new-account-countryCode"
              value={form.countryCode}
              onChange={(e) => updateField("countryCode", e.target.value)}
              required
              aria-required="true"
              aria-describedby={fieldErrors.countryCode ? "new-account-countryCode-error" : undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            {fieldErrors.countryCode && (
              <p id="new-account-countryCode-error" className="text-red-600 text-xs mt-1" role="alert">
                {fieldErrors.countryCode}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="new-account-currencyCode" className="block text-sm font-medium text-gray-700 mb-1">
              Currency <span aria-hidden="true">*</span>
            </label>
            <select
              id="new-account-currencyCode"
              value={form.currencyCode}
              onChange={(e) => updateField("currencyCode", e.target.value)}
              required
              aria-required="true"
              aria-describedby={fieldErrors.currencyCode ? "new-account-currencyCode-error" : undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            >
              <option value="">Select currency</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {fieldErrors.currencyCode && (
              <p id="new-account-currencyCode-error" className="text-red-600 text-xs mt-1" role="alert">
                {fieldErrors.currencyCode}
              </p>
            )}
          </div>
        </div>

        <ProvinceStateSelect
          countryCode={form.countryCode}
          value={form.institutionState}
          onChange={(v) => updateField("institutionState", v)}
          id="new-account-institutionState"
          error={fieldErrors["institutionAddress.state"] || fieldErrors.institutionState}
        />

        <div>
          <label htmlFor="new-account-maxValueLocal" className="block text-sm font-medium text-gray-700 mb-1">
            Maximum Account Value (in local currency) <span aria-hidden="true">*</span>
          </label>
          <input
            id="new-account-maxValueLocal"
            type="number"
            step="0.01"
            min="0"
            value={form.maxValueLocal}
            onChange={(e) => updateField("maxValueLocal", e.target.value)}
            required
            aria-required="true"
            aria-describedby={fieldErrors.maxValueLocal ? "new-account-maxValueLocal-error" : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            placeholder="0.00"
          />
          {fieldErrors.maxValueLocal && (
            <p id="new-account-maxValueLocal-error" className="text-red-600 text-xs mt-1" role="alert">
              {fieldErrors.maxValueLocal}
            </p>
          )}
        </div>

        {form.ownershipType !== "SIGNATURE_AUTHORITY" && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="new-account-isJoint"
              checked={form.isJointAccount}
              onChange={(e) => updateField("isJointAccount", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-navy-900"
            />
            <label htmlFor="new-account-isJoint" className="text-sm text-gray-700">This is a joint account</label>
          </div>
        )}

        {showJointOwnerSection && (
          <div className="space-y-4 border border-gray-200 rounded-md p-4">
            <p className="text-sm font-medium text-gray-700">Joint Owner Information</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-account-jointOwnerFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span aria-hidden="true">*</span>
                </label>
                <input
                  id="new-account-jointOwnerFirstName"
                  type="text"
                  value={form.jointOwnerFirstName}
                  onChange={(e) => updateField("jointOwnerFirstName", e.target.value)}
                  required
                  aria-required="true"
                  aria-describedby={fieldErrors.jointOwnerFirstName ? "new-account-jointOwnerFirstName-error" : undefined}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
                {fieldErrors.jointOwnerFirstName && (
                  <p id="new-account-jointOwnerFirstName-error" className="text-red-600 text-xs mt-1" role="alert">
                    {fieldErrors.jointOwnerFirstName}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="new-account-jointOwnerLastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span aria-hidden="true">*</span>
                </label>
                <input
                  id="new-account-jointOwnerLastName"
                  type="text"
                  value={form.jointOwnerLastName}
                  onChange={(e) => updateField("jointOwnerLastName", e.target.value)}
                  required
                  aria-required="true"
                  aria-describedby={fieldErrors.jointOwnerLastName ? "new-account-jointOwnerLastName-error" : undefined}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
                {fieldErrors.jointOwnerLastName && (
                  <p id="new-account-jointOwnerLastName-error" className="text-red-600 text-xs mt-1" role="alert">
                    {fieldErrors.jointOwnerLastName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="new-account-jointOwnerCountry" className="block text-sm font-medium text-gray-700 mb-1">
                Country <span aria-hidden="true">*</span>
              </label>
              <select
                id="new-account-jointOwnerCountry"
                value={form.jointOwnerCountry}
                onChange={(e) => updateField("jointOwnerCountry", e.target.value)}
                required
                aria-required="true"
                aria-describedby={fieldErrors.jointOwnerCountry ? "new-account-jointOwnerCountry-error" : undefined}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              {fieldErrors.jointOwnerCountry && (
                <p id="new-account-jointOwnerCountry-error" className="text-red-600 text-xs mt-1" role="alert">
                  {fieldErrors.jointOwnerCountry}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="new-account-jointOwnerStreet" className="block text-sm font-medium text-gray-700 mb-1">
                Street Address
              </label>
              <input
                id="new-account-jointOwnerStreet"
                type="text"
                value={form.jointOwnerStreet}
                onChange={(e) => updateField("jointOwnerStreet", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="new-account-jointOwnerCity" className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  id="new-account-jointOwnerCity"
                  type="text"
                  value={form.jointOwnerCity}
                  onChange={(e) => updateField("jointOwnerCity", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
              </div>
              <div>
                <label htmlFor="new-account-jointOwnerState" className="block text-sm font-medium text-gray-700 mb-1">
                  State / Province
                </label>
                <input
                  id="new-account-jointOwnerState"
                  type="text"
                  value={form.jointOwnerState}
                  onChange={(e) => updateField("jointOwnerState", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
              </div>
              <div>
                <label htmlFor="new-account-jointOwnerZip" className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP / Postal Code
                </label>
                <input
                  id="new-account-jointOwnerZip"
                  type="text"
                  value={form.jointOwnerZip}
                  onChange={(e) => updateField("jointOwnerZip", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-account-jointOwnerTin" className="block text-sm font-medium text-gray-700 mb-1">
                TIN
              </label>
              <input
                id="new-account-jointOwnerTin"
                type="text"
                value={form.jointOwnerTin}
                onChange={(e) => updateField("jointOwnerTin", e.target.value)}
                aria-describedby={fieldErrors.jointOwnerTin ? "new-account-jointOwnerTin-error" : undefined}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
                placeholder="SSN or ITIN (optional)"
              />
              {fieldErrors.jointOwnerTin && (
                <p id="new-account-jointOwnerTin-error" className="text-red-600 text-xs mt-1" role="alert">
                  {fieldErrors.jointOwnerTin}
                </p>
              )}
            </div>

            {form.jointOwnerTin && (
              <div>
                <label htmlFor="new-account-jointOwnerTinType" className="block text-sm font-medium text-gray-700 mb-1">
                  TIN Type
                </label>
                <select
                  id="new-account-jointOwnerTinType"
                  value={form.jointOwnerTinType}
                  onChange={(e) => updateField("jointOwnerTinType", e.target.value)}
                  aria-describedby={fieldErrors.jointOwnerTinType ? "new-account-jointOwnerTinType-error" : undefined}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
                >
                  <option value="">Select type</option>
                  <option value="SSN">SSN</option>
                  <option value="ITIN">ITIN</option>
                </select>
                {fieldErrors.jointOwnerTinType && (
                  <p id="new-account-jointOwnerTinType-error" className="text-red-600 text-xs mt-1" role="alert">
                    {fieldErrors.jointOwnerTinType}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 px-4 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Account"}
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
