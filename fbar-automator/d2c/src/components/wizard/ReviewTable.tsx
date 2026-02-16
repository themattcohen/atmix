"use client";

import type { AccountDisplay } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface ReviewTableProps {
  accounts: AccountDisplay[];
  onDelete?: (id: string) => void;
}

export function ReviewTable({ accounts, onDelete }: ReviewTableProps) {
  const totalUsd = accounts.reduce((sum, a) => sum + (a.maxValueUsd || a.maxValueLocal), 0);

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500" role="status">
        No accounts added yet.
      </div>
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto print:block">
        <table className="w-full text-sm" aria-label="Foreign account details for FBAR filing">
          <caption className="sr-only">
            Summary of {accounts.length} foreign {accounts.length === 1 ? "account" : "accounts"} included in your FBAR filing,
            with institution names, countries, account types, and values.
          </caption>
          <thead>
            <tr className="border-b border-gray-200">
              <th scope="col" className="text-left py-3 px-2 font-medium text-gray-700">Institution</th>
              <th scope="col" className="text-left py-3 px-2 font-medium text-gray-700">Country</th>
              <th scope="col" className="text-left py-3 px-2 font-medium text-gray-700">Type</th>
              <th scope="col" className="text-left py-3 px-2 font-medium text-gray-700">Account</th>
              <th scope="col" className="text-right py-3 px-2 font-medium text-gray-700">Max Value</th>
              <th scope="col" className="text-right py-3 px-2 font-medium text-gray-700">USD Value</th>
              {onDelete && <th scope="col" className="py-3 px-2 w-16"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-b border-gray-100">
                <td className="py-3 px-2 font-medium text-navy-900">{account.institutionName}</td>
                <td className="py-3 px-2 text-gray-600">{account.countryCode}</td>
                <td className="py-3 px-2 text-gray-600">{account.accountType}</td>
                <td className="py-3 px-2 text-gray-600">
                  <span aria-label={`Account ending in ${account.accountNumberLast4}`}>
                    ****{account.accountNumberLast4}
                  </span>
                </td>
                <td className="py-3 px-2 text-right text-gray-600">
                  {account.currencyCode} {account.maxValueLocal.toLocaleString()}
                </td>
                <td className="py-3 px-2 text-right font-medium text-navy-900">
                  {account.maxValueUsd ? formatCurrency(account.maxValueUsd) : "\u2014"}
                </td>
                {onDelete && (
                  <td className="py-3 px-2">
                    <button
                      onClick={() => onDelete(account.id)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                      aria-label={`Remove ${account.institutionName} account ending in ${account.accountNumberLast4}`}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-navy-900">
              <td colSpan={5} className="py-3 px-2 font-bold text-navy-900">
                Total ({accounts.length} account{accounts.length !== 1 ? "s" : ""})
              </td>
              <td className="py-3 px-2 text-right font-bold text-navy-900 text-lg">
                {formatCurrency(totalUsd)}
              </td>
              {onDelete && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3 print:hidden" role="list" aria-label="Foreign accounts">
        {accounts.map((account) => (
          <div key={account.id} className="bg-gray-50 rounded-lg p-4" role="listitem">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-navy-900">{account.institutionName}</p>
                <p className="text-sm text-gray-500">
                  {account.countryCode} &middot;{" "}
                  <span aria-label={`Account ending in ${account.accountNumberLast4}`}>
                    ****{account.accountNumberLast4}
                  </span>
                </p>
              </div>
              {onDelete && (
                <button
                  onClick={() => onDelete(account.id)}
                  className="text-red-600 text-xs font-medium"
                  aria-label={`Remove ${account.institutionName} account ending in ${account.accountNumberLast4}`}
                >
                  Remove
                </button>
              )}
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-gray-600">{account.currencyCode} {account.maxValueLocal.toLocaleString()}</span>
              <span className="font-medium text-navy-900">
                {account.maxValueUsd ? formatCurrency(account.maxValueUsd) : "\u2014"}
              </span>
            </div>
          </div>
        ))}
        <div className="bg-navy-900 text-white rounded-lg p-4 flex justify-between items-center" aria-label="Total value">
          <span className="font-bold">Total ({accounts.length} account{accounts.length !== 1 ? "s" : ""})</span>
          <span className="text-lg font-bold">{formatCurrency(totalUsd)}</span>
        </div>
      </div>
    </div>
  );
}
