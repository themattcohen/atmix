"use client";

import { useState, useEffect } from "react";
import type { AccountProvenance as ProvenanceData } from "@/types";

function confidenceDot(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high": return "bg-green-500";
    case "medium": return "bg-amber-500";
    case "low": return "bg-red-500";
  }
}

function confidenceBadge(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high": return "bg-green-100 text-green-800";
    case "medium": return "bg-amber-100 text-amber-800";
    case "low": return "bg-red-100 text-red-800";
  }
}

export function AccountProvenance({ accountId }: { accountId: string }) {
  const [data, setData] = useState<ProvenanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/accounts/${accountId}/provenance`);
        if (!res.ok) {
          setError("Failed to load provenance");
          return;
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Failed to load provenance");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [accountId]);

  if (loading) {
    return (
      <div className="py-3 text-sm text-gray-400 flex items-center gap-2">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading extraction details...
      </div>
    );
  }

  if (error) {
    return <p className="py-3 text-sm text-red-600">{error}</p>;
  }

  if (!data || !data.hasProvenance) {
    return <p className="py-3 text-sm text-gray-400">This account was entered manually.</p>;
  }

  return (
    <div className="pt-3 space-y-3 text-sm">
      {/* Max Value Explanation */}
      {data.maxExplanation && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-start gap-2">
          <svg className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <span className="text-green-800">{data.maxExplanation}</span>
            {data.confidence?.overall && (
              <span className={`ml-2 inline-block text-xs font-medium px-1.5 py-0.5 rounded ${confidenceBadge(data.confidence.overall)}`}>
                {data.confidence.overall} confidence
              </span>
            )}
          </div>
        </div>
      )}

      {/* Source Statement */}
      {data.source && (
        <div className="flex items-center gap-3 text-gray-600">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div>
            <span className="text-gray-700 font-medium">{data.source.fileName}</span>
            {data.source.periodStart && data.source.periodEnd && (
              <span className="text-gray-500 ml-1">
                ({data.source.periodStart} – {data.source.periodEnd})
              </span>
            )}
          </div>
          {data.source.viewUrl && (
            <a
              href={data.source.viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-navy-900 hover:underline text-xs ml-auto"
            >
              View Statement →
            </a>
          )}
        </div>
      )}

      {/* Balance History */}
      {data.balances.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700 select-none">
            Balance History ({data.balances.length} entries)
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-1 pr-4 font-medium">Date</th>
                  <th className="pb-1 pr-4 font-medium">Amount</th>
                  <th className="pb-1 pr-4 font-medium">Label</th>
                  <th className="pb-1 font-medium">Max?</th>
                </tr>
              </thead>
              <tbody>
                {data.balances.map((b, i) => (
                  <tr key={i} className={b.isMaximum ? "bg-green-50" : ""}>
                    <td className="py-1 pr-4 text-gray-600">{b.date || "—"}</td>
                    <td className="py-1 pr-4 text-gray-900 font-mono">{b.amount.toLocaleString()}</td>
                    <td className="py-1 pr-4 text-gray-600">{b.label}</td>
                    <td className="py-1">
                      {b.isMaximum && (
                        <span className="text-green-600 font-medium">✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Per-field Confidence (only show non-high fields) */}
      {data.confidence && (
        (() => {
          const fields = [
            { key: "bank_name", label: "Bank Name", level: data.confidence!.bank_name },
            { key: "account_number", label: "Account #", level: data.confidence!.account_number },
            { key: "currency", label: "Currency", level: data.confidence!.currency },
            { key: "max_balance", label: "Max Balance", level: data.confidence!.max_balance },
          ].filter(f => f.level !== "high");

          if (fields.length === 0) return null;

          return (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>Field confidence:</span>
              {fields.map(f => (
                <span key={f.key} className="flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${confidenceDot(f.level)}`} />
                  {f.label} ({f.level})
                </span>
              ))}
            </div>
          );
        })()
      )}

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
          <ul className="text-xs text-blue-800 space-y-0.5">
            {data.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
