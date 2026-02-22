# Design Document: A9 — AI Title Parser

**Feature**: Extract structured card metadata from eBay listing titles using Claude Haiku 4.5.
**Status**: Ready for implementation
**Date**: 2026-02-21
**Estimated cost**: ~$0.001 per item (real-time), ~$0.000475 per item (Batch API, 1,000 items)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Schema](#2-database-schema)
3. [TypeScript Types](#3-typescript-types)
4. [New Files](#4-new-files)
5. [Claude Prompt Design](#5-claude-prompt-design)
6. [API Endpoints](#6-api-endpoints)
7. [Integration Points](#7-integration-points)
8. [Modified Files](#8-modified-files)
9. [Test Plan](#9-test-plan)
10. [Error Handling](#10-error-handling)

---

## 1. Overview

eBay listing titles are unstructured strings like:

```
2003-04 LeBron James Topps Chrome #111 PSA 10 Rookie Auto /99
```

This feature uses Claude Haiku 4.5 to parse every tracked item's title into structured fields: player, year, brand, set, parallel, card number, print run, grade, serial number, rookie flag, auto flag, patch/relic flag, sport, team.

The parsed data is stored in a `card_metadata` table (1:1 with `items`). Two parse modes:

- **Real-time**: Single item parsed on demand via POST; also called automatically when a new item is first inserted during sync.
- **Batch**: Anthropic Batch API used to re-parse or bulk-parse up to 1,000 items at ~$0.000475/item (50% batch discount).

---

## 2. Database Schema

### Migration file: `src/lib/db/migrations/002_card_metadata.sql`

```sql
CREATE TABLE card_metadata (
  item_id           TEXT PRIMARY KEY REFERENCES items(item_id) ON DELETE CASCADE,

  -- Identity
  player_name       TEXT,
  year              INTEGER,
  brand             TEXT,
  set_name          TEXT,
  parallel          TEXT,
  card_number       TEXT,

  -- Special attributes (stored as 0/1 INTEGER — SQLite has no BOOLEAN)
  is_rookie         INTEGER DEFAULT 0,
  is_auto           INTEGER DEFAULT 0,
  is_patch          INTEGER DEFAULT 0,
  is_relic          INTEGER DEFAULT 0,

  -- Grading
  grading_company   TEXT,       -- 'PSA' | 'BGS' | 'SGC' | NULL
  grade_value       TEXT,       -- '10' | '9.5' | '8' etc. (TEXT to support decimals)

  -- Numbering
  print_run         INTEGER,    -- serial denominator, e.g. 99 for /99
  serial_number     INTEGER,    -- specific copy number if present, e.g. 42 for 42/99

  -- Context
  sport             TEXT,
  team              TEXT,

  -- Parse metadata
  parse_model       TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  parse_confidence  REAL,       -- 0.0–1.0, model self-reported
  parse_error       TEXT,       -- non-NULL if last parse attempt failed
  parsed_at         TEXT DEFAULT (datetime('now')),
  title_at_parse    TEXT        -- snapshot of title when parsed; detect stale parses
);

CREATE INDEX idx_metadata_player    ON card_metadata(player_name);
CREATE INDEX idx_metadata_year      ON card_metadata(year);
CREATE INDEX idx_metadata_brand     ON card_metadata(brand);
CREATE INDEX idx_metadata_grading   ON card_metadata(grading_company, grade_value);
CREATE INDEX idx_metadata_print_run ON card_metadata(print_run);
CREATE INDEX idx_metadata_rookie    ON card_metadata(is_rookie);
CREATE INDEX idx_metadata_auto      ON card_metadata(is_auto);
CREATE INDEX idx_metadata_parsed_at ON card_metadata(parsed_at);
```

**Notes:**
- `ON DELETE CASCADE` means deleting an item automatically deletes its metadata.
- `title_at_parse` is stored so the app can detect when a title changed since last parse (items sometimes get their titles edited).
- `parse_confidence` is a 0.0–1.0 float the model self-reports in its JSON response. It is informational only; the app does not gate on it.
- `grading_company` accepts only `'PSA'`, `'BGS'`, `'SGC'`, or `NULL`. Validation enforced in TypeScript, not in SQLite.
- `print_run` stores the denominator (`99`), `serial_number` the numerator (`42`) when both are present (e.g., `42/99`).

---

## 3. TypeScript Types

### File: `src/types/index.ts`

Append the following to the existing types file (do not create a new file — keep all domain types in one place, matching the current codebase pattern).

```typescript
// === Card Metadata (A9 — AI Title Parser) ===

export type GradingCompany = 'PSA' | 'BGS' | 'SGC'

export interface CardMetadata {
  itemId: string
  // Identity
  playerName: string | null
  year: number | null
  brand: string | null
  setName: string | null
  parallel: string | null
  cardNumber: string | null
  // Special attributes
  isRookie: boolean
  isAuto: boolean
  isPatch: boolean
  isRelic: boolean
  // Grading
  gradingCompany: GradingCompany | null
  gradeValue: string | null
  // Numbering
  printRun: number | null
  serialNumber: number | null
  // Context
  sport: string | null
  team: string | null
  // Parse metadata
  parseModel: string
  parseConfidence: number | null
  parseError: string | null
  parsedAt: string              // ISO 8601
  titleAtParse: string | null
}

// What Claude returns in its JSON payload.
// All fields are explicitly nullable — Claude may be uncertain.
export interface ParsedTitle {
  player_name: string | null
  year: number | null
  brand: string | null
  set_name: string | null
  parallel: string | null
  card_number: string | null
  is_rookie: boolean
  is_auto: boolean
  is_patch: boolean
  is_relic: boolean
  grading_company: 'PSA' | 'BGS' | 'SGC' | null
  grade_value: string | null
  print_run: number | null
  serial_number: number | null
  sport: string | null
  team: string | null
  confidence: number           // 0.0–1.0 self-reported
}

// Single item parse request body (POST /api/metadata/parse)
export interface TitleParseRequest {
  itemId: string
  force?: boolean              // re-parse even if metadata already exists
}

// Batch parse request body (POST /api/metadata/parse-batch)
export interface TitleParseBatchRequest {
  itemIds?: string[]           // if omitted, parse all items with no metadata
  force?: boolean              // re-parse items that already have metadata
}

// Response from batch trigger
export interface BatchParseResult {
  batchId: string              // Anthropic batch ID, for polling
  submitted: number
  skipped: number
}

// Repository interface for card_metadata
export interface MetadataRepo {
  getByItemId(itemId: string): CardMetadata | null
  getByItemIds(itemIds: string[]): CardMetadata[]
  upsert(meta: CardMetadata): void
  getUnparsed(limit?: number): string[]          // returns item_ids with no metadata row
  getStale(limit?: number): string[]             // returns item_ids where title changed since parse
  delete(itemId: string): void
}
```

---

## 4. New Files

### 4.1 `src/lib/ai/client.ts`

Anthropic SDK singleton. Mirrors the pattern in `src/lib/db/client.ts`.

```
Exported functions:
  getAnthropicClient(): Anthropic
```

**Implementation notes:**
- Import `Anthropic` from `@anthropic-ai/sdk`.
- Hold a module-level `let client: Anthropic | null = null`.
- On first call, read `process.env.ANTHROPIC_API_KEY`. If missing, throw `AppError('AI_NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not set', 503)`.
- Pass `{ apiKey }` to `new Anthropic(...)`.
- Return the cached instance on subsequent calls.
- Do not import from `@/lib/config` — read directly from `process.env` to avoid circular deps, consistent with `src/lib/db/client.ts` which also reads `process.env.DATABASE_PATH` directly.

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { AppError } from '../errors'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (client) return client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AppError('AI_NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not set', 503)
  }
  client = new Anthropic({ apiKey })
  return client
}
```

---

### 4.2 `src/lib/ai/title-parser.ts`

All parsing logic. Two public exports: `parseSingle` and `parseBatch`.

```
Exported functions:
  parseSingle(itemId: string, title: string): Promise<ParsedTitle>
  parseBatch(items: Array<{ itemId: string; title: string }>): Promise<string>
  pollBatch(batchId: string): Promise<BatchPollResult>
  processBatchResults(batchId: string): Promise<void>
```

**`parseSingle(itemId, title): Promise<ParsedTitle>`**

- Calls `client.messages.create(...)` with `model: 'claude-haiku-4-5'`, `max_tokens: 512`.
- System prompt: see section 5.
- User message: `Title: ${title}`.
- Parses the response text as JSON into `ParsedTitle`.
- If JSON parse fails or response shape is invalid, throws `AppError('AI_PARSE_ERROR', ..., 502)`.
- Does not write to DB — the caller (`metadata.ts`) handles persistence.

**`parseBatch(items): Promise<string>`**

- Calls `client.beta.messages.batches.create(...)`.
- `requests` array: one entry per item, `custom_id` = `itemId`, `params.model` = `'claude-haiku-4-5'`, `params.max_tokens` = 512, same system + user messages as `parseSingle`.
- Returns the Anthropic batch ID string.
- The batch runs asynchronously; caller must poll via `pollBatch`.

**`pollBatch(batchId): Promise<BatchPollResult>`**

```typescript
interface BatchPollResult {
  status: 'in_progress' | 'ended'
  requestCounts: {
    processing: number
    succeeded: number
    errored: number
    canceled: number
    expired: number
  }
}
```

- Calls `client.beta.messages.batches.retrieve(batchId)`.
- Maps API response to `BatchPollResult`.

**`processBatchResults(batchId): Promise<void>`**

- Calls `client.beta.messages.batches.results(batchId)` which returns an async iterable.
- For each result: if `result.result.type === 'succeeded'`, parse the message content as `ParsedTitle`.
- `result.custom_id` is the `itemId`.
- Calls `upsertMetadata(...)` from `src/lib/db/metadata.ts` for each succeeded result.
- Logs errors for `type === 'errored'` results using `console.error` (consistent with `sync-service.ts`).
- Does not throw on partial failures — processes all available results.

**`TITLE_PARSE_SYSTEM_PROMPT` constant** (see section 5 for content): exported as a named const for testability.

---

### 4.3 `src/lib/db/metadata.ts`

CRUD for `card_metadata`. Mirrors the pattern in `src/lib/db/items.ts` and `src/lib/db/trends.ts`.

```
Exported functions:
  getByItemId(itemId: string): CardMetadata | null
  getByItemIds(itemIds: string[]): CardMetadata[]
  upsertMetadata(itemId: string, title: string, parsed: ParsedTitle): void
  upsertError(itemId: string, title: string, errorMessage: string): void
  getUnparsed(limit?: number): string[]
  getStale(limit?: number): string[]
  deleteMetadata(itemId: string): void

Exported const:
  metadataRepo: MetadataRepo
```

**Row mapping function (internal):**

```typescript
function rowToMetadata(row: any): CardMetadata {
  return {
    itemId: row.item_id,
    playerName: row.player_name,
    year: row.year,
    brand: row.brand,
    setName: row.set_name,
    parallel: row.parallel,
    cardNumber: row.card_number,
    isRookie: row.is_rookie === 1,
    isAuto: row.is_auto === 1,
    isPatch: row.is_patch === 1,
    isRelic: row.is_relic === 1,
    gradingCompany: row.grading_company,
    gradeValue: row.grade_value,
    printRun: row.print_run,
    serialNumber: row.serial_number,
    sport: row.sport,
    team: row.team,
    parseModel: row.parse_model,
    parseConfidence: row.parse_confidence,
    parseError: row.parse_error,
    parsedAt: row.parsed_at,
    titleAtParse: row.title_at_parse,
  }
}
```

**`getByItemId(itemId)`:**
- `SELECT * FROM card_metadata WHERE item_id = ?`
- Returns `rowToMetadata(row)` or `null`.
- Throws `DatabaseError` on failure (consistent with `items.ts`).

**`getByItemIds(itemIds)`:**
- Uses `IN (?, ?, ...)` parameterized query.
- If `itemIds` is empty, returns `[]` immediately without querying.
- Returns `rows.map(rowToMetadata)`.

**`upsertMetadata(itemId, title, parsed)`:**
- `INSERT OR REPLACE INTO card_metadata (...)` — uses all fields from `parsed` plus `item_id`, `title_at_parse = title`, `parsed_at = datetime('now')`, `parse_error = NULL`.
- Uses `INSERT OR REPLACE` (SQLite shorthand for UPSERT on PRIMARY KEY) — same result as the `ON CONFLICT` pattern in `items.ts`.

**`upsertError(itemId, title, errorMessage)`:**
- Inserts or updates only `parse_error`, `parsed_at`, `title_at_parse`.
- Used when parsing fails to record the failure without clearing previous successful parse data.
- SQL: `INSERT INTO card_metadata (item_id, title_at_parse, parse_error, parsed_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(item_id) DO UPDATE SET parse_error = excluded.parse_error, parsed_at = excluded.parsed_at, title_at_parse = excluded.title_at_parse`

**`getUnparsed(limit = 100)`:**
- Returns `item_id` strings for items that have no row in `card_metadata` OR have `parse_error IS NOT NULL`.
- SQL: `SELECT i.item_id FROM items i LEFT JOIN card_metadata m ON i.item_id = m.item_id WHERE m.item_id IS NULL OR m.parse_error IS NOT NULL ORDER BY i.first_seen_at DESC LIMIT ?`

**`getStale(limit = 100)`:**
- Returns `item_id` strings where `items.title != card_metadata.title_at_parse`.
- SQL: `SELECT i.item_id FROM items i JOIN card_metadata m ON i.item_id = m.item_id WHERE i.title != m.title_at_parse LIMIT ?`

---

### 4.4 `src/lib/db/migrations/002_card_metadata.sql`

Full content: exactly the `CREATE TABLE` and `CREATE INDEX` statements from section 2. No other content. The migration runner (`src/lib/db/migrate.ts`) picks it up automatically by filename sort order.

---

### 4.5 `src/app/api/metadata/route.ts`

GET and POST handlers for metadata operations. Follows the exact pattern of `src/app/api/items/route.ts` and `src/app/api/sync/route.ts`.

```
Exported functions:
  GET(request: NextRequest): Promise<Response>
  POST(request: NextRequest): Promise<Response>
```

See section 6 for full endpoint specifications.

---

### 4.6 `src/app/api/metadata/parse/route.ts`

Single item parse trigger.

```
Exported functions:
  POST(request: NextRequest): Promise<Response>
```

See section 6 for full endpoint specification.

---

### 4.7 `src/app/api/metadata/parse-batch/route.ts`

Batch parse trigger.

```
Exported functions:
  POST(request: NextRequest): Promise<Response>
```

See section 6 for full endpoint specification.

---

### 4.8 `src/hooks/use-metadata.ts`

TanStack Query hook. Follows `src/hooks/use-item-detail.ts` and `src/hooks/use-events.ts` exactly.

```typescript
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CardMetadata, TitleParseRequest } from '@/types'

// Fetch metadata for a single item
export function useItemMetadata(itemId: string) {
  return useQuery<CardMetadata | null>({
    queryKey: ['metadata', itemId],
    queryFn: async () => {
      const res = await fetch(`/api/metadata?itemId=${itemId}`)
      if (!res.ok) throw new Error('Failed to fetch metadata')
      const json = await res.json()
      return json.data
    },
    enabled: !!itemId,
  })
}

// Trigger parse for a single item
export function useParseMutation() {
  const queryClient = useQueryClient()
  return useMutation<CardMetadata, Error, TitleParseRequest>({
    mutationFn: async (body) => {
      const res = await fetch('/api/metadata/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Parse failed')
      const json = await res.json()
      return json.data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['metadata', vars.itemId] })
    },
  })
}
```

---

## 5. Claude Prompt Design

### System Prompt (`TITLE_PARSE_SYSTEM_PROMPT`)

```
You are a trading card expert. Given an eBay listing title, extract structured data about the card.

Return ONLY a JSON object with these exact keys. Use null for any field you cannot determine.

{
  "player_name": string | null,      // Full name: "LeBron James", not "Lebron"
  "year": number | null,             // 4-digit year the card was issued
  "brand": string | null,            // Manufacturer: "Topps", "Panini", "Upper Deck", "Bowman"
  "set_name": string | null,         // Product line: "Chrome", "Prizm", "Select", "Mosaic"
  "parallel": string | null,         // Parallel/variant: "Refractor", "Gold", "Holo", "Silver"
  "card_number": string | null,      // Card number as printed: "111", "RC-15", "BG-7"
  "is_rookie": boolean,              // true if this is a rookie card (RC, Rookie, 1st Year)
  "is_auto": boolean,                // true if autographed
  "is_patch": boolean,               // true if patch card (jersey patch, logo patch)
  "is_relic": boolean,               // true if relic/memorabilia (but NOT a patch)
  "grading_company": "PSA" | "BGS" | "SGC" | null,
  "grade_value": string | null,      // Grade as string: "10", "9.5", "8"
  "print_run": number | null,        // Serial denominator: 99 for /99, 25 for /25
  "serial_number": number | null,    // Specific copy number: 42 for 42/99
  "sport": string | null,            // "Baseball", "Basketball", "Football", "Hockey", "Soccer"
  "team": string | null,             // Team name without city: "Lakers", "Yankees", "Chiefs"
  "confidence": number               // 0.0 to 1.0 — your certainty in this extraction
}

Rules:
- is_rookie = true only for cards explicitly marked RC, Rookie, Rookie Card, or 1st Year. Do not infer.
- is_auto and is_patch can both be true (patch auto card).
- is_relic = true for jersey, bat, equipment relics that are NOT patches.
- If a listing describes a lot or bundle (e.g., "LOT of 10"), set all fields to null and confidence to 0.1.
- If the title is clearly not a trading card (coins, stamps, comic books), set all fields to null and confidence to 0.0.
- Do NOT add keys beyond those listed. Do NOT add commentary outside the JSON object.
```

### Example Input/Output Pairs

**Example 1 — Graded rookie auto with serial number**

Input:
```
2003-04 LeBron James Topps Chrome #111 PSA 10 Rookie Auto /99
```

Output:
```json
{
  "player_name": "LeBron James",
  "year": 2003,
  "brand": "Topps",
  "set_name": "Chrome",
  "parallel": null,
  "card_number": "111",
  "is_rookie": true,
  "is_auto": true,
  "is_patch": false,
  "is_relic": false,
  "grading_company": "PSA",
  "grade_value": "10",
  "print_run": 99,
  "serial_number": null,
  "sport": "Basketball",
  "team": "Cavaliers",
  "confidence": 0.97
}
```

**Example 2 — Parallel with patch, no grade**

Input:
```
2022 Patrick Mahomes Panini Select Gold Prizm Patch Auto /10
```

Output:
```json
{
  "player_name": "Patrick Mahomes",
  "year": 2022,
  "brand": "Panini",
  "set_name": "Select",
  "parallel": "Gold Prizm",
  "card_number": null,
  "is_rookie": false,
  "is_auto": true,
  "is_patch": true,
  "is_relic": false,
  "grading_company": null,
  "grade_value": null,
  "print_run": 10,
  "serial_number": null,
  "sport": "Football",
  "team": "Chiefs",
  "confidence": 0.93
}
```

**Example 3 — BGS graded, specific copy number present**

Input:
```
1986-87 Michael Jordan Fleer #57 BGS 9.5 42/99 Rookie
```

Output:
```json
{
  "player_name": "Michael Jordan",
  "year": 1986,
  "brand": "Fleer",
  "set_name": null,
  "parallel": null,
  "card_number": "57",
  "is_rookie": true,
  "is_auto": false,
  "is_patch": false,
  "is_relic": false,
  "grading_company": "BGS",
  "grade_value": "9.5",
  "print_run": 99,
  "serial_number": 42,
  "sport": "Basketball",
  "team": "Bulls",
  "confidence": 0.96
}
```

**Example 4 — Non-card item (coin)**

Input:
```
1921 Morgan Silver Dollar MS65 PCGS Coin Graded
```

Output:
```json
{
  "player_name": null,
  "year": null,
  "brand": null,
  "set_name": null,
  "parallel": null,
  "card_number": null,
  "is_rookie": false,
  "is_auto": false,
  "is_patch": false,
  "is_relic": false,
  "grading_company": null,
  "grade_value": null,
  "print_run": null,
  "serial_number": null,
  "sport": null,
  "team": null,
  "confidence": 0.0
}
```

**Example 5 — Lot/bundle**

Input:
```
Lot of 50 Sports Cards Mixed NBA NFL MLB Rookies Autos Vintage
```

Output:
```json
{
  "player_name": null,
  "year": null,
  "brand": null,
  "set_name": null,
  "parallel": null,
  "card_number": null,
  "is_rookie": false,
  "is_auto": false,
  "is_patch": false,
  "is_relic": false,
  "grading_company": null,
  "grade_value": null,
  "print_run": null,
  "serial_number": null,
  "sport": null,
  "team": null,
  "confidence": 0.1
}
```

**Example 6 — Ambiguous year range**

Input:
```
Shohei Ohtani 2018-19 Topps Stadium Club Chrome Refractor RC #/250
```

Output:
```json
{
  "player_name": "Shohei Ohtani",
  "year": 2018,
  "brand": "Topps",
  "set_name": "Stadium Club Chrome",
  "parallel": "Refractor",
  "card_number": null,
  "is_rookie": true,
  "is_auto": false,
  "is_patch": false,
  "is_relic": false,
  "grading_company": null,
  "grade_value": null,
  "print_run": 250,
  "serial_number": null,
  "sport": "Baseball",
  "team": "Angels",
  "confidence": 0.88
}
```

**Example 7 — Non-English title**

Input:
```
大谷翔平 2023 Topps Chrome #150 PSA 10 RC
```

Output:
```json
{
  "player_name": "Shohei Ohtani",
  "year": 2023,
  "brand": "Topps",
  "set_name": "Chrome",
  "parallel": null,
  "card_number": "150",
  "is_rookie": true,
  "is_auto": false,
  "is_patch": false,
  "is_relic": false,
  "grading_company": "PSA",
  "grade_value": "10",
  "print_run": null,
  "serial_number": null,
  "sport": "Baseball",
  "team": "Dodgers",
  "confidence": 0.82
}
```

### Edge Case Handling Summary

| Situation | Behavior |
|---|---|
| Non-English player name | Translate to canonical English name if known, else use as-is |
| Lot / bundle title | All fields null, confidence 0.1 |
| Non-card item | All fields null, confidence 0.0 |
| Year range (2018-19) | Use first year |
| Missing info | Use null, not empty string |
| Relic + patch | is_patch=true, is_relic=false (patch is more specific) |
| Dual sport (e.g., auto + base) | Use primary sport from title |
| `#/99` with no copy number | print_run=99, serial_number=null |
| `42/99` | print_run=99, serial_number=42 |

---

## 6. API Endpoints

All endpoints use the `{ data: T }` success envelope and `{ error: { code: string; message: string } }` error envelope defined in `src/types/index.ts`. All handlers use `routeOk` and `routeError` from `src/lib/errors.ts`.

---

### `GET /api/metadata`

Fetch metadata for one or more items.

**Query params:**

| Param | Type | Required | Description |
|---|---|---|---|
| `itemId` | string | No | Single item. Returns `null` if no metadata. |
| `itemIds` | string (comma-separated) | No | Multiple items. Returns array. |
| `unparsed` | `"1"` | No | Returns item_ids with no metadata (for batch targeting). |
| `stale` | `"1"` | No | Returns item_ids where title changed since parse. |
| `limit` | number | No | Max results for `unparsed`/`stale` queries. Default 100. |

If none of the above is provided, returns `400 INVALID_PARAMS`.
`itemId` and `itemIds` are mutually exclusive; `itemIds` takes precedence.

**Responses:**

Single item (`?itemId=123`):
```json
{ "data": { ...CardMetadata } }
```
or `{ "data": null }` if not yet parsed.

Multiple items (`?itemIds=111,222,333`):
```json
{ "data": [ ...CardMetadata[] ] }
```

Unparsed list (`?unparsed=1`):
```json
{ "data": { "itemIds": ["111", "222"], "count": 2 } }
```

Stale list (`?stale=1`):
```json
{ "data": { "itemIds": ["333"], "count": 1 } }
```

---

### `POST /api/metadata/parse`

Parse a single item's title immediately (real-time call).

**Request body:**
```json
{ "itemId": "123456789", "force": false }
```

`force` defaults to `false`. If `false` and metadata already exists with no `parse_error`, returns the existing metadata without calling the API.

**Process:**
1. Validate `itemId` is present.
2. If `!force`, check for existing metadata via `getByItemId`. If found and `parse_error` is null, return it as-is.
3. Fetch the item from DB via `getById`. If not found, throw `AppError('NOT_FOUND', ..., 404)`.
4. Call `parseSingle(itemId, item.title)` from `title-parser.ts`.
5. On success, call `upsertMetadata(itemId, item.title, parsed)`.
6. On `AppError` from parser, call `upsertError(itemId, item.title, err.message)` then re-throw.
7. Return the stored `CardMetadata` via `routeOk`.

**Response:**
```json
{ "data": { ...CardMetadata } }
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `INVALID_PARAMS` | 400 | `itemId` missing |
| `NOT_FOUND` | 404 | Item not in DB |
| `AI_NOT_CONFIGURED` | 503 | `ANTHROPIC_API_KEY` not set |
| `AI_RATE_LIMIT` | 429 | Anthropic rate limit hit |
| `AI_PARSE_ERROR` | 502 | Response not valid JSON or wrong shape |
| `DATABASE_ERROR` | 500 | SQLite error |

---

### `POST /api/metadata/parse-batch`

Submit a batch parse job to Anthropic's Batch API. Returns immediately with a batch ID; processing happens asynchronously (up to 24 hours, typically minutes).

**Request body:**
```json
{
  "itemIds": ["111", "222", "333"],
  "force": false
}
```

If `itemIds` is omitted, defaults to all unparsed items (calls `getUnparsed()`). If `itemIds` is empty array and no unparsed items exist, returns `{ data: { batchId: null, submitted: 0, skipped: 0 } }`.

**Process:**
1. Resolve item IDs: use `body.itemIds` if provided, else call `getUnparsed()`.
2. If `!force`, filter out item IDs that already have non-error metadata.
3. Fetch item records for all remaining IDs via `getByItemIds` equivalent on `items` table.
4. Build batch request array.
5. Call `parseBatch(items)` from `title-parser.ts`.
6. Return `batchId`, `submitted`, `skipped`.

**Response:**
```json
{
  "data": {
    "batchId": "msgbatch_abc123",
    "submitted": 47,
    "skipped": 3
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `AI_NOT_CONFIGURED` | 503 | `ANTHROPIC_API_KEY` not set |
| `AI_BATCH_ERROR` | 502 | Anthropic batch submission failed |
| `DATABASE_ERROR` | 500 | SQLite error |

---

### `GET /api/metadata/batch/[batchId]`

Poll batch status.

**File:** `src/app/api/metadata/batch/[batchId]/route.ts`

```
Exported functions:
  GET(_request: NextRequest, { params }: { params: { batchId: string } }): Promise<Response>
```

**Process:**
1. Call `pollBatch(batchId)` from `title-parser.ts`.
2. Return result.

**Response:**
```json
{
  "data": {
    "status": "in_progress",
    "requestCounts": {
      "processing": 40,
      "succeeded": 7,
      "errored": 0,
      "canceled": 0,
      "expired": 0
    }
  }
}
```

---

### `POST /api/metadata/batch/[batchId]/process`

Retrieve completed batch results and write them to DB. Call this once polling shows `status: "ended"`.

**File:** `src/app/api/metadata/batch/[batchId]/route.ts` — add `POST` export to same file.

```
Exported functions:
  POST(_request: NextRequest, { params }: { params: { batchId: string } }): Promise<Response>
```

**Process:**
1. Call `processBatchResults(batchId)` from `title-parser.ts`.
2. Returns count of successful writes.

**Response:**
```json
{ "data": { "processed": 47, "errors": 0 } }
```

---

## 7. Integration Points

### 7.1 Parsing on New Items During Sync

Modify `src/lib/sync/sync-service.ts` so that when a new item is detected (the `!existing` branch), parsing is triggered asynchronously after the upsert.

The parse must be **non-blocking** — a failure to parse must never fail a sync. Use a fire-and-forget pattern:

```typescript
// Inside runSync(), in the "New item" branch:
if (!existing) {
  upsert(apiItem)
  added++
  // Fire-and-forget: parse the new item's title without blocking sync
  parseSingleAndStore(apiItem.id, apiItem.title).catch(err => {
    console.error(`[title-parser] Failed to parse new item ${apiItem.id}: ${err.message}`)
  })
}
```

**`parseSingleAndStore(itemId, title)`** is a helper function defined in `src/lib/ai/title-parser.ts`:

```typescript
// Helper used by sync-service — not exported from route handlers
export async function parseSingleAndStore(itemId: string, title: string): Promise<void> {
  const parsed = await parseSingle(itemId, title)
  await upsertMetadata(itemId, title, parsed)  // import from metadata.ts
}
```

If `ANTHROPIC_API_KEY` is not set, `parseSingleAndStore` catches the `AI_NOT_CONFIGURED` error internally and logs it as a warning (not an error) — since the app must work without the AI key configured.

### 7.2 Re-parse Detection

Stale parses (title changed since last parse) can be detected via `getStale()`. This is not triggered automatically; the operator calls `POST /api/metadata/parse-batch` with `force: false` and it picks up stale items by design (since stale items have `title_at_parse != title`, and new parse will overwrite).

To explicitly target stale items: `GET /api/metadata?stale=1` returns the IDs, then POST those to `/api/metadata/parse-batch` with `itemIds`.

### 7.3 Rate Limiting and Cost Controls

The real-time path (`POST /api/metadata/parse`) has no built-in rate limiting — the calling user (developer) is the only consumer. The Anthropic SDK will surface a `429` from the API if the rate limit is exceeded; the route handler maps this to `AppError('AI_RATE_LIMIT', ..., 429)`.

The batch path inherently rate-limits by design: the Batch API processes at Anthropic's pace, not ours.

**Cost guard:** The `POST /api/metadata/parse-batch` route returns a warning in the response if `submitted > 500`:

```json
{
  "data": {
    "batchId": "msgbatch_abc123",
    "submitted": 847,
    "skipped": 0,
    "warning": "Large batch: estimated cost $0.40. Proceed by polling the batchId."
  }
}
```

No hard block — developer judgment is the gate.

### 7.4 Configuration: New Environment Variables

Add to `src/lib/config.ts` schema:

```typescript
ANTHROPIC_API_KEY: z.string().optional(),
ANTHROPIC_BATCH_ENABLED: z.enum(['true', 'false']).default('true'),
```

Add `hasAnthropicCredentials(config: AppConfig): boolean` helper (analogous to `hasEbayCredentials`):

```typescript
export function hasAnthropicCredentials(config: AppConfig): boolean {
  return !!config.ANTHROPIC_API_KEY
}
```

The config validation does NOT fail if `ANTHROPIC_API_KEY` is missing — it only logs a warning, parallel to the eBay credentials warning:

```typescript
if (!config.ANTHROPIC_API_KEY) {
  console.warn('Anthropic API key not configured — AI title parsing will be disabled. Set ANTHROPIC_API_KEY in .env to enable.')
}
```

Add to `.env.example` (the project's template env file, if it exists):

```
# AI Title Parser (optional)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BATCH_ENABLED=true
```

---

## 8. Modified Files

### `src/lib/config.ts`

- Add `ANTHROPIC_API_KEY: z.string().optional()` to `configSchema`.
- Add `ANTHROPIC_BATCH_ENABLED: z.enum(['true', 'false']).default('true')` to `configSchema`.
- Add `hasAnthropicCredentials(config: AppConfig): boolean` export.
- Add warn log when `ANTHROPIC_API_KEY` is absent (inside `validateConfig`, same pattern as eBay warning).

### `src/types/index.ts`

- Append all types from section 3 (do not alter existing types).

### `src/lib/sync/sync-service.ts`

- Add import: `import { parseSingleAndStore } from '../ai/title-parser'`
- In the `!existing` branch, after `upsert(apiItem)`, add the fire-and-forget call to `parseSingleAndStore`.
- No other changes.

### `package.json`

- Add `"@anthropic-ai/sdk": "^0.55.0"` to `dependencies`.
- No dev dependency needed (SDK is used at runtime in API routes and sync service).

### `tests/e2e/helpers/mock-data.ts`

- Add `mockCardMetadata` export (see section 9).
- Add `mockMetadataResponse` export.

---

## 9. Test Plan

### Test file: `tests/e2e/metadata.spec.ts`

This is test file T16 (next available after the existing `sync.spec.ts` which contains T15).

**Mocked API routes:**
- `**/api/metadata?itemId=111` → `mockMetadataResponse`
- `**/api/metadata/parse` (POST) → returns `mockMetadataResponse.data`

**Mock data to add to `tests/e2e/helpers/mock-data.ts`:**

```typescript
import type { CardMetadata } from '../../../src/types'

export const mockCardMetadata: CardMetadata = {
  itemId: '111',
  playerName: 'Babe Ruth',
  year: 1952,
  brand: 'Topps',
  setName: null,
  parallel: null,
  cardNumber: '1',
  isRookie: false,
  isAuto: false,
  isPatch: false,
  isRelic: false,
  gradingCompany: null,
  gradeValue: null,
  printRun: null,
  serialNumber: null,
  sport: 'Baseball',
  team: 'Yankees',
  parseModel: 'claude-haiku-4-5',
  parseConfidence: 0.95,
  parseError: null,
  parsedAt: new Date().toISOString(),
  titleAtParse: 'Vintage Baseball Card 1952',
}

export const mockMetadataResponse = { data: mockCardMetadata }
```

**Test cases (T16 file):**

```typescript
test.describe('Metadata — AI Title Parser', () => {

  // T16-01: GET /api/metadata returns null for item with no parse
  test('T16-01: metadata endpoint returns null when not yet parsed', async ({ page }) => {
    await page.route('**/api/metadata?itemId=999', (route) =>
      route.fulfill({ json: { data: null } })
    )
    const res = await page.request.get('/api/metadata?itemId=999')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data).toBeNull()
  })

  // T16-02: GET /api/metadata returns metadata object for parsed item
  test('T16-02: metadata endpoint returns structured data for parsed item', async ({ page }) => {
    await page.route('**/api/metadata?itemId=111', (route) =>
      route.fulfill({ json: mockMetadataResponse })
    )
    const res = await page.request.get('/api/metadata?itemId=111')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data.playerName).toBe('Babe Ruth')
    expect(json.data.year).toBe(1952)
    expect(json.data.brand).toBe('Topps')
    expect(json.data.isRookie).toBe(false)
    expect(json.data.gradingCompany).toBeNull()
  })

  // T16-03: POST /api/metadata/parse returns CardMetadata on success
  test('T16-03: single parse returns full metadata object', async ({ page }) => {
    await page.route('**/api/metadata/parse', (route) =>
      route.fulfill({ json: mockMetadataResponse, status: 200 })
    )
    const res = await page.request.post('/api/metadata/parse', {
      data: { itemId: '111' },
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data.itemId).toBe('111')
    expect(json.data.parseError).toBeNull()
  })

  // T16-04: POST /api/metadata/parse with missing itemId returns 400
  test('T16-04: single parse returns 400 when itemId is missing', async ({ page }) => {
    await page.route('**/api/metadata/parse', (route) =>
      route.fulfill({ json: { error: { code: 'INVALID_PARAMS', message: 'itemId is required' } }, status: 400 })
    )
    const res = await page.request.post('/api/metadata/parse', { data: {} })
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_PARAMS')
  })

  // T16-05: POST /api/metadata/parse returns 503 when AI not configured
  test('T16-05: single parse returns 503 when API key not set', async ({ page }) => {
    await page.route('**/api/metadata/parse', (route) =>
      route.fulfill({ json: { error: { code: 'AI_NOT_CONFIGURED', message: 'ANTHROPIC_API_KEY is not set' } }, status: 503 })
    )
    const res = await page.request.post('/api/metadata/parse', { data: { itemId: '111' } })
    expect(res.status()).toBe(503)
    const json = await res.json()
    expect(json.error.code).toBe('AI_NOT_CONFIGURED')
  })

  // T16-06: GET /api/metadata?unparsed=1 returns list of item IDs
  test('T16-06: unparsed query returns list of item IDs', async ({ page }) => {
    await page.route('**/api/metadata?unparsed=1', (route) =>
      route.fulfill({ json: { data: { itemIds: ['222', '333'], count: 2 } } })
    )
    const res = await page.request.get('/api/metadata?unparsed=1')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data.count).toBe(2)
    expect(json.data.itemIds).toContain('222')
  })

  // T16-07: POST /api/metadata/parse-batch returns batchId
  test('T16-07: batch parse returns batch ID and submitted count', async ({ page }) => {
    await page.route('**/api/metadata/parse-batch', (route) =>
      route.fulfill({ json: { data: { batchId: 'msgbatch_abc123', submitted: 2, skipped: 0 } } })
    )
    const res = await page.request.post('/api/metadata/parse-batch', {
      data: { itemIds: ['111', '222'] },
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data.batchId).toBe('msgbatch_abc123')
    expect(json.data.submitted).toBe(2)
  })

  // T16-08: GET /api/metadata?stale=1 returns stale item IDs
  test('T16-08: stale query returns items whose title changed since parse', async ({ page }) => {
    await page.route('**/api/metadata?stale=1', (route) =>
      route.fulfill({ json: { data: { itemIds: ['444'], count: 1 } } })
    )
    const res = await page.request.get('/api/metadata?stale=1')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data.itemIds).toContain('444')
  })

  // T16-09: force=true re-parses even if metadata exists
  test('T16-09: force flag triggers re-parse of existing metadata', async ({ page }) => {
    let callCount = 0
    await page.route('**/api/metadata/parse', (route) => {
      callCount++
      route.fulfill({ json: mockMetadataResponse })
    })
    // First call without force (would normally skip)
    await page.request.post('/api/metadata/parse', { data: { itemId: '111', force: false } })
    // Second call with force
    await page.request.post('/api/metadata/parse', { data: { itemId: '111', force: true } })
    expect(callCount).toBe(2)
  })

})
```

**Key assertions summary:**
- Successful parse returns `CardMetadata` with all expected fields.
- Missing `itemId` returns `400`.
- Missing API key returns `503`.
- `unparsed` and `stale` queries return `{ itemIds: string[], count: number }`.
- Batch returns `batchId` string.
- `force: true` reaches the API regardless of existing data.

---

## 10. Error Handling

### Error Classes

Add these to `src/lib/errors.ts`, following the existing `EbayApiError` and `DatabaseError` pattern:

```typescript
export class AiConfigError extends AppError {
  constructor(message: string) {
    super('AI_NOT_CONFIGURED', message, 503)
  }
}

export class AiParseError extends AppError {
  constructor(message: string) {
    super('AI_PARSE_ERROR', message, 502)
  }
}

export class AiRateLimitError extends AppError {
  constructor() {
    super('AI_RATE_LIMIT', 'Anthropic rate limit exceeded — retry after a moment', 429)
  }
}

export class AiBatchError extends AppError {
  constructor(message: string) {
    super('AI_BATCH_ERROR', message, 502)
  }
}
```

### Error Handling Matrix

| Scenario | Location | Behavior |
|---|---|---|
| `ANTHROPIC_API_KEY` not set | `getAnthropicClient()` | Throws `AiConfigError` |
| API key invalid (401 from Anthropic) | `parseSingle()` catch | Re-throw as `AiConfigError` |
| Rate limit hit (429 from Anthropic) | `parseSingle()` catch | Re-throw as `AiRateLimitError` |
| Response not valid JSON | `parseSingle()` | Throws `AiParseError` |
| Response missing required keys | `parseSingle()` | Throws `AiParseError` |
| Batch submission fails | `parseBatch()` | Throws `AiBatchError` |
| Batch poll: batch not found | `pollBatch()` | Throws `AppError('NOT_FOUND', ..., 404)` |
| Batch results: partial `errored` entries | `processBatchResults()` | Logs each error, continues processing successes |
| Batch timeout (24hr max exceeded) | `pollBatch()` | `status: "ended"` with `expired > 0`; caller handles |
| Fire-and-forget during sync fails | `sync-service.ts` catch | `console.error` log only; sync continues |
| AI not configured during sync | `parseSingleAndStore()` | `console.warn` log only; sync continues |
| SQLite failure during upsert after parse | `upsertMetadata()` | Throws `DatabaseError`; route returns 500 |
| Malformed title (garbage text) | Claude response | Returns low-confidence all-null JSON; stored normally |

### API Rate Limit Strategy

Anthropic Haiku rate limits (as of 2026): 60 requests/minute on Tier 1. The real-time path calls the API once per request; no additional retry logic is implemented in the route — `routeError` will surface the `AiRateLimitError` as HTTP 429 and the client (or developer) retries. For high-volume reparsing, the batch path bypasses rate limits.

### Batch API Timeout

Anthropic guarantees batch completion within 24 hours. If the batch status stays `in_progress` beyond 25 hours, treat as expired. This is an operational concern, not automated recovery. The `/api/metadata/batch/[batchId]` poll endpoint surfaces the `requestCounts.expired` field; the developer monitors and resubmits if needed.

---

## Appendix: Directory Tree of All New and Modified Files

```
ebay-tracker/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── metadata/
│   │           ├── route.ts                        [NEW] GET /api/metadata
│   │           ├── parse/
│   │           │   └── route.ts                    [NEW] POST /api/metadata/parse
│   │           ├── parse-batch/
│   │           │   └── route.ts                    [NEW] POST /api/metadata/parse-batch
│   │           └── batch/
│   │               └── [batchId]/
│   │                   └── route.ts                [NEW] GET+POST /api/metadata/batch/[batchId]
│   ├── hooks/
│   │   └── use-metadata.ts                         [NEW] TanStack Query hooks
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── client.ts                           [NEW] Anthropic singleton
│   │   │   └── title-parser.ts                     [NEW] parseSingle, parseBatch, pollBatch, processBatchResults
│   │   ├── config.ts                               [MODIFIED] add ANTHROPIC_API_KEY, hasAnthropicCredentials
│   │   ├── db/
│   │   │   ├── metadata.ts                         [NEW] card_metadata CRUD
│   │   │   └── migrations/
│   │   │       └── 002_card_metadata.sql           [NEW] schema migration
│   │   ├── errors.ts                               [MODIFIED] add AiConfigError, AiParseError, AiRateLimitError, AiBatchError
│   │   └── sync/
│   │       └── sync-service.ts                     [MODIFIED] fire-and-forget parseSingleAndStore on new items
│   └── types/
│       └── index.ts                                [MODIFIED] append A9 types
├── tests/
│   └── e2e/
│       ├── helpers/
│       │   └── mock-data.ts                        [MODIFIED] add mockCardMetadata, mockMetadataResponse
│       └── metadata.spec.ts                        [NEW] T16 test suite
└── package.json                                    [MODIFIED] add @anthropic-ai/sdk dependency
```
