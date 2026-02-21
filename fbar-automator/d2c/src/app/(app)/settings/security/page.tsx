"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

type MfaStatus = "loading" | "disabled" | "setup" | "enabled";

export default function SecuritySettingsPage() {
  const [status, setStatus] = useState<MfaStatus>("loading");
  const [qrCode, setQrCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [totpToken, setTotpToken] = useState("");
  const [disableToken, setDisableToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchMfaStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/user", {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.data.mfaEnabled ? "enabled" : "disabled");
      }
    } catch {
      setError("Failed to load MFA status");
    }
  }, []);

  useEffect(() => {
    fetchMfaStatus();
  }, [fetchMfaStatus]);

  const handleSetup = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      const data = await res.json();
      if (res.ok) {
        setQrCode(data.qrCode);
        setRecoveryCodes(data.recoveryCodes);
        setStatus("setup");
      } else {
        setError(data.error || "Failed to start MFA setup");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ token: totpToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("enabled");
        setQrCode("");
        setTotpToken("");
      } else {
        setError(data.error || "Invalid code");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ token: disableToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("disabled");
        setDisableToken("");
      } else {
        setError(data.error || "Invalid code");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-navy-900 mb-6">Security Settings</h1>

      {error && (
        <div role="alert" className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-2">Two-Factor Authentication</h2>

        {status === "disabled" && (
          <div>
            <p className="text-gray-600 mb-4">
              Add an extra layer of security to your account by requiring a verification code from your authenticator app when you sign in.
            </p>
            <button
              onClick={handleSetup}
              disabled={loading}
              className="py-2 px-4 bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-50 font-medium"
            >
              {loading ? "Setting up..." : "Enable Two-Factor Authentication"}
            </button>
          </div>
        )}

        {status === "setup" && (
          <div>
            <p className="text-gray-600 mb-4">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code below.
            </p>

            {qrCode && (
              <div className="flex justify-center mb-6">
                <Image src={qrCode} alt="MFA QR Code" width={200} height={200} unoptimized />
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4 mb-6">
              <div>
                <label htmlFor="totpToken" className="block text-sm font-medium text-gray-700 mb-1">
                  Verification Code
                </label>
                <input
                  id="totpToken"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900 text-center text-xl tracking-widest font-mono"
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                disabled={loading || totpToken.length !== 6}
                className="py-2 px-4 bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-50 font-medium"
              >
                {loading ? "Verifying..." : "Verify & Enable"}
              </button>
            </form>

            {recoveryCodes.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h3 className="text-sm font-semibold text-yellow-800 mb-2">Recovery Codes</h3>
                <p className="text-sm text-yellow-700 mb-3">
                  Save these codes in a safe place. You can use them to access your account if you lose your authenticator device.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {recoveryCodes.map((code, i) => (
                    <code key={i} className="text-sm bg-white px-2 py-1 rounded border border-yellow-200 font-mono">
                      {code}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {status === "enabled" && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Enabled
              </span>
              <p className="text-gray-600">Two-factor authentication is active on your account.</p>
            </div>

            <form onSubmit={handleDisable} className="space-y-4">
              <p className="text-sm text-gray-500">
                To disable two-factor authentication, enter your current authenticator code.
              </p>
              <div className="flex gap-3 items-end">
                <div>
                  <label htmlFor="disableToken" className="block text-sm font-medium text-gray-700 mb-1">
                    Authenticator Code
                  </label>
                  <input
                    id="disableToken"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={disableToken}
                    onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, ""))}
                    required
                    className="w-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-900 text-center tracking-widest font-mono"
                    placeholder="000000"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || disableToken.length !== 6}
                  className="py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  {loading ? "Disabling..." : "Disable MFA"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
