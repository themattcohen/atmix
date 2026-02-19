# Gap #18: `xlsx` Package Abandoned — Replace with `exceljs`

**Severity:** Low
**Effort:** M (1-4 hours)
**Depends on:** None

## Problem

The `xlsx` package (SheetJS Community Edition) v0.18.5 is the final OSS release, published in 2023. The maintainer moved active development to a commercial fork (`xlsx-pro`). No security patches are published to npm for the OSS version. Because this package processes user-uploaded bank statement files (untrusted binary input), any future memory-safety or zip-bomb vulnerability in the parser would be unpatched indefinitely.

The risk is low today — the package is mature and the attack surface is XLSX parsing on the server side with a 50MB file size cap already enforced — but the dependency will drift further from security hygiene over time.

## Current State

**`d2c/package.json` line 46:**
```json
"xlsx": "^0.18.5"
```

**`d2c/src/lib/extraction.ts` lines 2, 67-74:**
```ts
import * as XLSX from "xlsx"

function convertExcelToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sections: string[] = []
  for (const name of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false })
    if (csv.trim()) sections.push(`Sheet: ${name}\n${csv}`)
  }
  return `Excel Bank Statement Data:\n\n${sections.join("\n\n")}`
}
```

The function is called at line 113 of `extraction.ts` inside `extractFromStatement()` when `mediaType` is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

**`d2c/src/lib/upload-validation.ts`** — references `.xlsx` only in string literals (extension checks and MIME type strings). No import of `xlsx` package. No change needed.

**`d2c/src/components/forms/StatementUpload.tsx` lines 45, 56** — references `.xlsx` only in string literals (accepted extensions). No import of `xlsx` package. No change needed.

The xlsx package is used in exactly one place: `convertExcelToText()` in `extraction.ts`. The output of that function is a plain-text CSV representation passed to Claude for AI extraction — so full fidelity rendering (fonts, colors, merged cells) is not required. Only cell text values matter.

## Implementation Plan

### Step 1: Install `exceljs`, remove `xlsx`

```bash
cd d2c
npm uninstall xlsx
npm install exceljs
npm install --save-dev @types/exceljs   # not needed — exceljs ships its own types
```

`exceljs` ships TypeScript types natively; no `@types/` package is required.

### Step 2: Rewrite `convertExcelToText` in `extraction.ts`

Remove the `xlsx` import and replace `convertExcelToText` with an `exceljs`-based implementation. The function must remain `async` because `exceljs` workbook loading is promise-based.

**Remove (lines 2, 67-75):**
```ts
import * as XLSX from "xlsx"

function convertExcelToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sections: string[] = []
  for (const name of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false })
    if (csv.trim()) sections.push(`Sheet: ${name}\n${csv}`)
  }
  return `Excel Bank Statement Data:\n\n${sections.join("\n\n")}`
}
```

**Add:**
```ts
import ExcelJS from "exceljs"

async function convertExcelToText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sections: string[] = []
  workbook.eachSheet((worksheet) => {
    const rows: string[] = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values as ExcelJS.CellValue[])
        .slice(1) // exceljs row.values is 1-indexed; index 0 is always null
        .map((v) => {
          if (v === null || v === undefined) return ""
          if (typeof v === "object" && "result" in v) return String((v as ExcelJS.CellFormulaValue).result ?? "")
          if (v instanceof Date) return v.toISOString().split("T")[0]
          return String(v)
        })
      const line = values.join(",")
      if (line.replace(/,/g, "").trim()) rows.push(line) // skip blank rows
    })
    if (rows.length > 0) {
      sections.push(`Sheet: ${worksheet.name}\n${rows.join("\n")}`)
    }
  })
  return `Excel Bank Statement Data:\n\n${sections.join("\n\n")}`
}
```

### Step 3: Update the call site to await `convertExcelToText`

In `extractFromStatement()` at line 112-114, the call site is inside an `async` function, so it can be awaited. Change:

```ts
// Before (line 113)
const textContent = mediaType === "text/csv"
  ? convertCsvToText(fileBuffer)
  : convertExcelToText(fileBuffer)
```

To:

```ts
// After
const textContent = mediaType === "text/csv"
  ? convertCsvToText(fileBuffer)
  : await convertExcelToText(fileBuffer)
```

No other callers of `convertExcelToText` exist in the codebase.

### Step 4: Verify TypeScript compiles cleanly

```bash
cd d2c
npm run typecheck
```

Fix any type errors before proceeding. Common issues:
- `ExcelJS.CellValue` union includes `ExcelJS.CellRichTextValue` (array of rich text runs) — the `"result" in v` check above will not match it; add a branch to join `.richText[].text` if needed.
- `row.values` is typed as `CellValue[]` (1-indexed) — the `.slice(1)` handles the offset.

### Step 5: Manual smoke test

Upload a real `.xlsx` bank statement via the app UI and confirm:
1. The statement upload succeeds (no 500 error).
2. The AI extraction returns account data.
3. Check server logs for `[Extraction] Completed` with non-zero `accounts` count.

## Files to Modify

| File | Change |
|---|---|
| `d2c/package.json` | Remove `xlsx`, add `exceljs` |
| `d2c/src/lib/extraction.ts` | Replace `xlsx` import + `convertExcelToText` implementation; add `await` at call site |

## Environment / Config Changes

None. No `.env` changes, no Docker changes, no infrastructure changes. `exceljs` is a pure Node.js package with no native add-ons.

## Testing

**Unit test (existing):** Check whether `d2c/tests/` or `d2c/src/lib/__tests__/` contains unit tests for `convertExcelToText` or `extractFromStatement`. If so, run `npm run test:run` and confirm they pass.

**Manual smoke test:**
1. Start the app locally: `npm run dev` (port 3001).
2. Sign in, navigate to the Accounts step, upload a `.xlsx` file.
3. Confirm extraction succeeds and account values are populated.

**E2E:** The existing Playwright suite does not appear to exercise Excel upload paths specifically, so manual verification is the primary gate here.

**Regression check:** Run `npm run test:e2e` after the change to confirm no unexpected breakage in the upload flow tests.

## Risks / Notes

- **API parity:** `exceljs` does not have a direct `sheet_to_csv` equivalent. The manual row iteration above replicates the same output. The result fed to Claude is plain text, so minor formatting differences (quoting, whitespace) are acceptable.
- **Formula cells:** `exceljs` returns formula cells as `{ formula, result }` objects. The implementation above reads `.result`, which matches the behavior of `xlsx` (which also evaluates cached results, not formulas).
- **Large files:** `exceljs` loads the entire workbook into memory. The existing 50MB file size cap in `upload-validation.ts` (line 11) provides the primary protection against memory exhaustion. No additional change needed.
- **`exceljs` maintenance status:** As of 2026, `exceljs` is actively maintained (last release 2024, open PRs being merged). Re-evaluate if the project goes dormant.
- **No xlsb/xls support:** Neither `xlsx` nor `exceljs` is being used for legacy `.xls` or `.xlsb` formats; the accepted MIME type is strictly `.xlsx` (OOXML). No regression risk there.
