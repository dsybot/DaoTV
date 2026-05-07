'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';

import type { Favorite } from '@/lib/types';

export const favoritesQueryOptions = queryOptions({
  queryKey: ['favorites'] as const,
  queryFn: async (): Promise<Record<string, Favorite>> => {
    const response = await fetch('/api/favorites');
    if (!response.ok) {
      throw new Error(`Failed to fetch favorites: ${response.status}`);
    }
    return (await response.json()) as Record<string, Favorite>;
  },
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 1,
});

export function useFavoritesQuery(options?: { enabled?: boolean }) {
  return useQuery({
    ...favoritesQueryOptions,
    enabled: options?.enabled,
  });
}

export function useFavoritesArrayQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['favorites', 'array'] as const,
    queryFn: async () => {
      const response = await fetch('/api/favorites');
      if (!response.ok) {
        throw new Error(`Failed to fetch favorites: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, Favorite>;
      const favoritesArray = Object.entries(data).map(([key, favorite]) => ({
        ...favorite,
        key,
      }));

      return favoritesArray.sort((a, b) => b.save_time - a.save_time);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: options?.enabled,
  });
}

export function useIsFavoritedQuery(
  source: string,
  id: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['favorites', 'check', source, id] as const,
    queryFn: async () => {
      const response = await fetch('/api/favorites');
      if (!response.ok) {
        throw new Error(`Failed to fetch favorites: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, Favorite>;
      return !!data[`${source}+${id}`];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: options?.enabled,
  });
}
