"use client";

import { useState, useRef, useCallback } from "react";

interface StatementUploadProps {
  filingYearId: string;
  onExtracted: (accounts: MappedAccount[]) => void;
  onError: (error: string) => void;
}

interface MappedAccount {
  account: {
    institutionName: string;
    accountNumber: string;
    accountType: "BANK" | "SECURITIES" | "OTHER";
    ownershipType: "FINANCIAL_INTEREST" | "SIGNATURE_AUTHORITY" | "BOTH";
    countryCode: string;
    currencyCode: string;
    maxValueLocal: number;
    isJointAccount: boolean;
    calendarYear: number;
    institutionAddress?: { street?: string; city?: string; country?: string };
  };
  confidence: {
    bank_name: "high" | "medium" | "low";
    account_number: "high" | "medium" | "low";
    currency: "high" | "medium" | "low";
    max_balance: "high" | "medium" | "low";
    overall: "high" | "medium" | "low";
  };
  warnings: string[];
  sourceIndex: number;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/tiff",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.heic,.tiff,.tif,.csv,.xlsx";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function StatementUpload({ filingYearId, onExtracted, onError }: StatementUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    // Client-side validation
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|jpe?g|png|heic|tiff?|csv|xlsx)$/i)) {
      onError("Unsupported file type. Accepted: PDF, JPEG, PNG, HEIC, TIFF, CSV, Excel.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      onError(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 50MB limit.`);
      return;
    }
    if (file.size === 0) {
      onError("File is empty.");
      return;
    }

    setUploading(true);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("filingYearId", filingYearId);

      const res = await fetch("/api/statements/upload", {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        onError(data.error || "Upload failed");
        return;
      }

      if (data.extractedAccounts && data.extractedAccounts.length > 0) {
        onExtracted(data.extractedAccounts);
      } else {
        onError("No accounts could be extracted from this document. You can add accounts manually.");
      }

      if (data.warnings && data.warnings.length > 0) {
        console.warn("Extraction warnings:", data.warnings);
      }
    } catch {
      onError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setFileName(null);
    }
  }, [filingYearId, onExtracted, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (e.target) e.target.value = "";
  }, [handleFile]);

  if (uploading) {
    return (
      <div className="bg-white rounded-lg shadow-md border p-8 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-900 mx-auto mb-4" role="status">
          <span className="sr-only">Processing...</span>
        </div>
        <p className="text-navy-900 font-medium">Analyzing {fileName}...</p>
        <p className="text-sm text-gray-500 mt-1">AI is extracting account information. This may take up to 30 seconds.</p>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
      className={`bg-white rounded-lg shadow-md border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
        dragOver
          ? "border-navy-900 bg-navy-50"
          : "border-gray-300 hover:border-navy-900 hover:bg-gray-50"
      }`}
      role="button"
      tabIndex={0}
      aria-label="Upload bank statement"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
      />
      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p className="text-navy-900 font-medium mb-1">
        {dragOver ? "Drop your file here" : "Upload a bank statement"}
      </p>
      <p className="text-sm text-gray-500 mb-2">
        Drag and drop or click to browse
      </p>
      <p className="text-xs text-gray-400">
        PDF, JPEG, PNG, HEIC, TIFF, CSV, Excel &middot; Max 50MB
      </p>
    </div>
  );
}
