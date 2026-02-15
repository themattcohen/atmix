"use client";

import { useState, useEffect } from "react";
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

        {error && <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input type="text" value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900" />
              {fieldErrors.firstName?.map((e, i) => <p key={i} className="text-red-600 text-xs mt-1">{e}</p>)}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input type="text" value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900" />
              {fieldErrors.lastName?.map((e, i) => <p key={i} className="text-red-600 text-xs mt-1">{e}</p>)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input type="text" value={form.middleName} onChange={(e) => updateField("middleName", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suffix</label>
              <input type="text" value={form.suffix} onChange={(e) => updateField("suffix", e.target.value)} placeholder="Jr., Sr., III" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900" />
            </div>
          </div>

          {/* TIN */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SSN / ITIN *</label>
              <input type="text" value={form.tin} onChange={(e) => handleTinChange(e.target.value)} placeholder="XXX-XX-XXXX" maxLength={11} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900" />
              {fieldErrors.tin?.map((e, i) => <p key={i} className="text-red-600 text-xs mt-1">{e}</p>)}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TIN Type *</label>
              <select value={form.tinType} onChange={(e) => updateField("tinType", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900">
                <option value="SSN">SSN</option>
                <option value="ITIN">ITIN</option>
              </select>
            </div>
          </div>

          {/* DOB */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
            <input type="date" value={form.dateOfBirth} onChange={(e) => updateField("dateOfBirth", e.target.value)} required className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900" />
            {fieldErrors.dateOfBirth?.map((e, i) => <p key={i} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>

          {/* Address */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-gray-700">US Address *</legend>
            <input type="text" value={form.usAddress.street} onChange={(e) => updateAddress("street", e.target.value)} placeholder="Street Address" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900" />
            <input type="text" value={form.usAddress.street2} onChange={(e) => updateAddress("street2", e.target.value)} placeholder="Apt, Suite, Unit (optional)" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900" />
            <div className="grid grid-cols-3 gap-4">
              <input type="text" value={form.usAddress.city} onChange={(e) => updateAddress("city", e.target.value)} placeholder="City" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900" />
              <select value={form.usAddress.state} onChange={(e) => updateAddress("state", e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900">
                <option value="">State</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.code}</option>
                ))}
              </select>
              <input type="text" value={form.usAddress.zip} onChange={(e) => updateAddress("zip", e.target.value)} placeholder="ZIP Code" maxLength={10} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900" />
            </div>
          </fieldset>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
            <input type="tel" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+1 (555) 123-4567" className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900" />
          </div>

          <button type="submit" disabled={saving} className="w-full py-3 px-6 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-medium disabled:opacity-50">
            {saving ? "Saving..." : "Save & Continue to Accounts"}
          </button>
        </form>
      </div>
    </WizardLayout>
  );
}
