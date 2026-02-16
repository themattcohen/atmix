"use client"

import { useState, useCallback } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileText,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Use local copy — avoids webpack import.meta.url issues
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const ZOOM_STEP = 0.25
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3.0
const ZOOM_DEFAULT = 1.0

interface DocumentViewerProps {
  fileUrl: string
  fileType: string
  fileName: string
  className?: string
}

export function DocumentViewer({
  fileUrl,
  fileType,
  fileName,
  className,
}: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [zoom, setZoom] = useState<number>(ZOOM_DEFAULT)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Normalize legacy bare-extension values to MIME types
  const MIME_NORMALIZE: Record<string, string> = {
    pdf: "application/pdf",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    tiff: "image/tiff",
    tif: "image/tiff",
  }

  const normalizedFileType = MIME_NORMALIZE[fileType.toLowerCase()] ?? fileType
  const isPdf = normalizedFileType === "application/pdf"
  const TABULAR_TYPES = new Set([
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ])
  const isTabular = TABULAR_TYPES.has(normalizedFileType)

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total)
      setCurrentPage(1)
      setLoading(false)
      setError(null)
    },
    []
  )

  const onDocumentLoadError = useCallback((err: Error) => {
    setLoading(false)
    setError(err.message || "Failed to load PDF document")
  }, [])

  const goToPreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(numPages, prev + 1))
  }, [numPages])

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(ZOOM_MAX, +(prev + ZOOM_STEP).toFixed(2)))
  }, [])

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(ZOOM_MIN, +(prev - ZOOM_STEP).toFixed(2)))
  }, [])

  const fitToWidth = useCallback(() => {
    setZoom(ZOOM_DEFAULT)
  }, [])

  return (
    <div
      className={cn(
        "flex min-h-[600px] flex-col overflow-hidden rounded-lg border",
        className
      )}
    >
      {/* Toolbar */}
      <div
        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-gray-800 px-4 py-2 text-white"
        role="toolbar"
        aria-label="Document viewer controls"
      >
        {/* File name */}
        <div className="flex items-center gap-2 overflow-hidden">
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate text-sm font-medium" title={fileName}>
            {fileName}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Page navigation - only for multi-page PDFs */}
          {isPdf && numPages > 1 && (
            <div className="flex items-center gap-1" role="group" aria-label="Page navigation">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[5rem] text-center text-sm" aria-live="polite">
                Page {currentPage} of {numPages}
              </span>
              <button
                onClick={goToNextPage}
                disabled={currentPage >= numPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {/* Separator */}
              <div className="mx-1 h-5 w-px bg-gray-600" aria-hidden="true" />
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1" role="group" aria-label="Zoom controls">
            <button
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN}
              className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-[3.5rem] text-center text-sm" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX}
              className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={fitToWidth}
              className="inline-flex h-8 items-center justify-center gap-1 rounded px-2 text-sm transition-colors hover:bg-gray-700"
              aria-label="Fit to width"
            >
              <Maximize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Fit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Document area */}
      <div className="flex-1 overflow-auto bg-gray-100">
        {isTabular ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="rounded-full bg-blue-100 p-3">
              <FileText className="h-6 w-6 text-blue-500" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-700">
              Spreadsheet files cannot be previewed.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              The extracted data is shown in the review panel.
            </p>
            <a
              href={fileUrl}
              download={fileName}
              className="mt-4 inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Download {fileName}
            </a>
          </div>
        ) : isPdf ? (
          <div className="flex justify-center p-4">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex flex-col items-center justify-center py-24">
                  <Loader2
                    className="h-8 w-8 animate-spin text-gray-400"
                    aria-hidden="true"
                  />
                  <p className="mt-3 text-sm text-gray-500">
                    Loading document...
                  </p>
                </div>
              }
              error={
                <div
                  className="flex flex-col items-center justify-center py-24"
                  role="alert"
                >
                  <div className="rounded-full bg-red-100 p-3">
                    <FileText className="h-6 w-6 text-red-500" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-red-700">
                    Failed to load PDF
                  </p>
                  <p className="mt-1 text-xs text-red-500">
                    The document could not be rendered. It may be corrupted or
                    the URL has expired.
                  </p>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                scale={zoom}
                className="shadow-lg"
                loading={
                  <div className="flex items-center justify-center py-24">
                    <Loader2
                      className="h-6 w-6 animate-spin text-gray-400"
                      aria-hidden="true"
                    />
                  </div>
                }
              />
            </Document>

            {/* Error overlay for post-load errors */}
            {error && (
              <div
                className="flex flex-col items-center justify-center py-24"
                role="alert"
              >
                <div className="rounded-full bg-red-100 p-3">
                  <FileText className="h-6 w-6 text-red-500" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-medium text-red-700">
                  Error loading document
                </p>
                <p className="mt-1 max-w-sm text-center text-xs text-red-500">
                  {error}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl}
              alt={`Document: ${fileName}`}
              className="max-w-full shadow-lg"
              style={{
                objectFit: "contain",
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
              }}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false)
                setError("Failed to load image")
              }}
            />

            {loading && (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2
                  className="h-8 w-8 animate-spin text-gray-400"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm text-gray-500">Loading image...</p>
              </div>
            )}

            {error && (
              <div
                className="flex flex-col items-center justify-center py-24"
                role="alert"
              >
                <div className="rounded-full bg-red-100 p-3">
                  <FileText className="h-6 w-6 text-red-500" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-medium text-red-700">
                  Failed to load image
                </p>
                <p className="mt-1 text-xs text-red-500">
                  The image could not be loaded. The URL may have expired.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
