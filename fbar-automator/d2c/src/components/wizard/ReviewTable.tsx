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
      <div className="text-center py-8 text-gray-500">
        No accounts added yet.
      </div>
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 font-medium text-gray-700">Institution</th>
              <th className="text-left py-3 px-2 font-medium text-gray-700">Country</th>
              <th className="text-left py-3 px-2 font-medium text-gray-700">Type</th>
              <th className="text-left py-3 px-2 font-medium text-gray-700">Account</th>
              <th className="text-right py-3 px-2 font-medium text-gray-700">Max Value</th>
              <th className="text-right py-3 px-2 font-medium text-gray-700">USD Value</th>
              {onDelete && <th className="py-3 px-2 w-16" />}
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-b border-gray-100">
                <td className="py-3 px-2 font-medium text-navy-900">{account.institutionName}</td>
                <td className="py-3 px-2 text-gray-600">{account.countryCode}</td>
                <td className="py-3 px-2 text-gray-600">{account.accountType}</td>
                <td className="py-3 px-2 text-gray-600">****{account.accountNumberLast4}</td>
                <td className="py-3 px-2 text-right text-gray-600">
                  {account.currencyCode} {account.maxValueLocal.toLocaleString()}
                </td>
                <td className="py-3 px-2 text-right font-medium text-navy-900">
                  {account.maxValueUsd ? formatCurrency(account.maxValueUsd) : "—"}
                </td>
                {onDelete && (
                  <td className="py-3 px-2">
                    <button onClick={() => onDelete(account.id)} className="text-red-600 hover:text-red-800 text-xs">
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
      <div className="md:hidden space-y-3">
        {accounts.map((account) => (
          <div key={account.id} className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-navy-900">{account.institutionName}</p>
                <p className="text-sm text-gray-500">{account.countryCode} &middot; ****{account.accountNumberLast4}</p>
              </div>
              {onDelete && (
                <button onClick={() => onDelete(account.id)} className="text-red-600 text-xs">
                  Remove
                </button>
              )}
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-gray-600">{account.currencyCode} {account.maxValueLocal.toLocaleString()}</span>
              <span className="font-medium text-navy-900">
                {account.maxValueUsd ? formatCurrency(account.maxValueUsd) : "—"}
              </span>
            </div>
          </div>
        ))}
        <div className="bg-navy-900 text-white rounded-lg p-4 flex justify-between items-center">
          <span className="font-bold">Total ({accounts.length} accounts)</span>
          <span className="text-lg font-bold">{formatCurrency(totalUsd)}</span>
        </div>
      </div>
    </div>
  );
}
