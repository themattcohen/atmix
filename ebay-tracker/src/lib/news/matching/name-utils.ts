/**
 * Name processing utilities for player matching pipeline.
 * Pure functions, zero external dependencies.
 */

const SUFFIXES = /\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(SUFFIXES, '')
    .trim()
}

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export function nameConfidence(extracted: string, candidate: string): number {
  const a = normalizeName(extracted)
  const b = normalizeName(candidate)
  if (a === b) return 1.0
  const dist = levenshtein(a, b)
  if (dist === 1) return 0.95
  if (dist === 2) return 0.90
  // First-initial + last name match (e.g., "M. Trout" vs "Mike Trout")
  const aParts = a.split(/\s+/)
  const bParts = b.split(/\s+/)
  if (aParts.length >= 2 && bParts.length >= 2) {
    const aLast = aParts[aParts.length - 1]
    const bLast = bParts[bParts.length - 1]
    if (aLast === bLast && (aParts[0].length === 1 || aParts[0].endsWith('.'))) return 0.85
    if (aLast === bLast && bParts[0].length === 1) return 0.85
  }
  // Too many edits
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 0
  const ratio = 1 - dist / maxLen
  return ratio >= 0.80 ? ratio : 0
}

export function extractLastName(fullName: string): string {
  const cleaned = fullName.replace(SUFFIXES, '').trim()
  const parts = cleaned.split(/\s+/)
  return parts[parts.length - 1] || cleaned
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

const SKIP_PHRASES = /^(New York|Los Angeles|San Francisco|San Diego|Kansas City|St Louis|Spring Training|World Series|All Star|National League|American League|Green Bay|Tampa Bay|New England|Las Vegas|New Orleans|San Antonio)$/i

/**
 * Extract player names from news text using sliding-window approach.
 * 1. Extract individual capitalized tokens (handles initials, apostrophes, hyphens)
 * 2. Generate all 2-word and 3-word sliding windows of adjacent tokens
 * This ensures "Michael Kopech" is always extracted even inside
 * "After Michael Kopech Lands on IL".
 */
export function extractPlayerNames(
  title: string,
  body: string | null,
  skipPhrases?: Set<string>,
): string[] {
  const text = decodeHtmlEntities(`${title} ${body || ''}`)

  // Step 1: Extract individual capitalized tokens with positions
  const tokenPattern = /[A-Z](?:\.[A-Z]\.?|[a-z]*'[A-Za-z][a-z]+|[a-z]+-[A-Z][a-z]+|[a-z]+)/g
  const tokens: { word: string; index: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = tokenPattern.exec(text)) !== null) {
    tokens.push({ word: m[0], index: m.index, end: m.index + m[0].length })
  }

  // Step 2: Generate 2-word and 3-word sliding windows (adjacent tokens only)
  const names = new Set<string>()

  for (let i = 0; i < tokens.length - 1; i++) {
    const gap1 = text.substring(tokens[i].end, tokens[i + 1].index)
    if (!/^\s+$/.test(gap1)) continue // not adjacent (comma, colon, etc.)

    const name2 = `${tokens[i].word} ${tokens[i + 1].word}`
    if (!SKIP_PHRASES.test(name2) && !skipPhrases?.has(name2.toLowerCase())) {
      names.add(name2)
    }

    if (i + 2 < tokens.length) {
      const gap2 = text.substring(tokens[i + 1].end, tokens[i + 2].index)
      if (/^\s+$/.test(gap2)) {
        const name3 = `${tokens[i].word} ${tokens[i + 1].word} ${tokens[i + 2].word}`
        if (!SKIP_PHRASES.test(name3) && !skipPhrases?.has(name3.toLowerCase())) {
          names.add(name3)
        }
      }
    }
  }

  return [...names]
}

/**
 * Infer sport code from a feed URL.
 * Used by RSS source fetchers to tag each item with its sport.
 */
export function inferSportFromUrl(url: string): 'MLB' | 'NBA' | 'NFL' | 'NHL' | null {
  const lower = url.toLowerCase()
  if (lower.includes('/mlb') || lower.includes('sport=mlb') || lower.includes('mlb+')) return 'MLB'
  if (lower.includes('/nba') || lower.includes('sport=nba') || lower.includes('nba+')) return 'NBA'
  if (lower.includes('/nfl') || lower.includes('sport=nfl') || lower.includes('nfl+')) return 'NFL'
  if (lower.includes('/nhl') || lower.includes('sport=nhl') || lower.includes('nhl+')) return 'NHL'
  return null
}
