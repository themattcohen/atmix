# Gap #15: Drawn Signatures Not Embedded in Form 114a PDF

**Severity:** Medium
**Effort:** M (1-4 hours)
**Depends on:** None

## Problem

When a user signs using the canvas-drawn signature option, the Form 114a PDF contains the
placeholder text `[Digital signature on file]` instead of a rendered image of their actual
signature. Typed signatures work correctly — they render in Courier Italic font. The discrepancy
means drawn-signature PDFs are visually incomplete and could be questioned in an audit or
compliance review, where the 114a is the legal record of the filer's authorization.

## Current State

**`d2c/src/lib/form114a.ts`**

The signature rendering block is lines 85-92:

```typescript
if (data.signatureType === "typed") {
  doc.setFontSize(16);
  doc.setFont("courier", "italic");
  doc.text(data.signatureData, 25, y + 2);
} else {
  doc.setFontSize(10);
  doc.text("[Digital signature on file]", 25, y + 2);
}
```

The `else` branch (line 89-92) handles `signatureType === "drawn"`. It writes a static string
instead of rendering the canvas image.

**`data.signatureData`** for drawn signatures contains a base64-encoded PNG data URL, produced
by the canvas element in the sign step UI (e.g., `data:image/png;base64,iVBORw0KGgo...`). This
value is stored in `FilingYear.signatureData` as a JSON field (`{ type: 'drawn', value: string }`)
per the schema comment in `d2c/prisma/schema.prisma` line 81.

**jsPDF version:** `"jspdf": "^2.5.2"` (`d2c/package.json` line 34). jsPDF 2.x supports
`doc.addImage(dataUrl, format, x, y, width, height)` for embedding raster images including PNG.

**Typed signature path** (lines 85-88) works because `data.signatureData` for typed signatures
is a plain string (the user's typed name), which `doc.text()` renders directly. The drawn path
passes a multi-kilobyte base64 data URL to `doc.text()`, which would render it as a garbage
string — the placeholder text was added to avoid that.

**Signature area geometry** (lines 82-94):
- Horizontal line drawn at `y + 5` (line 83).
- Signature rendered at `y + 2` (above the line).
- `y` advances by 15 after the signature block (line 94).
- Page width: jsPDF A4 default is 210mm; `pageWidth` computed at line 19. Usable signature width
  is approximately `pageWidth - 45` mm (from x=25 to x=pageWidth-20).

## Implementation Plan

### Step 1: Add image validation and sizing logic

Before calling `doc.addImage`, validate that `data.signatureData` is a well-formed PNG data URL.
A drawn signature should always be a data URL, but defensive validation prevents a corrupted
value from crashing PDF generation.

Determine display dimensions. The signature box is bounded by x=25, y=(y+2), and runs to
`pageWidth - 20`. The height must fit in the `y += 15` gap (i.e., 13mm max to stay above the
line). Use a fixed display size: **80mm wide, 12mm tall**. This matches a typical handwritten
signature aspect ratio while fitting within the allocated space.

### Step 2: Replace the `else` branch at lines 89-92

Replace the placeholder text with a `doc.addImage` call:

```typescript
// d2c/src/lib/form114a.ts — lines 85-92, replace the entire if/else block:

if (data.signatureType === "typed") {
  doc.setFontSize(16);
  doc.setFont("courier", "italic");
  doc.text(data.signatureData, 25, y + 2);
} else {
  // Drawn signature: embed the canvas PNG into the PDF
  const isValidDataUrl =
    typeof data.signatureData === "string" &&
    data.signatureData.startsWith("data:image/png;base64,");

  if (isValidDataUrl) {
    try {
      // addImage(dataUrl, format, x_mm, y_mm, width_mm, height_mm)
      // Positioned to sit above the signature line (drawn at y + 5).
      // Width capped at 80mm; height 12mm preserves aspect without overflow.
      doc.addImage(data.signatureData, "PNG", 25, y - 10, 80, 12);
    } catch (imgErr) {
      // Fallback: if image data is corrupt, write the placeholder text
      // rather than crashing the entire PDF generation.
      console.error("[form114a] Failed to embed drawn signature image:", imgErr);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("[Digital signature on file]", 25, y + 2);
    }
  } else {
    // signatureData is missing or not a PNG data URL — use text fallback
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("[Digital signature on file]", 25, y + 2);
  }
}
```

**Coordinate notes:**
- The signature line is drawn at `y + 5` (line 83 of the original). Placing the image at
  `y - 10` with a 12mm height means the image bottom edge sits at `y + 2`, just above the line.
  Adjust `y - 10` and height `12` if the sign step canvas produces images with significant
  whitespace margins — the signature strokes typically occupy the middle third of a canvas.
- jsPDF `addImage` units match the document units (mm by default for A4). The call is synchronous.

### Step 3: Verify the sign step stores the full data URL

Confirm that the sign step API (`/api/sign` or similar) stores the raw canvas data URL in the DB,
not a stripped base64 string. The `signatureData` JSON field (schema line 81) should contain:
```json
{ "type": "drawn", "value": "data:image/png;base64,iVBORw0KGgo..." }
```

Check how `form114a.ts` is called — specifically, what value is passed as `data.signatureData`.
If the caller passes `signatureData.value` (unwrapped from the JSON object), the data URL prefix
`data:image/png;base64,` should already be present. If the caller passes the raw base64 without
the prefix, update the `isValidDataUrl` check and prefix accordingly:

```typescript
// If signatureData arrives without the prefix:
const dataUrl = data.signatureData.startsWith("data:")
  ? data.signatureData
  : `data:image/png;base64,${data.signatureData}`;
doc.addImage(dataUrl, "PNG", 25, y - 10, 80, 12);
```

### Step 4: Check canvas background color in the sign step UI

jsPDF's `addImage` composites PNG images directly. If the canvas background is transparent (the
default for an HTML5 canvas), the signature strokes will render correctly on the white PDF
background. If the canvas has an explicit white fill, that will also render correctly.

