// ---------------------------------------------------------------------------
// PDF Workpaper Export Module
// ---------------------------------------------------------------------------
// Generates a professional FBAR workpaper PDF for tax practice documentation
// using @react-pdf/renderer. The workpaper includes a cover/summary page and
// detailed per-account sections with all reviewed data.
//
// Security: TINs are always masked in the PDF (last 4 digits only).
// ---------------------------------------------------------------------------

import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer"
import { getReviewSummary, type ReviewSummary } from "@/lib/approval"
import { safeDecrypt } from "@/lib/encryption"

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    borderBottomStyle: "solid",
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: 180,
    fontWeight: "bold",
    color: "#333333",
  },
  value: {
    flex: 1,
    color: "#000000",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999999",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerConfidential: {
    fontStyle: "italic",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    borderBottomStyle: "solid",
    marginVertical: 10,
  },
  accountHeader: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 6,
    backgroundColor: "#f5f5f5",
    padding: 6,
  },
  correctionItem: {
    marginLeft: 12,
    fontSize: 9,
    color: "#555555",
    marginBottom: 1,
  },
  thresholdYes: {
    color: "#b91c1c",
    fontWeight: "bold",
  },
  thresholdNo: {
    color: "#666666",
  },
})

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

/**
 * Masks a TIN to show only the last 4 digits.
 * Expects decrypted TIN input.
 * e.g. "123456789" -> "***-**-6789", null -> "N/A"
 */
function maskTin(tin: string | null): string {
  if (!tin) return "N/A"
  const digits = tin.replace(/\D/g, "")
  if (digits.length < 4) return "****"
  const last4 = digits.slice(-4)
  return `***-**-${last4}`
}

/**
 * Formats a number as USD currency (whole dollars, with commas).
 * e.g. 12345.67 -> "$12,346"
 */
function formatUsd(amount: number | null): string {
  if (amount === null || amount === undefined) return "\u2014"
  return `$${Math.round(amount).toLocaleString("en-US")}`
}

/**
 * Formats a local currency amount with currency code.
 * e.g. (1234.56, "EUR") -> "1,234.56 EUR"
 */
function formatLocalCurrency(
  amount: number | null,
  currencyCode: string | null
): string {
  if (amount === null || amount === undefined) return "\u2014"
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currencyCode ? `${formatted} ${currencyCode}` : formatted
}

/**
 * Formats an exchange rate to 6 decimal places.
 * e.g. 1.234567 -> "1.234567"
 */
function formatExchangeRate(rate: number | null): string {
  if (rate === null || rate === undefined) return "\u2014"
  return rate.toFixed(6)
}

/**
 * Formats a Date object as a human-readable string.
 * e.g. "January 15, 2024"
 */
