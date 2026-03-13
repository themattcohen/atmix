interface MetricsStore {
  requestCount: number;
  errorCount: number;
  totalDurationMs: number;
  startedAt: number;
}

export const metrics: MetricsStore = {
  requestCount: 0,
  errorCount: 0,
  totalDurationMs: 0,
  startedAt: Date.now(),
};

export function recordRequest(durationMs: number, isError: boolean): void {
  metrics.requestCount++;
  metrics.totalDurationMs += durationMs;
  if (isError) metrics.errorCount++;
}