No code change is needed here unless visual testing reveals the image renders with an unexpected
black or colored background — in that case, ensure the canvas sets `fillStyle = '#ffffff'` before
any drawing.

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/lib/form114a.ts` | Replace lines 89-92 (`else` branch) with `doc.addImage` call plus validation and fallback |

## Environment / Config Changes

None. `jspdf` 2.5.x already supports `addImage` with PNG data URLs out of the box. No new
packages or environment variables are required.

## Testing

**Manual verification (required):**
1. Start the D2C dev server (`npm run dev` in `d2c/`).
2. Complete the filing wizard to the sign step.
3. Use the drawn signature pad to draw a signature, then submit.
4. Trigger Form 114a generation (completes at the sign step when `generateForm114a` is called).
5. Download or view the generated PDF from the dashboard.
6. Confirm the drawn signature image appears above the signature line, visually matching what
   the user drew in the canvas.

**Typed signature regression:**
1. Repeat the above with a typed signature.
2. Confirm the typed name still renders in Courier Italic at the correct position.

**Edge case — empty or corrupt signature data:**
1. Temporarily pass an empty string as `signatureData` with `signatureType: "drawn"`.
2. Confirm the PDF generates without throwing (fallback text renders, no crash).
3. Confirm the error is logged to console.

**Unit test (optional):**
If a vitest unit test for `generateForm114a` is added, mock `jspdf` and assert that:
- `addImage` is called when `signatureType === "drawn"` and data URL is valid.
- `text` with the placeholder is called when the data URL is invalid.
- `text` in Courier Italic is called when `signatureType === "typed"`.

**E2E:**
The existing antagonistic E2E suite does not test PDF content. A targeted check can be added
to `tests/e2e/` using Playwright's download assertion to verify the PDF is generated
(non-zero byte size) after a drawn signature. Full PDF text extraction in Playwright requires
an additional library (e.g., `pdf-parse`) and is optional.

## Risks / Notes

- **Image size / PDF file size:** A full-canvas drawn signature PNG can be 20-100 KB. jsPDF
  embeds images uncompressed in the PDF's internal object stream, which can increase the PDF
  file size significantly (500 KB - 2 MB total). For a legal record document this is acceptable.
  If file size becomes a concern, resize the canvas in the UI to a smaller pixel dimension before
  encoding (e.g., 400x100 px instead of the default canvas resolution).
- **jsPDF `addImage` performance:** The call is synchronous and CPU-bound for large images. For
  typical signature sizes (under 100 KB), this is imperceptible (<50 ms). The PDF is generated
  server-side in a Node.js process, so no browser impact.
- **Existing PDFs:** Users who already signed with a drawn signature have a 114a PDF stored in
  MinIO with the `[Digital signature on file]` placeholder. Those existing PDFs will not be
  retroactively updated. If needed, a one-off migration could regenerate affected PDFs, but this
  requires retrieving and re-parsing the stored `signatureData` for each affected `FilingYear`.
  That is a separate, optional effort.
- **Data URL size limit:** jsPDF has no documented limit on `addImage` input size. The main risk
  is a canvas with `willReadFrequently` optimization disabled producing a very large PNG — this
  is controlled by the sign step UI canvas size, not by `form114a.ts`.
- **`addImage` format argument:** Passing `"PNG"` explicitly is correct. jsPDF can auto-detect
  format from the data URL prefix, but explicit is safer across minor versions.
