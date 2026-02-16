"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { FilingDisplay } from "@/types";

export default function DashboardPage() {
  const [filings, setFilings] = useState<FilingDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadFilings() {
      try {
        const res = await fetch("/api/filing");
        const data = await res.json();
        if (data.data) {
          setFilings(data.data);
        }
      } catch {
        setError("Failed to load filings");
      } finally {
        setLoading(false);
      }
    }
    loadFilings();
  }, []);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      NOT_STARTED: { label: "Not Started", className: "bg-gray-100 text-gray-800" },
      IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
      REVIEWED: { label: "Ready to Sign", className: "bg-purple-100 text-purple-800" },
      SIGNED: { label: "Signed", className: "bg-indigo-100 text-indigo-800" },
      PAID: { label: "Processing", className: "bg-yellow-100 text-yellow-800" },
      SUBMITTING: { label: "Submitting", className: "bg-yellow-100 text-yellow-800" },
      SUBMITTED: { label: "Submitted", className: "bg-orange-100 text-orange-800" },
      ACCEPTED: { label: "Filed", className: "bg-green-100 text-green-800" },
      REJECTED: { label: "Needs Attention", className: "bg-red-100 text-red-800" },
    };

    const badge = badges[status] || { label: status, className: "bg-gray-100 text-gray-800" };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const getActionButton = (filing: FilingDisplay) => {
    const actions: Record<string, { label: string; path: string; className: string }> = {
      NOT_STARTED: {
        label: "Continue Filing",
        path: "/threshold",
        className: "bg-navy-900 text-white hover:bg-navy-800",
      },
      IN_PROGRESS: {
        label: "Resume Filing",
        path: filing.accountCount > 0 ? "/review" : "/personal",
        className: "bg-navy-900 text-white hover:bg-navy-800",
      },
      REVIEWED: {
        label: "Review & Sign",
        path: "/sign",
        className: "bg-navy-900 text-white hover:bg-navy-800",
      },
      SIGNED: {
        label: "Complete Payment",
        path: "/payment",
        className: "bg-gold-500 text-navy-900 hover:bg-gold-600",
      },
      PAID: {
        label: "View Confirmation",
        path: "/confirmation",
        className: "bg-blue-600 text-white hover:bg-blue-700",
      },
      SUBMITTING: {
        label: "View Status",
        path: "/confirmation",
        className: "bg-blue-600 text-white hover:bg-blue-700",
      },
      SUBMITTED: {
        label: "View Status",
        path: "/confirmation",
        className: "bg-blue-600 text-white hover:bg-blue-700",
      },
      ACCEPTED: {
        label: "View Confirmation",
        path: "/confirmation",
        className: "bg-green-600 text-white hover:bg-green-700",
      },
      REJECTED: {
        label: "Action Required",
        path: "/confirmation",
        className: "bg-red-600 text-white hover:bg-red-700",
      },
    };

    const action = actions[filing.status] || {
      label: "View Details",
      path: "/confirmation",
      className: "bg-gray-600 text-white hover:bg-gray-700",
    };

    return (
      <Link
        href={action.path}
        className={`inline-block px-4 py-2 rounded-md font-medium text-sm ${action.className}`}
      >
        {action.label}
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-md">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-navy-900">My FBAR Filings</h1>
        <Link
          href="/threshold"
          className="bg-navy-900 text-white px-6 py-3 rounded-md hover:bg-navy-800 font-bold"
        >
          Start New Filing
        </Link>
      </div>

      {filings.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <div className="max-w-md mx-auto">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Filings Yet</h2>
            <p className="text-gray-600 mb-6">
              You haven&apos;t started any FBAR filings yet. Get started by filing for your foreign accounts.
            </p>
            <Link
              href="/threshold"
              className="inline-block bg-navy-900 text-white px-6 py-3 rounded-md hover:bg-navy-800 font-bold"
            >
              Start Your First Filing
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filings.map((filing) => (
            <div key={filing.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-navy-900 mb-1">
                    Tax Year {filing.calendarYear}
                  </h2>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span>{filing.accountCount} account{filing.accountCount !== 1 ? "s" : ""}</span>
                    <span className="text-gray-300">•</span>
                    <span className="capitalize">{filing.filingType.toLowerCase()}</span>
                  </div>
                </div>
                {getStatusBadge(filing.status)}
              </div>

              {filing.bsaId && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
                  <p className="text-xs text-green-700 mb-1">BSA Tracking ID</p>
                  <p className="font-mono font-bold text-green-900">{filing.bsaId}</p>
                </div>
              )}

              {filing.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-xs text-red-700 mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-900">{filing.rejectionReason}</p>
                </div>
              )}

              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {filing.submittedAt && (
                    <span>Submitted on {new Date(filing.submittedAt).toLocaleDateString()}</span>
                  )}
                  {filing.signedAt && !filing.submittedAt && (
                    <span>Signed on {new Date(filing.signedAt).toLocaleDateString()}</span>
                  )}
                </div>
                {getActionButton(filing)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
