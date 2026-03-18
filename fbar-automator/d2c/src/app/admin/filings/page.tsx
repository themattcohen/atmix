"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminTable } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/admin/Pagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

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

const YEAR_OPTIONS = [
  { value: "", label: "All Years" },
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
];

interface FilingRow {
  id: string;
  calendarYear: number;
  status: string;
  filingType: string;
  tier: string;
  bsaId: string | null;
  updatedAt: string;
  createdAt: string;
  userEmail: string;
  userName: string | null;
  paymentCount: number;
  lastPaymentStatus: string | null;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AdminFilingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = parseInt(searchParams.get("page") || "1", 10);
  const statusFilter = searchParams.get("status") || "";
  const yearFilter = searchParams.get("year") || "";
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "updatedAt_desc";

  const [filings, setFilings] = useState<FilingRow[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived: which statuses are checked
  const checkedStatuses = new Set(statusFilter ? statusFilter.split(",") : []);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) {
        params.set(k, v);
      } else {
        params.delete(k);
      }
    }
    router.replace(`/admin/filings?${params.toString()}`);
  }

  function toggleStatus(status: string) {
    const next = new Set(checkedStatuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    updateParams({ status: Array.from(next).join(","), page: "1" });
  }

  function setQuickFilter(statuses: string[]) {
    updateParams({ status: statuses.join(","), page: "1" });
  }

  function clearFilters() {
    router.replace("/admin/filings");
    setSearchInput("");
  }

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ search: searchInput, page: "1" });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const fetchFilings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        sort,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(yearFilter ? { year: yearFilter } : {}),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/admin/filings?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      const body = await res.json();
      setFilings(body.data);
      setPagination(body.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load filings");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, yearFilter, search, sort]);

  useEffect(() => {
    fetchFilings();
  }, [fetchFilings]);

  const columns = [
    {
      key: "userEmail",
      label: "Email",
      sortable: false,
      render: (f: FilingRow) => (
        <span className="font-medium text-navy-900">{f.userEmail}</span>
      ),
    },
    {
      key: "calendarYear",
      label: "Year",
      sortable: true,
      render: (f: FilingRow) => String(f.calendarYear),
    },
    {
      key: "filingType",
      label: "Type",
      render: (f: FilingRow) => (
        <Badge variant={f.filingType === "AMENDED" ? "warning" : "default"}>
          {f.filingType}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (f: FilingRow) => <StatusBadge status={f.status} />,
    },
    {
      key: "tier",
      label: "Tier",
      render: (f: FilingRow) => (
        <Badge variant={f.tier === "PREMIUM" ? "info" : "default"}>
          {f.tier}
        </Badge>
      ),
    },
    {
      key: "bsaId",
      label: "BSA ID",
      render: (f: FilingRow) => f.bsaId || "\u2014",
    },
    {
      key: "payment",
      label: "Payment",
      render: (f: FilingRow) =>
        f.lastPaymentStatus ? (
          <StatusBadge status={f.lastPaymentStatus} />
        ) : (
          <span className="text-gray-400">\u2014</span>
        ),
    },
    {
      key: "updatedAt",
      label: "Updated",
      sortable: true,
      render: (f: FilingRow) =>
        new Date(f.updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Filings</h1>
        <span className="text-sm text-gray-500">
          {pagination.total} total filing{pagination.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filter bar */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              placeholder="Search by email..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select
              options={YEAR_OPTIONS}
              value={yearFilter}
              onChange={(e) => updateParams({ year: e.target.value, page: "1" })}
            />
          </div>
        </div>

        {/* Status checkboxes */}
        <div className="flex flex-wrap gap-3">
          {FILING_STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={checkedStatuses.has(s)}
                onChange={() => toggleStatus(s)}
                className="rounded border-gray-300 text-navy-900 focus:ring-navy-900"
              />
              {s.replace(/_/g, " ")}
            </label>
          ))}
        </div>

        {/* Quick filter buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickFilter(["SUBMITTING", "SUBMITTED"])}
          >
            Stuck
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickFilter(["REJECTED"])}
          >
            Rejected
          </Button>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <svg
            className="animate-spin h-8 w-8 text-navy-900"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      ) : (
        <>
          <AdminTable<FilingRow>
            columns={columns}
            data={filings}
            sort={sort}
            onSort={(s) => updateParams({ sort: s, page: "1" })}
            onRowClick={(f) => router.push(`/admin/filings/${f.id}`)}
            emptyMessage="No filings match the current filters"
          />
          {pagination.pages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.pages}
              onPageChange={(p) => updateParams({ page: String(p) })}
            />
          )}
        </>
      )}
    </div>
  );
}
