"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";

interface Filing {
  id: string;
  calendarYear: number;
  status: string;
  filingType: string;
  tier: string;
  createdAt: string;
  updatedAt: string;
  signedAt: string | null;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  bsaId: string | null;
  rejectionReason: string | null;
  accountCount: number;
  payments: {
    id: string;
    amount: string;
    status: string;
    stripeSessionId: string | null;
    stripePaymentIntentId: string | null;
    createdAt: string;
  }[];
}

interface UserDetail {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  suffix: string | null;
  tinLast4: string | null;
  tinDecryptionFailed: boolean;
  tinType: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  usAddress: { street?: string; street2?: string; city?: string; state?: string; zip?: string } | null;
  createdAt: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  mfaEnabled: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  role: string;
  filingYears: Filing[];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTin, setShowTin] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Error ${res.status}`);
        }
        setUser(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [userId]);

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      router.push("/admin/users");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <svg
          className="animate-spin h-8 w-8 text-navy-900"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <button
          className="text-sm text-navy-900 hover:underline"
          onClick={() => router.push("/admin/users")}
        >
          &larr; Back to Users
        </button>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
          {error || "User not found"}
        </div>
      </div>
    );
  }

  const fullName = [user.firstName, user.middleName, user.lastName, user.suffix]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-6">
      <button
        className="text-sm text-navy-900 hover:underline"
        onClick={() => router.push("/admin/users")}
      >
        &larr; Back to Users
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">
          {fullName || user.email}
        </h1>
        <Badge variant={user.role === "ADMIN" ? "info" : "default"}>
          {user.role}
        </Badge>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{fullName || "\u2014"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium text-gray-900">{user.phone || "\u2014"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Created</dt>
              <dd className="font-medium text-gray-900">{formatDateTime(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email Verified</dt>
              <dd>
                {user.emailVerified ? (
                  <Badge variant="success">Verified</Badge>
                ) : (
                  <Badge variant="warning">Not Verified</Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">MFA</dt>
              <dd>
                {user.mfaEnabled ? (
                  <Badge variant="success">Enabled</Badge>
                ) : (
                  <Badge variant="default">Disabled</Badge>
                )}
              </dd>
            </div>
            {user.utmSource && (
              <div>
                <dt className="text-gray-500">UTM Source</dt>
                <dd className="font-medium text-gray-900">
                  {[user.utmSource, user.utmMedium, user.utmCampaign]
                    .filter(Boolean)
                    .join(" / ")}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Identity Card */}
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500">TIN</dt>
              <dd className="font-medium text-gray-900 flex items-center gap-2">
                {user.tinDecryptionFailed ? (
                  <Badge variant="error">Decryption Failed</Badge>
                ) : user.tinLast4 ? (
                  <>
                    <span className="font-mono">
                      {showTin ? `***-**-${user.tinLast4}` : "***-**-****"}
                    </span>
                    <button
                      className="text-xs text-navy-900 hover:underline"
                      onClick={() => setShowTin(!showTin)}
                    >
                      {showTin ? "Hide" : "Show last 4"}
                    </button>
                  </>
                ) : (
                  "\u2014"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">TIN Type</dt>
              <dd className="font-medium text-gray-900">{user.tinType || "\u2014"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Date of Birth</dt>
              <dd className="font-medium text-gray-900">{formatDate(user.dateOfBirth)}</dd>
            </div>
            {user.usAddress && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Address</dt>
                <dd className="font-medium text-gray-900">
                  {[
                    user.usAddress.street,
                    user.usAddress.street2,
                    user.usAddress.city,
                    user.usAddress.state,
                    user.usAddress.zip,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Filings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filings ({user.filingYears.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {user.filingYears.length === 0 ? (
            <p className="text-sm text-gray-500">No filings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-navy-50">
                    <th className="px-3 py-2 text-left text-xs font-medium text-navy-900 uppercase">Year</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-navy-900 uppercase">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-navy-900 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-navy-900 uppercase">Tier</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-navy-900 uppercase">Accounts</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-navy-900 uppercase">BSA ID</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-navy-900 uppercase">Updated</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-navy-900 uppercase">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {user.filingYears.map((fy) => (
                    <tr
                      key={fy.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/admin/filings/${fy.id}`)}
                    >
                      <td className="px-3 py-2 font-medium">{fy.calendarYear}</td>
                      <td className="px-3 py-2">{fy.filingType}</td>
                      <td className="px-3 py-2"><StatusBadge status={fy.status} /></td>
                      <td className="px-3 py-2">{fy.tier}</td>
                      <td className="px-3 py-2">{fy.accountCount}</td>
                      <td className="px-3 py-2 font-mono text-xs">{fy.bsaId || "\u2014"}</td>
                      <td className="px-3 py-2">{formatDate(fy.updatedAt)}</td>
                      <td className="px-3 py-2">
                        {fy.payments.length > 0 ? (
                          fy.payments.map((p) => (
                            <div key={p.id} className="flex items-center gap-1">
                              <span>${Number(p.amount).toFixed(2)}</span>
                              <Badge
                                variant={
                                  p.status === "COMPLETED"
                                    ? "success"
                                    : p.status === "FAILED"
                                    ? "error"
                                    : p.status === "REFUNDED"
                                    ? "warning"
                                    : "default"
                                }
                              >
                                {p.status}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-400">\u2014</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Deleting this user will permanently remove all their data, including
            filings, foreign accounts, payments, and uploaded statements. This
            action cannot be undone.
          </p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete User
          </Button>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteOpen}
        userEmail={user.email}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        loading={deleteLoading}
      />
    </div>
  );
}
