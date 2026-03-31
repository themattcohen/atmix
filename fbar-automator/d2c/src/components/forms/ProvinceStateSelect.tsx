"use client";

import { CA_PROVINCES, MX_STATES } from "@/lib/validation";

interface ProvinceStateSelectProps {
  countryCode: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  error?: string;
}

export function ProvinceStateSelect({ countryCode, value, onChange, id, error }: ProvinceStateSelectProps) {
  if (countryCode !== "CA" && countryCode !== "MX") return null;

  const options = countryCode === "CA" ? CA_PROVINCES : MX_STATES;
  const label = countryCode === "CA" ? "Province" : "State";

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span aria-hidden="true">*</span>
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        aria-required="true"
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>{opt.name}</option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-red-600 text-xs mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
