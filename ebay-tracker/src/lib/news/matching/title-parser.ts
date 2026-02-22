const BRAND_PATTERN =
  /\b(Topps|Bowman|Panini|Prizm|Select|Donruss|Upper\s+Deck|Leaf|Fleer|Score|Absolute|Spectra|National\s+Treasures|Immaculate|Optic|Mosaic|Chronicles|Contenders)\b/gi

const ATTRIBUTE_PATTERN =
  /\b(PSA|BGS|SGC|CGC|HGA|AUTO|RC|ROOKIE|REFRACTOR|CHROME|SILVER|GOLD|PATCH|JERSEY|RELIC|NUMBERED|PARALLEL|INSERT|BASE|HOBBY|RETAIL|MEGA|BLASTER|JUMBO)\b/gi

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

  // Find all Title-Case words
  const words: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(TITLE_CASE_WORD.source, 'g')

  while ((match = re.exec(cleaned)) !== null) {
    words.push({ word: match[0], index: match.index } as any)
  }

  // Rebuild as array of { word, index } for consecutive run detection
  const wordPositions: { word: string; index: number }[] = []
  const re2 = new RegExp(TITLE_CASE_WORD.source, 'g')
  let m2: RegExpExecArray | null
  while ((m2 = re2.exec(cleaned)) !== null) {
    wordPositions.push({ word: m2[0], index: m2.index })
  }

  if (wordPositions.length === 0) return null

  // Find runs of consecutive title-case words (adjacent after whitespace only)
  // Two words are "consecutive" if there is only whitespace between them
  const runs: string[][] = []
  let currentRun: string[] = [wordPositions[0].word]
  let prevEnd = wordPositions[0].index + wordPositions[0].word.length

  for (let i = 1; i < wordPositions.length; i++) {
    const gap = cleaned.slice(prevEnd, wordPositions[i].index)
    if (/^\s+$/.test(gap)) {
      currentRun.push(wordPositions[i].word)
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
