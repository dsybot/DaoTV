'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';

export interface Source {
  key: string;
  name: string;
  [key: string]: unknown;
}

export const sourcesQueryOptions = queryOptions({
  queryKey: ['sources'] as const,
  queryFn: async (): Promise<Source[]> => {
    const response = await fetch('/api/sources');
    if (!response.ok) {
      throw new Error(`Failed to fetch sources: ${response.status}`);
    }
    return (await response.json()) as Source[];
  },
  staleTime: 10 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: 1,
});

export function useSourcesQuery(options?: { enabled?: boolean }) {
  return useQuery({
    ...sourcesQueryOptions,
    enabled: options?.enabled,
  });
}

export function useSourceMapQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['sources', 'map'] as const,
    queryFn: async () => {
      const response = await fetch('/api/sources');
      if (!response.ok) {
        throw new Error(`Failed to fetch sources: ${response.status}`);
      }

      const sources = (await response.json()) as Source[];
      const sourceMap = new Map<string, string>();

      sources.forEach((source) => {
        if (source?.key) {
          sourceMap.set(source.key, source.key);
        }
        if (source?.name && source?.key) {
          sourceMap.set(source.name, source.key);
        }
      });

      return sourceMap;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    enabled: options?.enabled,
  });
}

export function useSourceByKeyQuery(
  sourceKey: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['sources', 'byKey', sourceKey] as const,
    queryFn: async () => {
      const response = await fetch('/api/sources');
      if (!response.ok) {
        throw new Error(`Failed to fetch sources: ${response.status}`);
      }

      const sources = (await response.json()) as Source[];
      return sources.find((source) => source.key === sourceKey) || null;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    enabled: options?.enabled && !!sourceKey,
  });
}
