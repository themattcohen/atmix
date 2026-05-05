import { useState, useEffect, useCallback } from 'react';

export interface AcuityDate {
  date: string; // YYYY-MM-DD
}

interface UseAcuityDatesResult {
  dates: AcuityDate[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAcuityDates(
  proxyBase: string,
  appointmentTypeId: number,
  month: string, // YYYY-MM
): UseAcuityDatesResult {
  const [dates, setDates] = useState<AcuityDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchToken, setFetchToken] = useState(0);

  const refetch = useCallback(() => {
    setFetchToken((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!proxyBase) return;

    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetch(
      `${proxyBase}/acuity/dates?appointmentTypeID=${appointmentTypeId}&month=${encodeURIComponent(month)}`,
      { signal: controller.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`Acuity proxy returned ${r.status}`);
        return r.json() as Promise<AcuityDate[]>;
      })
      .then(setDates)
      .catch((e: Error) => {
        if (e.name !== 'AbortError') {
          setError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [proxyBase, appointmentTypeId, month, fetchToken]);

  return { dates, loading, error, refetch };
}