function formatDate(date: Date | null): string {
  if (!date) return "\u2014"
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Formats a Date object with time for timestamps.
 * e.g. "January 15, 2024 at 3:45 PM"
 */
function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Maps account type codes to human-readable labels.
 */
function formatAccountType(type: string): string {
  const typeMap: Record<string, string> = {
    BANK: "Bank Account",
    SECURITIES: "Securities Account",
    OTHER: "Other Financial Account",
  }
  return typeMap[type] ?? type
}

/**
 * Derives filing type label from status.
 */
function filingTypeLabel(status: string): string {
  if (status === "AMENDED") return "Amended"
  return "Original"
}

// ---------------------------------------------------------------------------
// PDF Components
// ---------------------------------------------------------------------------

/**
 * A single label-value row within a section.
 */
function DataRow({
  label,
  value,
  valueStyle,
}: {
  label: string
  value: string
  valueStyle?: Record<string, unknown>
}) {
  return React.createElement(
    View,
    { style: styles.row },
    React.createElement(Text, { style: styles.label }, label),
    React.createElement(
      Text,
      { style: valueStyle ? { ...styles.value, ...valueStyle } : styles.value },
      value
    )
  )
}

/**
 * Footer rendered on every page with confidentiality notice,
 * page numbers, and generation timestamp.
 */
function PageFooter({ generatedAt }: { generatedAt: string }) {
  return React.createElement(
    View,
    { style: styles.footer, fixed: true },
    React.createElement(
      Text,
      { style: styles.footerConfidential },
      "Confidential \u2013 Prepared for tax compliance purposes only"
    ),
    React.createElement(
      Text,
      null,
      generatedAt
    ),
    React.createElement(
      Text,
      { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` },
      ""
    )
  )
}

/**
 * Cover/summary page with client info, filing details, and aggregate totals.
 */
function CoverPage({
  data,
  generatedAt,
}: {
  data: ReviewSummary
  generatedAt: string
}) {
  const { filingYear, client, accounts, aggregateMaxValueUSD, exceedsThreshold } =
    data

  const clientName = [client.firstName, client.lastName]
    .filter(Boolean)
    .join(" ")

  return React.createElement(
    Page,
    { size: "LETTER", style: styles.page },

    // Title block
    React.createElement(Text, { style: styles.title }, "FBAR Workpaper \u2013 Form 114"),
    React.createElement(
      Text,
      { style: styles.subtitle },
      "Foreign Bank Account Report"
    ),

    // Client Information section
    React.createElement(
      View,
      { style: styles.section },
      React.createElement(
        Text,
        { style: styles.sectionTitle },
        "Client Information"
      ),
      React.createElement(DataRow, {
        label: "Client",
        value: clientName,
      }),
      React.createElement(DataRow, {
        label: "TIN",
        value: maskTin(client.tin),
      }),
      React.createElement(DataRow, {
        label: "TIN Type",
        value: client.tinType ?? "N/A",
      })
    ),

    // Filing Details section
    React.createElement(
      View,
      { style: styles.section },
      React.createElement(
        Text,
        { style: styles.sectionTitle },
        "Filing Details"
      ),
      React.createElement(DataRow, {
        label: "Filing Year",
        value: String(filingYear.calendarYear),
      }),
      React.createElement(DataRow, {
        label: "Filing Type",
        value: filingTypeLabel(filingYear.status),
      }),
      React.createElement(DataRow, {
        label: "Status",
        value: filingYear.status,
      }),
      React.createElement(DataRow, {
        label: "Date Prepared",
        value: generatedAt,
      })
    ),

    // Summary section
    React.createElement(
      View,
      { style: styles.section },
      React.createElement(
        Text,
        { style: styles.sectionTitle },
        "Filing Summary"
      ),
      React.createElement(DataRow, {
        label: "Total Foreign Accounts",
        value: String(accounts.length),
      }),
      React.createElement(DataRow, {
        label: "Aggregate Maximum Value (USD)",
        value: formatUsd(aggregateMaxValueUSD),
      }),
      React.createElement(DataRow, {
        label: "FBAR Filing Required",
        value: exceedsThreshold ? "Yes" : "No",
        valueStyle: exceedsThreshold ? styles.thresholdYes : styles.thresholdNo,
      })
    ),

    // Footer
    React.createElement(PageFooter, { generatedAt })
  )
}

/**
 * Account detail sections. May span multiple pages depending on account count.
 * Each account gets a clearly delineated section with all reviewed data.
 */
function AccountPages({
  data,
  generatedAt,
}: {
  data: ReviewSummary
  generatedAt: string
}) {
  const { accounts } = data

  if (accounts.length === 0) {
    return React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      React.createElement(
        Text,
        { style: styles.sectionTitle },
        "Account Details"
      ),
      React.createElement(
        Text,
        { style: { color: "#666666", fontStyle: "italic" } },
        "No reviewed accounts for this filing year."
      ),
      React.createElement(PageFooter, { generatedAt })
    )
  }

  // Build account section elements
  const accountSections = accounts.map((acct, index) => {
    const correctionEntries = acct.corrections
      ? Object.entries(acct.corrections)
      : []
    const correctionCount = correctionEntries.length

    return React.createElement(
      View,
      { key: acct.foreignAccountId, style: styles.section, wrap: false },
      React.createElement(
        Text,
        { style: styles.accountHeader },
        `Account ${index + 1} of ${accounts.length}: ${acct.institutionName}`
      ),
      React.createElement(DataRow, {
        label: "Institution Name",
        value: acct.institutionName,
      }),
      React.createElement(DataRow, {
        label: "Account Number",
        value: acct.accountNumber,
      }),
      React.createElement(DataRow, {
        label: "Account Type",
        value: formatAccountType(acct.accountType),
      }),
      React.createElement(DataRow, {
        label: "Country",
        value: acct.country ?? "N/A",
      }),
      React.createElement(DataRow, {
        label: "Currency Code",
        value: acct.currencyCode ?? "N/A",
      }),
      React.createElement(DataRow, {
        label: "Maximum Value (Local)",
        value: formatLocalCurrency(acct.maxValueLocal, acct.currencyCode),
      }),
      React.createElement(DataRow, {
        label: "Exchange Rate",
        value: formatExchangeRate(acct.exchangeRate),
      }),
      React.createElement(DataRow, {
        label: "Maximum Value (USD)",
        value: formatUsd(acct.maxValueUsd),
      }),
      React.createElement(DataRow, {
        label: "Value Unknown",
        value: acct.isValueUnknown ? "Yes" : "No",
      }),

      // Divider before review info
      React.createElement(View, { style: styles.divider }),

      React.createElement(DataRow, {
        label: "Reviewed By",
        value: acct.reviewedBy ?? "\u2014",
      }),
      React.createElement(DataRow, {
        label: "Reviewed At",
        value: formatDate(acct.reviewedAt),
      }),
      React.createElement(DataRow, {
        label: "Corrections Applied",
        value: correctionCount > 0 ? String(correctionCount) : "None",
      }),

      // List individual corrections if any
      ...correctionEntries.map(([field, val]) =>
        React.createElement(
          Text,
          {
            key: field,
            style: styles.correctionItem,
          },
          `\u2022 ${field}: ${String(val)}`
        )
      )
    )
  })

  return React.createElement(
    Page,
    { size: "LETTER", style: styles.page },
    React.createElement(
      Text,
      { style: styles.sectionTitle },
      "Account Details"
    ),
    ...accountSections,
    React.createElement(PageFooter, { generatedAt })
  )
}

/**
 * Top-level Document component assembling all pages.
 */
function WorkpaperDocument({
  data,
  generatedAt,
}: {
  data: ReviewSummary
  generatedAt: string
}) {
  return React.createElement(
    Document,
    {
      title: `FBAR Workpaper - ${data.client.lastName} - ${data.filingYear.calendarYear}`,
      author: "FBAR Automator",
      subject: "FBAR Form 114 Workpaper",
    },
    React.createElement(CoverPage, { data, generatedAt }),
    React.createElement(AccountPages, { data, generatedAt })
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a complete FBAR workpaper PDF for the given filing year.
 *
 * @param filingYearId - The filing year to generate the workpaper for.
 * @param prefetchedSummary - Optional pre-fetched review data (avoids redundant DB queries)
 * @returns A Buffer containing the rendered PDF.
 */
export async function generateWorkpaperPdf(
  filingYearId: string,
  prefetchedSummary?: ReviewSummary
): Promise<Buffer> {
  const summary = prefetchedSummary ?? await getReviewSummary(filingYearId)

  // Decrypt TIN before masking (TINs are now encrypted in DB)
  if (summary.client.tin) {
    summary.client.tin = safeDecrypt(summary.client.tin)
  }

  const generatedAt = formatDateTime(new Date())

  const element = React.createElement(WorkpaperDocument, {
    data: summary,
    generatedAt,
  })

  const buffer = await renderToBuffer(element as any)
  return Buffer.from(buffer)
}
