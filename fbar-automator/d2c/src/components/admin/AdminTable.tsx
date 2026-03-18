"use client";

import React from "react";

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  sort?: string;
  onSort?: (sort: string) => void;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

function SortArrow({ field, currentSort }: { field: string; currentSort?: string }) {
  if (!currentSort) return null;
  const lastUnderscore = currentSort.lastIndexOf("_");
  const sortField = lastUnderscore > 0 ? currentSort.slice(0, lastUnderscore) : "";
  const sortDir = lastUnderscore > 0 ? currentSort.slice(lastUnderscore + 1) : "";
  if (sortField !== field) return <span className="ml-1 text-gray-300">&#8597;</span>;
  return <span className="ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
}

export function AdminTable<T extends object>({
  columns,
  data,
  sort,
  onSort,
  onRowClick,
  emptyMessage = "No results found",
}: AdminTableProps<T>) {
  function handleSort(col: Column<T>) {
    if (!col.sortable || !onSort) return;
    const lastUnderscore = (sort || "").lastIndexOf("_");
    const currentField = lastUnderscore > 0 ? (sort || "").slice(0, lastUnderscore) : "";
    const currentDir = lastUnderscore > 0 ? (sort || "").slice(lastUnderscore + 1) : "";
    if (currentField === col.key && currentDir === "asc") {
      onSort(`${col.key}_desc`);
    } else {
      onSort(`${col.key}_asc`);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border border-gray-200">
        <thead>
          <tr className="bg-navy-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-medium text-navy-900 uppercase tracking-wider ${
                  col.sortable && onSort ? "cursor-pointer select-none hover:bg-navy-100" : ""
                }`}
                onClick={() => handleSort(col)}
              >
                {col.label}
                {col.sortable && <SortArrow field={col.key} currentSort={sort} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, idx) => (
              <tr
                key={((item as Record<string, unknown>).id as string) || idx}
                className={`border-b border-gray-100 ${
                  onRowClick ? "hover:bg-gray-50 cursor-pointer" : ""
                }`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-gray-700">
                    {col.render ? col.render(item) : ((item as Record<string, unknown>)[col.key] as React.ReactNode) ?? ""}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
