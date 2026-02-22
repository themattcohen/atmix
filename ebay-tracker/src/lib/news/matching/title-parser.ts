const BRAND_PATTERN =
  /\b(Topps|Bowman|Panini|Prizm|Select|Donruss|Upper\s+Deck|Leaf|Fleer|Score|Absolute|Spectra|National\s+Treasures|Immaculate|Optic|Mosaic|Chronicles|Contenders)\b/gi

const ATTRIBUTE_PATTERN =
  /\b(PSA|BGS|SGC|CGC|HGA|AUTO|RC|ROOKIE|REFRACTOR|CHROME|SILVER|GOLD|PATCH|JERSEY|RELIC|NUMBERED|PARALLEL|INSERT|BASE|HOBBY|RETAIL|MEGA|BLASTER|JUMBO|CARD|CARDS|LOT|MINT|GEM|HOLO|FOIL|ACETATE|DIE[\s-]?CUT|SSP|SP|VARIATION|CASE|HIT|BREAK|PACK|BOX|SAPPHIRE|ORANGE|RED|BLUE|GREEN|PURPLE|PINK|BLACK|WHITE|YELLOW|AQUA|TEAL|CAMO)\b/gi

const GRADE_PATTERN = /\b(PSA|BGS|SGC|CGC|HGA)\s*\d+(\.\d+)?/gi

const SERIAL_NUMBER_PATTERN = /\/\d+|#\d+/g

const YEAR_PATTERN = /\b(19|20)\d{2}\b/g

const TITLE_CASE_WORD = /[A-Z][a-z]+/g

export function parsePlayerFromTitle(title: string): string | null {
  let cleaned = title
  cleaned = cleaned.replace(GRADE_PATTERN, ' ')
  cleaned = cleaned.replace(BRAND_PATTERN, ' ')
  cleaned = cleaned.replace(ATTRIBUTE_PATTERN, ' ')
  cleaned = cleaned.replace(SERIAL_NUMBER_PATTERN, ' ')
  cleaned = cleaned.replace(YEAR_PATTERN, ' ')

  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()

  // Normalize ALL-CAPS words to Title Case: "MIKE TROUT" → "Mike Trout"
  cleaned = cleaned.replace(/\b([A-Z]{2,})\b/g, (m) => m[0] + m.slice(1).toLowerCase())

  // Rebuild as array of { word, index } for consecutive run detection
  const wordPositions: { word: string; index: number }[] = []
  const re2 = new RegExp(TITLE_CASE_WORD.source, 'g')
  let m2: RegExpExecArray | null
  while ((m2 = re2.exec(cleaned)) !== null) {
    wordPositions.push({ word: m2[0], index: m2.index })
  }

  if (wordPositions.length === 0) return null

  // Lowercase name particles that can bridge two Title-Case runs into one name
  const NAME_PARTICLES = /^(de|la|van|von|del|di|el|al|jr|sr|ii|iii)$/i

  // Find runs of consecutive title-case words (adjacent after whitespace only)
  // Two words are "consecutive" if there is only whitespace between them,
  // OR if there is only whitespace + a lowercase name particle between them.
  const runs: string[][] = []
  let currentRun: string[] = [wordPositions[0].word]
  let prevEnd = wordPositions[0].index + wordPositions[0].word.length

  for (let i = 1; i < wordPositions.length; i++) {
    const gap = cleaned.slice(prevEnd, wordPositions[i].index)
    const gapTrimmed = gap.trim()
    if (/^\s+$/.test(gap)) {
      // Adjacent Title-Case words — same run
      currentRun.push(wordPositions[i].word)
    } else if (NAME_PARTICLES.test(gapTrimmed)) {
      // A lowercase particle bridges the two Title-Case words — include it and continue
      currentRun.push(gapTrimmed, wordPositions[i].word)
    } else {
      runs.push(currentRun)
      currentRun = [wordPositions[i].word]
    }
    prevEnd = wordPositions[i].index + wordPositions[i].word.length
  }
  runs.push(currentRun)

  // Filter to runs of 2+ words
  const candidates = runs.filter(r => r.length >= 2)
  if (candidates.length === 0) return null

  // Return the longest run joined as a name
  const longest = candidates.reduce((a, b) => (b.length > a.length ? b : a))
  return longest.join(' ')
}
