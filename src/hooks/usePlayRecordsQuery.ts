'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';

import type { PlayRecord } from '@/lib/types';

export const playRecordsQueryOptions = queryOptions({
  queryKey: ['playRecords'] as const,
  queryFn: async (): Promise<Record<string, PlayRecord>> => {
    const response = await fetch('/api/playrecords');
    if (!response.ok) {
      throw new Error(`Failed to fetch play records: ${response.status}`);
    }
    return (await response.json()) as Record<string, PlayRecord>;
  },
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 1,
});

export function usePlayRecordsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    ...playRecordsQueryOptions,
    enabled: options?.enabled,
  });
}

export function usePlayRecordsArrayQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['playRecords', 'array'] as const,
    queryFn: async () => {
      const response = await fetch('/api/playrecords');
      if (!response.ok) {
        throw new Error(`Failed to fetch play records: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, PlayRecord>;
      const recordsArray = Object.entries(data).map(([key, record]) => ({
        ...record,
        key,
      }));

      return recordsArray.sort((a, b) => b.save_time - a.save_time);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: options?.enabled,
  });
}

export function usePlayRecordQuery(
  source: string,
  id: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['playRecords', 'single', source, id] as const,
    queryFn: async () => {
      const response = await fetch('/api/playrecords');
      if (!response.ok) {
        throw new Error(`Failed to fetch play records: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, PlayRecord>;
      return data[`${source}+${id}`] || null;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: options?.enabled,
  });
}
