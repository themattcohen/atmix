"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminTable } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/admin/Pagination";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";
import { Badge } from "@/components/ui/Badge";

interface UserRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  _count: { filingYears: number };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "createdAt_desc";

  const [users, setUsers] = useState<UserRow[]>([]);
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

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) {
        params.set(k, v);
      } else {
        params.delete(k);
      }
    }
    router.replace(`/admin/users?${params.toString()}`);
  }

  // Debounce search input → URL
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

  // Fetch users when URL params change
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        sort,
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      const body = await res.json();
      setUsers(body.data);
      setPagination(body.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search, sort]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  const columns = [
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (u: UserRow) => (
        <span className="font-medium text-navy-900">{u.email}</span>
      ),
    },
    {
      key: "firstName",
      label: "Name",
      sortable: true,
      render: (u: UserRow) =>
        [u.firstName, u.lastName].filter(Boolean).join(" ") || "\u2014",
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      render: (u: UserRow) =>
        new Date(u.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
    {
      key: "emailVerified",
      label: "Verified",
      render: (u: UserRow) =>
        u.emailVerified ? (
          <span className="text-green-600" title="Verified">&#10003;</span>
        ) : (
          <span className="text-gray-400" title="Not verified">&#10007;</span>
        ),
    },
    {
      key: "mfaEnabled",
      label: "MFA",
      render: (u: UserRow) =>
        u.mfaEnabled ? (
          <span className="text-green-600" title="MFA enabled">&#10003;</span>
        ) : (
          <span className="text-gray-400" title="MFA disabled">&#10007;</span>
        ),
    },
    {
      key: "filings",
      label: "Filings",
      render: (u: UserRow) => (
        <Badge variant="default">{u._count.filingYears}</Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (u: UserRow) => (
        <button
          className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTarget(u);
          }}
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Users</h1>
        <span className="text-sm text-gray-500">
          {pagination.total} total user{pagination.total !== 1 ? "s" : ""}
        </span>
      </div>

      <div>
        <input
          type="text"
          placeholder="Search by email, first name, or last name..."
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
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
          <AdminTable<UserRow>
            columns={columns}
            data={users}
            sort={sort}
            onSort={(s) => updateParams({ sort: s, page: "1" })}
            onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
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

      {deleteTarget && (
        <ConfirmDeleteDialog
          open={!!deleteTarget}
          userEmail={deleteTarget.email}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
