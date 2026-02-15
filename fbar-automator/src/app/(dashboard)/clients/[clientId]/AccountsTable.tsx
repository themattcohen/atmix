"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Loader2, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { COUNTRY_CODES } from "@/types/fincen"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountsTableProps {
  clientId: string
  isAdmin: boolean
  accounts: Array<{
    id: string
    accountNumber: string
    accountType: string
    institutionName: string
    institutionAddressCountry: string | null
    ownershipType: string
    isActive: boolean
  }>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountsTable({ clientId, isAdmin, accounts }: AccountsTableProps) {
  const router = useRouter()
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Edit form state
  const [editInstitution, setEditInstitution] = useState("")
  const [editAccountNumber, setEditAccountNumber] = useState("")
  const [accountNumberModified, setAccountNumberModified] = useState(false)
  const [editAccountType, setEditAccountType] = useState("")
  const [editCountry, setEditCountry] = useState("")
  const [editOwnership, setEditOwnership] = useState("")
  const [editIsActive, setEditIsActive] = useState(true)

  function startEdit(account: AccountsTableProps["accounts"][0]) {
    setEditingAccountId(account.id)
    setDeletingAccountId(null)
    setEditInstitution(account.institutionName)
    setEditAccountNumber("")
    setAccountNumberModified(false)
    setEditAccountType(account.accountType)
    setEditCountry(account.institutionAddressCountry || "")
    setEditOwnership(account.ownershipType)
    setEditIsActive(account.isActive)
    setMessage(null)
  }

  function cancelEdit() {
    setEditingAccountId(null)
    setMessage(null)
  }

  function startDelete(accountId: string) {
    setDeletingAccountId(accountId)
    setEditingAccountId(null)
    setMessage(null)
  }

  function cancelDelete() {
    setDeletingAccountId(null)
    setMessage(null)
  }

  async function handleSaveEdit(accountId: string) {
    setSaving(true)
    setMessage(null)

    try {
      const payload: Record<string, unknown> = {
        institutionName: editInstitution,
        accountType: editAccountType,
        institutionAddressCountry: editCountry || null,
        ownershipType: editOwnership,
        isActive: editIsActive,
      }

      if (accountNumberModified) {
        payload.accountNumber = editAccountNumber
      }

      const res = await fetch(`/api/clients/${clientId}/accounts/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to update account.")
      }

      setMessage({ type: "success", text: "Account updated successfully." })
      setEditingAccountId(null)
      router.refresh()
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "An unexpected error occurred.",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete(accountId: string) {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/clients/${clientId}/accounts/${accountId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to delete account.")
      }

      setMessage({ type: "success", text: "Account deleted successfully." })
      setDeletingAccountId(null)
      router.refresh()
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "An unexpected error occurred.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Feedback message */}
      {message && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-md p-3 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
          role="alert"
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="pb-2 pr-4 font-medium">Institution</th>
              <th className="pb-2 pr-4 font-medium">Account #</th>
              <th className="pb-2 pr-4 font-medium">Type</th>
              <th className="pb-2 pr-4 font-medium">Country</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                isEditing={editingAccountId === account.id}
                isDeleting={deletingAccountId === account.id}
                saving={saving}
                isAdmin={isAdmin}
                editInstitution={editInstitution}
                editAccountNumber={editAccountNumber}
                accountNumberModified={accountNumberModified}
                editAccountType={editAccountType}
                editCountry={editCountry}
                editOwnership={editOwnership}
                editIsActive={editIsActive}
                onStartEdit={() => startEdit(account)}
                onStartDelete={() => startDelete(account.id)}
                onCancelEdit={cancelEdit}
                onCancelDelete={cancelDelete}
                onSaveEdit={() => handleSaveEdit(account.id)}
                onConfirmDelete={() => handleConfirmDelete(account.id)}
                setEditInstitution={setEditInstitution}
                setEditAccountNumber={(val) => {
                  setEditAccountNumber(val)
                  setAccountNumberModified(true)
                }}
                setEditAccountType={setEditAccountType}
                setEditCountry={setEditCountry}
                setEditOwnership={setEditOwnership}
                setEditIsActive={setEditIsActive}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Account Row (includes inline edit/delete sub-rows)
// ---------------------------------------------------------------------------

interface AccountRowProps {
  account: AccountsTableProps["accounts"][0]
  isEditing: boolean
  isDeleting: boolean
  saving: boolean
  isAdmin: boolean
  editInstitution: string
  editAccountNumber: string
  accountNumberModified: boolean
  editAccountType: string
  editCountry: string
  editOwnership: string
  editIsActive: boolean
  onStartEdit: () => void
  onStartDelete: () => void
  onCancelEdit: () => void
  onCancelDelete: () => void
  onSaveEdit: () => void
  onConfirmDelete: () => void
  setEditInstitution: (val: string) => void
  setEditAccountNumber: (val: string) => void
  setEditAccountType: (val: string) => void
  setEditCountry: (val: string) => void
  setEditOwnership: (val: string) => void
  setEditIsActive: (val: boolean) => void
}

function AccountRow({
  account,
  isEditing,
  isDeleting,
  saving,
  isAdmin,
  editInstitution,
  editAccountNumber,
  accountNumberModified,
  editAccountType,
  editCountry,
  editOwnership,
  editIsActive,
  onStartEdit,
  onStartDelete,
  onCancelEdit,
  onCancelDelete,
  onSaveEdit,
  onConfirmDelete,
  setEditInstitution,
  setEditAccountNumber,
  setEditAccountType,
  setEditCountry,
  setEditOwnership,
  setEditIsActive,
}: AccountRowProps) {
  return (
    <>
      <tr>
        <td className="py-2 pr-4 font-medium text-gray-900">
          {account.institutionName}
        </td>
        <td className="py-2 pr-4 font-mono text-gray-600">
          {account.accountNumber}
        </td>
        <td className="py-2 pr-4 text-gray-600">{account.accountType}</td>
        <td className="py-2 pr-4 text-gray-600">
          {account.institutionAddressCountry
            ? COUNTRY_CODES[account.institutionAddressCountry]
              ? `${account.institutionAddressCountry} — ${COUNTRY_CODES[account.institutionAddressCountry]}`
              : account.institutionAddressCountry
            : "-"}
        </td>
        <td className="py-2 pr-4">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              account.isActive
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {account.isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="py-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onStartEdit}
              aria-label={`Edit account at ${account.institutionName}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onStartDelete}
                aria-label={`Delete account at ${account.institutionName}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            )}
          </div>
        </td>
      </tr>

      {/* Inline Edit Row */}
      {isEditing && (
        <tr>
          <td colSpan={6} className="py-2">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-medium text-gray-700">
                Edit Account
              </h4>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Institution Name *
                    </label>
                    <Input
                      value={editInstitution}
                      onChange={(e) => setEditInstitution(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Account Number
                    </label>
                    <Input
                      value={accountNumberModified ? editAccountNumber : ""}
                      onChange={(e) => setEditAccountNumber(e.target.value)}
                      placeholder={account.accountNumber}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Account Type
                    </label>
                    <select
                      value={editAccountType}
                      onChange={(e) => setEditAccountType(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                    >
                      <option value="BANK">Bank</option>
                      <option value="SECURITIES">Securities</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Country
                    </label>
                    <select
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                      aria-label="Country"
                    >
                      <option value="">Select country</option>
                      {Object.entries(COUNTRY_CODES).map(([code, name]) => (
                        <option key={code} value={code}>
                          {code} — {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Ownership
                    </label>
                    <select
                      value={editOwnership}
                      onChange={(e) => setEditOwnership(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                    >
                      <option value="FINANCIAL_INTEREST">Financial Interest</option>
                      <option value="SIGNATURE_AUTHORITY">Signature Authority</option>
                      <option value="BOTH">Both</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`active-${account.id}`}
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor={`active-${account.id}`} className="text-xs text-gray-600">
                    Account is active
                  </label>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" onClick={onSaveEdit} disabled={saving || !editInstitution.trim()}>
                    {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Inline Delete Confirmation Row */}
      {isDeleting && (
        <tr>
          <td colSpan={6} className="py-2">
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">
                Delete account at <span className="font-medium">{account.institutionName}</span>? This cannot be undone.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="destructive" size="sm" onClick={onConfirmDelete} disabled={saving}>
                  {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelDelete}>
                  Cancel
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
