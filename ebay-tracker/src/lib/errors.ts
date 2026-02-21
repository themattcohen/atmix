export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 500
  ) { super(message) }
}

export class EbayApiError extends AppError {
  constructor(message: string, public readonly retryable = true) {
    super('EBAY_API_ERROR', message, 502)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super('DATABASE_ERROR', message, 500)
  }
}

// Route handler helpers — every API route uses these
export function routeOk<T>(data: T): Response {
  return Response.json({ data }, { status: 200 })
}

export function routeError(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: { code: err.code, message: err.message } },
      { status: err.httpStatus }
    )
  }
  return Response.json(
    { error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

// Retry utility for eBay API calls
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn() }
    catch (err) {
      lastErr = err
      if (attempt < maxAttempts)
        await new Promise(r => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)))
    }
  }
  throw lastErr
}
