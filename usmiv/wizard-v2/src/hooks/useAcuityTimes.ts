import { useState, useEffect, useCallback } from 'react';

export interface AcuityTime {
  time: string; // ISO datetime
  slotsAvailable: number;
}

interface UseAcuityTimesResult {
  times: AcuityTime[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAcuityTimes(
  proxyBase: string,
  appointmentTypeId: number,
  date: string | null, // YYYY-MM-DD
): UseAcuityTimesResult {
  const [times, setTimes] = useState<AcuityTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchToken, setFetchToken] = useState(0);

  const refetch = useCallback(() => {
    setFetchToken((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!proxyBase || !date) return;

    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetch(
      `${proxyBase}/api/acuity/availability/times?appointmentTypeID=${appointmentTypeId}&date=${encodeURIComponent(date)}`,
      { signal: controller.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`Acuity proxy returned ${r.status}`);
        return r.json() as Promise<AcuityTime[]>;
      })
      .then(setTimes)
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
  }, [proxyBase, appointmentTypeId, date, fetchToken]);

  return { times, loading, error, refetch };
}
