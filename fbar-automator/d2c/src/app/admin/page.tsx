"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface OverviewData {
  totalUsers: number;
  filingsByStatus: { status: string; count: number }[];
  revenue: { totalCompletedCount: number; totalUsd: string };
  stuckCount: number;
  recentFilings: {
    id: string;
    userEmail: string;
    calendarYear: number;
    status: string;
    updatedAt: string;
  }[];
}

const TERMINAL_STATUSES = ["ACCEPTED", "REJECTED"];

function statusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case "ACCEPTED":
      return { bg: "bg-green-100", text: "text-green-800" };
    case "REJECTED":
      return { bg: "bg-red-100", text: "text-red-800" };
    case "SUBMITTED":
    case "SUBMITTING":
      return { bg: "bg-blue-100", text: "text-blue-800" };
    case "PAID":
    case "SIGNED":
      return { bg: "bg-amber-100", text: "text-amber-800" };
    case "IN_PROGRESS":
    case "REVIEWED":
      return { bg: "bg-gray-100", text: "text-gray-800" };
    case "NOT_STARTED":
      return { bg: "bg-gray-50", text: "text-gray-500" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-800" };
  }
}

function formatUsd(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 font-medium">Failed to load overview</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const activeFilings = data.filingsByStatus
    .filter((f) => !TERMINAL_STATUSES.includes(f.status))
    .reduce((sum, f) => sum + f.count, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900 mb-6">Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-navy-900">{data.totalUsers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Active Filings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-navy-900">{activeFilings}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-navy-900">{formatUsd(data.revenue.totalUsd)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {data.revenue.totalCompletedCount} completed payment{data.revenue.totalCompletedCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className={data.stuckCount > 0 ? "ring-2 ring-red-300" : ""}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Attention Needed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${data.stuckCount > 0 ? "text-red-600" : "text-navy-900"}`}>
              {data.stuckCount}
            </p>
            {data.stuckCount > 0 && (
              <p className="text-xs text-red-500 mt-1">Stuck filings need review</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentFilings.length === 0 ? (
            <p className="text-sm text-gray-500">No filings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Email</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Year</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 font-medium text-gray-500">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentFilings.map((filing) => {
                    const color = statusColor(filing.status);
                    return (
                      <tr key={filing.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/admin/filings/${filing.id}`}
                            className="text-navy-700 hover:underline"
                          >
                            {filing.userEmail}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-gray-700">{filing.calendarYear}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color.bg} ${color.text}`}
                          >
                            {filing.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-2 text-gray-500">{formatDate(filing.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
