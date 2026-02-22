import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { pollBatch, processBatchResults } from '@/lib/ai/title-parser'

export async function GET(
  _request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const result = await pollBatch(params.batchId)
    return routeOk(result)
  } catch (err) {
    return routeError(err)
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const result = await processBatchResults(params.batchId)
    return routeOk(result)
  } catch (err) {
    return routeError(err)
  }
}
