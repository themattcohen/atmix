"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { US_STATES } from "@/lib/validation";
import { formatSSN } from "@/lib/utils";

export default function PersonalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [hasSavedTin, setHasSavedTin] = useState(false);
  const [tinLast4, setTinLast4] = useState("");
  const [tinFocused, setTinFocused] = useState(false);
  const tinRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    tin: "",
    tinType: "SSN" as "SSN" | "ITIN",
    dateOfBirth: "",
    usAddress: { street: "", street2: "", city: "", state: "", zip: "" },
    phone: "",
  });

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      try {
        const res = await fetch("/api/user");
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = await res.json();
        if (data.data) {
          const u = data.data;
          setForm({
            firstName: u.firstName || "",
            lastName: u.lastName || "",
            middleName: u.middleName || "",
            suffix: u.suffix || "",
            tin: "",
            tinType: u.tinType || "SSN",
            dateOfBirth: u.dateOfBirth || "",
            usAddress: u.usAddress || { street: "", street2: "", city: "", state: "", zip: "" },
            phone: u.phone || "",
          });
          if (u.hasTin || u.tinLast4) {
            setHasSavedTin(true);
            setTinLast4(u.tinLast4 || "");
          }
        }
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: [] }));
  };

  const handleTinChange = (value: string) => {
    const formatted = formatSSN(value);
    setForm((prev) => ({ ...prev, tin: formatted }));
    setFieldErrors((prev) => ({ ...prev, tin: [] }));
    setHasSavedTin(false);
    setTinLast4("");
  };

  // Compute the displayed TIN value: masked when blurred with a saved value, raw when focused or editing
  const getTinDisplayValue = (): string => {
    // If the user is focused on the field, show the raw value for editing
    if (tinFocused) {
      return form.tin;
    }
    // If user has typed a new TIN (not yet saved), show it masked with last 4
    if (form.tin && form.tin.replace(/\D/g, "").length >= 4) {
      const digits = form.tin.replace(/\D/g, "");
      return `***-**-${digits.slice(-4)}`;
    }
    // If there's a saved TIN on the server but user hasn't typed anything
    if (hasSavedTin && tinLast4 && !form.tin) {
      return `***-**-${tinLast4}`;
    }
    // Otherwise show whatever is in the field
    return form.tin;
  };

  const handleTinFocus = () => {
    setTinFocused(true);
  };

  const handleTinBlur = () => {
    setTinFocused(false);
  };

  const updateAddress = (field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      usAddress: { ...prev.usAddress, [field]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});

    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        if (data.details) setFieldErrors(data.details);
        else setError(data.error || "Failed to save");
        return;
      }

      router.push("/accounts");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <WizardLayout currentStep={2} onPrevious="/threshold">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
        </div>
      </WizardLayout>
    );
  }

  return (
    <WizardLayout currentStep={2} onPrevious="/threshold">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Personal Information</h1>
        <p className="text-gray-600 mb-8">This information will appear on your FBAR filing.</p>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span aria-hidden="true">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                value={form.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                required
                aria-required="true"
                aria-describedby={fieldErrors.firstName?.length ? "firstName-error" : undefined}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
              />
              {fieldErrors.firstName?.map((e, i) => (
                <p key={i} id={i === 0 ? "firstName-error" : undefined} className="text-red-600 text-xs mt-1" role="alert">{e}</p>
              ))}
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span aria-hidden="true">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                value={form.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                required
                aria-required="true"
                aria-describedby={fieldErrors.lastName?.length ? "lastName-error" : undefined}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
              />
              {fieldErrors.lastName?.map((e, i) => (
                <p key={i} id={i === 0 ? "lastName-error" : undefined} className="text-red-600 text-xs mt-1" role="alert">{e}</p>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input
                id="middleName"
                type="text"
                value={form.middleName}
                onChange={(e) => updateField("middleName", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
              />
            </div>
            <div>
              <label htmlFor="suffix" className="block text-sm font-medium text-gray-700 mb-1">Suffix</label>
              <input
                id="suffix"
                type="text"
                value={form.suffix}
                onChange={(e) => updateField("suffix", e.target.value)}
                placeholder="Jr., Sr., III"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
              />
            </div>
          </div>

          {/* TIN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tin" className="block text-sm font-medium text-gray-700 mb-1">
                SSN / ITIN <span aria-hidden="true">*</span>
              </label>
              <input
                id="tin"
                ref={tinRef}
                type="text"
                value={getTinDisplayValue()}
                onChange={(e) => handleTinChange(e.target.value)}
                onFocus={handleTinFocus}
                onBlur={handleTinBlur}
                placeholder={hasSavedTin ? "***-**-**** (saved \u2014 enter new to update)" : "XXX-XX-XXXX"}
                maxLength={11}
                required={!hasSavedTin}
                aria-required={!hasSavedTin ? "true" : undefined}
                aria-describedby={fieldErrors.tin?.length ? "tin-error" : "tin-hint"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
              />
              <p id="tin-hint" className="text-xs text-gray-500 mt-1">
                {hasSavedTin
                  ? "Your SSN/ITIN is saved securely. Enter a new value to update it."
                  : "Enter your 9-digit SSN or ITIN. It will be masked when you leave this field."}
              </p>
              {fieldErrors.tin?.map((e, i) => (
                <p key={i} id={i === 0 ? "tin-error" : undefined} className="text-red-600 text-xs mt-1" role="alert">{e}</p>
              ))}
            </div>
            <div>
              <label htmlFor="tinType" className="block text-sm font-medium text-gray-700 mb-1">
                TIN Type <span aria-hidden="true">*</span>
              </label>
              <select
                id="tinType"
                value={form.tinType}
                onChange={(e) => updateField("tinType", e.target.value)}
                aria-required="true"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
              >
                <option value="SSN">SSN</option>
                <option value="ITIN">ITIN</option>
              </select>
            </div>
          </div>

          {/* DOB */}
          <div>
            <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth <span aria-hidden="true">*</span>
            </label>
            <input
              id="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => updateField("dateOfBirth", e.target.value)}
              required
              aria-required="true"
              aria-describedby={fieldErrors.dateOfBirth?.length ? "dateOfBirth-error" : undefined}
              className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            />
            {fieldErrors.dateOfBirth?.map((e, i) => (
              <p key={i} id={i === 0 ? "dateOfBirth-error" : undefined} className="text-red-600 text-xs mt-1" role="alert">{e}</p>
            ))}
          </div>

          {/* Address */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-gray-700">
              US Address <span aria-hidden="true">*</span>
            </legend>
            <div>
              <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input
                id="street"
                type="text"
                value={form.usAddress.street}
                onChange={(e) => updateAddress("street", e.target.value)}
                placeholder="Street Address"
                required
                aria-required="true"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
              />
            </div>
            <div>
              <label htmlFor="street2" className="block text-sm font-medium text-gray-700 mb-1">Apt, Suite, Unit (optional)</label>
              <input
                id="street2"
                type="text"
                value={form.usAddress.street2}
                onChange={(e) => updateAddress("street2", e.target.value)}
                placeholder="Apt, Suite, Unit"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  id="city"
                  type="text"
                  value={form.usAddress.city}
                  onChange={(e) => updateAddress("city", e.target.value)}
                  placeholder="City"
                  required
                  aria-required="true"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  id="state"
                  value={form.usAddress.state}
                  onChange={(e) => updateAddress("state", e.target.value)}
                  required
                  aria-required="true"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                <input
                  id="zip"
                  type="text"
                  value={form.usAddress.zip}
                  onChange={(e) => updateAddress("zip", e.target.value)}
                  placeholder="ZIP Code"
                  maxLength={10}
                  required
                  aria-required="true"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
              </div>
            </div>
          </fieldset>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-6 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Continue to Accounts"}
          </button>
        </form>
      </div>
    </WizardLayout>
  );
}
