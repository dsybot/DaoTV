'use client';

import { useQueries, UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';

interface TMDBData {
  backdrop: string | null;
  poster: string | null;
  logo: string | null;
  title: string | null;
  overview: string | null;
  rating: number | null;
  year: string | null;
  numberOfSeasons: number | null;
}

interface TMDBLogoItem {
  title: string;
  year?: string;
  type?: string;
}

async function fetchTMDBData(
  title: string,
  year?: string,
  type?: string,
): Promise<TMDBData | null> {
  const params = new URLSearchParams({ title });
  if (year) params.set('year', year);
  if (type) params.set('stype', type);

  const res = await fetch(`/api/tmdb/backdrop?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data || null;
}

export function useTMDBLogos(
  items: TMDBLogoItem[],
  options?: { enabled?: boolean },
): Record<string, string | null> {
  const combine = useCallback(
    (results: UseQueryResult<TMDBData | null>[]) => {
      const logosMap: Record<string, string | null> = {};
      items.forEach((item, index) => {
        const result = results[index];
        logosMap[item.title] = result.data?.logo || null;
      });
      return logosMap;
    },
    [items],
  );

  return useQueries({
    queries: items.map((item) => ({
      queryKey: ['tmdb-logo', item.title, item.year, item.type],
      queryFn: () => fetchTMDBData(item.title, item.year, item.type),
      staleTime: 0,
      gcTime: 7 * 24 * 60 * 60 * 1000,
      retry: 1,
      enabled: options?.enabled !== false && !!item.title,
    })),
    combine,
  });
}
