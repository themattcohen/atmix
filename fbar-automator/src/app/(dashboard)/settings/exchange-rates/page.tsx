"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, RefreshCw, DollarSign } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

interface ExchangeRate {
  currencyCode: string
  countryName: string
  rate: number
}

export default function ExchangeRatesPage() {
  const [year, setYear] = useState(new Date().getFullYear() - 1)
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const fetchRates = useCallback(async (targetYear: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange-rates?year=${targetYear}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to fetch rates.")
      }
      const data = await res.json()
      setRates(data.rates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rates.")
      setRates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRates(year)
  }, [year, fetchRates])

  async function handleSync() {
    setSyncing(true)
    setSyncMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to sync rates.")
      }
      const data = await res.json()
      setSyncMessage(`Successfully synced ${data.ratesSynced} rates for ${year}.`)
      await fetchRates(year)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.")
    } finally {
      setSyncing(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Exchange Rates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Treasury exchange rates used for FBAR USD conversion (Dec 31 rates).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-gray-500" />
              Rates for {year}
            </CardTitle>
            <div className="flex items-center gap-3">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm"
                aria-label="Select year"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                )}
                Sync Rates
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {syncMessage && (
            <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800" role="alert">
              {syncMessage}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : rates.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No exchange rates found for {year}. Click &quot;Sync Rates&quot; to fetch from Treasury.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 pr-4 font-medium text-gray-500">Currency</th>
                    <th className="pb-2 pr-4 font-medium text-gray-500">Country</th>
                    <th className="pb-2 font-medium text-gray-500 text-right">Rate (per USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rates.map((rate) => (
                    <tr key={rate.currencyCode}>
                      <td className="py-2 pr-4 font-mono text-gray-900">{rate.currencyCode}</td>
                      <td className="py-2 pr-4 text-gray-600">{rate.countryName}</td>
                      <td className="py-2 text-right font-mono text-gray-600">
                        {rate.rate.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-gray-400">
            {rates.length} rate{rates.length !== 1 ? "s" : ""} loaded
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
