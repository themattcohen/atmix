"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/admin/StatusBadge";

const FILING_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "REVIEWED",
  "SIGNED",
  "PAID",
  "SUBMITTING",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
] as const;

const STATUS_OPTIONS = FILING_STATUSES.map((s) => ({
  value: s,
  label: s.replace(/_/g, " "),
}));

interface FilingDetail {
  filing: {
    id: string;
    calendarYear: number;
    status: string;
    filingType: string;
    tier: string;
    has25PlusAccounts: boolean;
    signedAt: string | null;
    signatureIp: string | null;
    submittedAt: string | null;
    acknowledgedAt: string | null;
    bsaId: string | null;
    rejectionReason: string | null;
    sdtmSubmissionId: string | null;
    sdtmBatchId: string | null;
    stripeSessionId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  accounts: Array<{
    id: string;
    institutionName: string;
    countryCode: string;
    accountType: string;
    ownershipType: string;
    maxValueUsd: number | null;
    currencyCode: string;
    accountNumberLast4: string | null;
    decryptionFailed: boolean;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    stripeSessionId: string | null;
    stripePaymentIntentId: string | null;
    createdAt: string;
  }>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUsd(amount: number | null): string {
  if (amount === null || amount === undefined) return "\u2014";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface TimelineStep {
  label: string;
  date: string | null;
  detail?: string | null;
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="relative pl-6">
      {steps.map((step, i) => {
        const completed = !!step.date;
        const isLast = i === steps.length - 1;
        return (
          <div key={step.label} className="relative pb-6">
            {/* Vertical line */}
            {!isLast && (
              <div
                className={`absolute left-[-18px] top-3 w-0.5 h-full ${
                  completed ? "bg-green-300" : "bg-gray-200"
                }`}
              />
            )}
            {/* Dot */}
            <div
              className={`absolute left-[-22px] top-1 w-3 h-3 rounded-full border-2 ${
                completed
                  ? "bg-green-500 border-green-500"
                  : "bg-white border-gray-300"
              }`}
            />
            <div>
              <p className={`text-sm font-medium ${completed ? "text-navy-900" : "text-gray-400"}`}>
                {step.label}
              </p>
              {step.date && (
                <p className="text-xs text-gray-500">{formatDate(step.date)}</p>
              )}
              {step.detail && (
                <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminFilingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<FilingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status override
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/filings/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      const body = await res.json();
      setData(body.data);
      setOverrideStatus(body.data.filing.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load filing");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  async function handleStatusOverride() {
    if (!overrideStatus || !data) return;
    setOverrideLoading(true);
    setOverrideMessage(null);
    try {
      const res = await fetch(`/api/admin/filings/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ status: overrideStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      setOverrideMessage({ type: "success", text: `Status updated to ${overrideStatus}` });
      fetchDetail();
    } catch (err) {
      setOverrideMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update status",
      });
    } finally {
      setOverrideLoading(false);
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

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          className="text-sm text-navy-900 hover:underline"
          onClick={() => router.push("/admin/filings")}
        >
          &larr; Back to Filings
        </button>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
          {error || "Filing not found"}
        </div>
      </div>
    );
  }

  const { filing, user, accounts, payments } = data;

  // Build timeline steps
  const paidPayment = payments.find((p) => p.status === "COMPLETED");
  const timelineSteps: TimelineStep[] = [
    { label: "Created", date: filing.createdAt },
    {
      label: "Signed",
      date: filing.signedAt,
      detail: filing.signatureIp ? `IP: ${filing.signatureIp}` : null,
    },
    {
      label: "Paid",
      date: paidPayment?.createdAt || null,
    },
    { label: "Submitted", date: filing.submittedAt },
    {
      label: "Acknowledged",
      date: filing.acknowledgedAt,
      detail: filing.status === "ACCEPTED" && filing.bsaId
        ? `BSA ID: ${filing.bsaId}`
        : filing.status === "REJECTED" && filing.rejectionReason
          ? `Reason: ${filing.rejectionReason}`
          : null,
    },
  ];

  const hasSdtmData = filing.sdtmSubmissionId || filing.sdtmBatchId || filing.bsaId || filing.rejectionReason;

  return (
    <div className="space-y-6">
      <button
        className="text-sm text-navy-900 hover:underline"
        onClick={() => router.push("/admin/filings")}
      >
        &larr; Back to Filings
      </button>

      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filing Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-gray-500 uppercase">Calendar Year</p>
              <p className="text-lg font-semibold text-navy-900">{filing.calendarYear}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Filing Type</p>
              <Badge variant={filing.filingType === "AMENDED" ? "warning" : "default"}>
                {filing.filingType}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Status</p>
              <StatusBadge status={filing.status} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Tier</p>
              <Badge variant={filing.tier === "PREMIUM" ? "info" : "default"}>
                {filing.tier}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">25+ Accounts</p>
              <p className="text-sm">{filing.has25PlusAccounts ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Created</p>
              <p className="text-sm">{formatDate(filing.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Updated</p>
              <p className="text-sm">{formatDate(filing.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Card */}
      <Card>
        <CardHeader>
          <CardTitle>User</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-gray-500 uppercase">Email</p>
              <button
                className="text-sm text-navy-900 hover:underline font-medium"
                onClick={() => router.push(`/admin/users/${user.id}`)}
              >
                {user.email}
              </button>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Name</p>
              <button
                className="text-sm text-navy-900 hover:underline"
                onClick={() => router.push(`/admin/users/${user.id}`)}
              >
                {[user.firstName, user.lastName].filter(Boolean).join(" ") || "\u2014"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Card */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline steps={timelineSteps} />
        </CardContent>
      </Card>

      {/* Accounts Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            Foreign Accounts ({accounts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-gray-500">No accounts for this filing year.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200">
                <thead>
                  <tr className="bg-navy-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-navy-900 uppercase">Institution</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-navy-900 uppercase">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-navy-900 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-navy-900 uppercase">Max Value USD</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-navy-900 uppercase">Last 4</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-700">{a.institutionName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{a.countryCode}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{a.accountType}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatUsd(a.maxValueUsd)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {a.decryptionFailed ? (
                          <Badge variant="error">Decrypt failed</Badge>
                        ) : (
                          a.accountNumberLast4 || "\u2014"
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

      {/* Payment Card */}
      <Card>
        <CardHeader>
          <CardTitle>Payments ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-500">No payments recorded.</p>
          ) : (
            <div className="space-y-4">
              {payments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-4 border-b border-gray-100 pb-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Amount</p>
                    <p className="text-sm font-medium">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: p.currency || "USD",
                      }).format(p.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Status</p>
                    <StatusBadge status={p.status} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Date</p>
                    <p className="text-sm">{formatDate(p.createdAt)}</p>
                  </div>
                  {p.stripePaymentIntentId && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Stripe</p>
                      <a
                        href={`https://dashboard.stripe.com/payments/${p.stripePaymentIntentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-navy-900 hover:underline"
                      >
                        View in Stripe &rarr;
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SDTM Card — only if any SDTM data present */}
      {hasSdtmData && (
        <Card>
          <CardHeader>
            <CardTitle>SDTM / FinCEN</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {filing.sdtmSubmissionId && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Submission ID</p>
                  <p className="text-sm font-mono">{filing.sdtmSubmissionId}</p>
                </div>
              )}
              {filing.sdtmBatchId && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Batch ID</p>
                  <p className="text-sm font-mono">{filing.sdtmBatchId}</p>
                </div>
              )}
              {filing.bsaId && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">BSA ID</p>
                  <p className="text-sm font-mono">{filing.bsaId}</p>
                </div>
              )}
              {filing.rejectionReason && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 uppercase">Rejection Reason</p>
                  <p className="text-sm text-red-600">{filing.rejectionReason}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Override the filing status:</p>
            <div className="flex items-end gap-3">
              <div className="w-56">
                <Select
                  options={STATUS_OPTIONS}
                  value={overrideStatus}
                  onChange={(e) => {
                    setOverrideStatus(e.target.value);
                    setOverrideMessage(null);
                  }}
                />
              </div>
              <Button
                variant="primary"
                size="md"
                loading={overrideLoading}
                onClick={handleStatusOverride}
                disabled={overrideStatus === filing.status}
              >
                Override Status
              </Button>
            </div>
            {overrideStatus === "PAID" && (
              <p className="text-xs text-amber-600">
                Note: This does not trigger FinCEN submission. Run the submit-paid cron to initiate submission.
              </p>
            )}
            {overrideMessage && (
              <div
                className={`text-sm px-3 py-2 rounded ${
                  overrideMessage.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {overrideMessage.text}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
