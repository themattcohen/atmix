"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { MappedAccount } from "@/lib/extraction-mapper";
import { consolidateExtractedAccounts } from "@/lib/account-consolidation";
import { computeMonthsCovered, monthName } from "@/lib/statement-coverage";

export interface UploadedFileInfo {
  name: string;
  size: number;
  status: "pending" | "uploading" | "done" | "error";
  errorMessage?: string;
  confidence?: "high" | "medium" | "low";
}

interface MultiStatementUploadProps {
  filingYearId: string;
  calendarYear: number;
  onAllExtracted: (accounts: MappedAccount[]) => void;
  onCoverageWarning: (warning: string | null) => void;
  onCoverageData?: (data: { monthsCovered: number[]; monthsMissing: number[] }) => void;
  onError: (error: string) => void;
  onFilesChanged: (files: UploadedFileInfo[]) => void;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.csv,.xlsx";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function MultiStatementUpload({
  filingYearId,
  calendarYear,
  onAllExtracted,
  onCoverageWarning,
  onCoverageData,
  onError,
  onFilesChanged,
}: MultiStatementUploadProps) {
  const [files, setFiles] = useState<UploadedFileInfo[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<File[]>([]);
  const processingRef = useRef(false);
  const allAccountsRef = useRef<MappedAccount[]>([]);
  const allPeriodsRef = useRef<Array<{ start_date: string; end_date: string }>>([]);

  // beforeunload guard while uploading
  useEffect(() => {
    if (!isProcessing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isProcessing]);

  const updateFile = useCallback(
    (index: number, update: Partial<UploadedFileInfo>) => {
      setFiles((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...update };
        return next;
      });
    },
    []
  );

  // Notify parent whenever files change
  useEffect(() => {
    onFilesChanged(files);
  }, [files, onFilesChanged]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    while (queueRef.current.length > 0) {
      const file = queueRef.current.shift()!;

      // Find this file's index in the files array
      const fileIndex = files.length + allAccountsRef.current.length; // approximate
      // We need a stable way to find the index — use the name
      setFiles((prev) => {
        const idx = prev.findIndex(
          (f) => f.name === file.name && f.status === "pending"
        );
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], status: "uploading" };
          return next;
        }
        return prev;
      });
      setCurrentIndex((prev) => prev + 1);

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
          setFiles((prev) => {
            const idx = prev.findIndex(
              (f) => f.name === file.name && f.status === "uploading"
            );
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = {
                ...next[idx],
                status: "error",
                errorMessage: data.error || "Upload failed",
              };
              return next;
            }
            return prev;
          });
          continue;
        }

        // Success
        if (data.extractedAccounts?.length > 0) {
          allAccountsRef.current.push(...data.extractedAccounts);
        }
        if (data.statementPeriods?.length > 0) {
          allPeriodsRef.current.push(...data.statementPeriods);
        }

        // Compute file-level confidence from extracted accounts
        let fileConfidence: "high" | "medium" | "low" = "high";
        if (data.extractedAccounts?.length > 0) {
          const levels = data.extractedAccounts.map((a: any) => a.confidence?.overall);
          if (levels.includes("low")) fileConfidence = "low";
          else if (levels.includes("medium")) fileConfidence = "medium";
        } else {
          fileConfidence = "low";
        }

        setFiles((prev) => {
          const idx = prev.findIndex(
            (f) => f.name === file.name && f.status === "uploading"
          );
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], status: "done", confidence: fileConfidence };
            return next;
          }
          return prev;
        });
      } catch {
        setFiles((prev) => {
          const idx = prev.findIndex(
            (f) => f.name === file.name && f.status === "uploading"
          );
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              status: "error",
              errorMessage: "Upload failed. Please try again.",
            };
            return next;
          }
          return prev;
        });
      }
    }

    // All files processed
    processingRef.current = false;
    setIsProcessing(false);

    // Compute coverage warning and data
    if (allPeriodsRef.current.length > 0) {
      const { monthsCovered, monthsMissing } = computeMonthsCovered(
        allPeriodsRef.current,
        calendarYear
      );
      onCoverageData?.({ monthsCovered, monthsMissing });
      if (monthsMissing.length > 0) {
        onCoverageWarning(
          `Your uploaded statements may not cover ${monthsMissing.map(monthName).join(", ")} ${calendarYear}. ` +
            "If you have additional statements for those months, you can drop them above."
        );
      } else {
        onCoverageWarning(null);
      }
    }

    // Consolidate accounts (e.g. 24 monthly extractions → 2 unique accounts)
    // then call onAllExtracted
    if (allAccountsRef.current.length > 0) {
      const consolidated = consolidateExtractedAccounts([...allAccountsRef.current]);
      onAllExtracted(consolidated);
    }
  }, [filingYearId, calendarYear, onAllExtracted, onCoverageWarning, onCoverageData]);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validFiles: File[] = [];
      const newFileInfos: UploadedFileInfo[] = [];

      for (const file of fileArray) {
        // Type validation
        if (
          !ACCEPTED_TYPES.includes(file.type) &&
          !file.name.match(/\.(pdf|jpe?g|png|csv|xlsx)$/i)
        ) {
          onError(
            `${file.name}: Unsupported file type. Accepted: PDF, JPEG, PNG, CSV, Excel.`
          );
          continue;
        }
        // Size validation
        if (file.size > MAX_FILE_SIZE) {
          onError(
            `${file.name}: File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 10MB limit.`
          );
          continue;
        }
        // Empty file
        if (file.size === 0) {
          onError(`${file.name}: File is empty.`);
          continue;
        }
        // Duplicate within this batch or existing files
        const isDuplicate =
          files.some((f) => f.name === file.name) ||
          newFileInfos.some((f) => f.name === file.name);
        if (isDuplicate) {
          onError(`${file.name}: A file with this name has already been added.`);
          continue;
        }

        validFiles.push(file);
        newFileInfos.push({
          name: file.name,
          size: file.size,
          status: "pending",
        });
      }

      if (validFiles.length === 0) return;

      setFiles((prev) => [...prev, ...newFileInfos]);
      setTotalCount((prev) => prev + validFiles.length);
      queueRef.current.push(...validFiles);

      // Start processing if not already running
      // Use setTimeout to let state update before processing
      setTimeout(() => processQueue(), 0);
    },
    [files, onError, processQueue]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        addFiles(selectedFiles);
      }
      if (e.target) e.target.value = "";
    },
    [addFiles]
  );

  return (
    <div>
      {/* Drop zone — always visible so user can add more files */}
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
        aria-label="Upload bank statements"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
        />
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        {isProcessing ? (
          <>
            <p className="text-navy-900 font-medium mb-1">
              Extracting file {currentIndex} of {totalCount}...
            </p>
            <p className="text-sm text-gray-500 mb-2">
              Up to 30 seconds per file. You can drop more files to add to the
              queue.
            </p>
          </>
        ) : (
          <>
            <p className="text-navy-900 font-medium mb-1">
              {dragOver
                ? "Drop your files here"
                : "Upload bank statements"}
            </p>
            <p className="text-sm text-gray-500 mb-2">
              Drag and drop or click to browse &middot; Multiple files supported
            </p>
          </>
        )}
        <p className="text-xs text-gray-400">
          PDF, JPEG, PNG, CSV, Excel &middot; Max 10MB per file
        </p>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-navy-900" role="status">
            <span className="sr-only">Processing...</span>
          </div>
          <span>
            Processing file {currentIndex} of {totalCount}...
          </span>
        </div>
      )}
    </div>
  );
}
