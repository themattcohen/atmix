"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

interface ConfirmDeleteDialogProps {
  open: boolean;
  userEmail: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  userEmail,
  onConfirm,
  onCancel,
  loading,
}: ConfirmDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setConfirmation("");
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Handle backdrop click / escape
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleCancel(e: Event) {
      e.preventDefault();
      onCancel();
    }

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className="bg-white border border-gray-200 rounded-lg p-6 max-w-md mx-auto mt-20 backdrop:bg-black/50"
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete User</h2>
      <p className="text-sm text-gray-600 mb-4">
        This action is irreversible. All user data, filings, accounts, and
        payments will be permanently deleted.
      </p>
      <p className="text-sm text-gray-700 mb-2">
        Type <strong className="font-mono text-red-600">{userEmail}</strong> to
        confirm deletion:
      </p>
      <input
        type="text"
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
        placeholder={userEmail}
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        autoComplete="off"
      />
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={confirmation !== userEmail || loading}
          loading={loading}
          onClick={onConfirm}
        >
          Delete User
        </Button>
      </div>
    </dialog>
  );
}
