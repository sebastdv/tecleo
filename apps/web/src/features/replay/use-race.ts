'use client';

import { useQuery } from '@tanstack/react-query';
import { raceDetailSchema } from '@tecleo/shared';

import { ApiError, fetchApi } from '@/lib/api';

/** La carrera a la que pertenece un resultado, con las pulsaciones de cada persona. */
export function useRaceOfResult(resultId: string) {
  return useQuery({
    queryKey: ['race-of-result', resultId],
    queryFn: () => fetchApi(`/races/by-result/${encodeURIComponent(resultId)}`, raceDetailSchema),
    retry: (count, error) =>
      !(error instanceof ApiError && (error.status === 404 || error.status === 400)) && count < 2,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
