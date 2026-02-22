import type { RawNewsItem } from '../../../types'

interface MLBTransaction {
  id: number | string
  person?: { fullName?: string }
  typeDesc?: string
  description?: string
  date?: string
  fromTeam?: { name?: string }
  toTeam?: { name?: string }
}

interface MLBTransactionsResponse {
  transactions?: MLBTransaction[]
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function fetchMLBTransactions(): Promise<RawNewsItem[]> {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - 2 * 24 * 60 * 60 * 1000)

  const url =
    `https://statsapi.mlb.com/api/v1/transactions` +
    `?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const data: MLBTransactionsResponse = await res.json()
    const transactions = data.transactions ?? []

    return transactions.map((tx): RawNewsItem => {
      const personName = tx.person?.fullName ?? 'Unknown Player'
      const typeDesc = tx.typeDesc ?? 'Transaction'
      return {
        source: 'mlb_transactions',
        sourceId: String(tx.id ?? ''),
        title: `${typeDesc}: ${personName}`,
        body: tx.description ?? null,
        url: null,
        publishedAt: tx.date ?? null,
      }
    })
  } catch (err) {
    console.error('[MLBTransactions] Fetch failed:', err)
    return []
  }
}
