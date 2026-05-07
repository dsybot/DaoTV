'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';

import type { Reminder } from '@/lib/db.client';

export const remindersQueryOptions = queryOptions({
  queryKey: ['reminders'] as const,
  queryFn: async (): Promise<Record<string, Reminder>> => {
    const response = await fetch('/api/reminders');
    if (!response.ok) {
      throw new Error(`Failed to fetch reminders: ${response.status}`);
    }
    return (await response.json()) as Record<string, Reminder>;
  },
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 1,
});

export function useRemindersQuery(options?: { enabled?: boolean }) {
  return useQuery({
    ...remindersQueryOptions,
    enabled: options?.enabled,
  });
}

export function useRemindersArrayQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['reminders', 'array'] as const,
    queryFn: async () => {
      const response = await fetch('/api/reminders');
      if (!response.ok) {
        throw new Error(`Failed to fetch reminders: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, Reminder>;
      const remindersArray = Object.entries(data).map(([key, reminder]) => ({
        ...reminder,
        key,
      }));

      return remindersArray.sort((a, b) => {
        const dateA = new Date(a.releaseDate).getTime();
        const dateB = new Date(b.releaseDate).getTime();
        return dateA - dateB;
      });
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: options?.enabled,
  });
}

export function useIsRemindedQuery(
  source: string,
  id: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['reminders', 'check', source, id] as const,
    queryFn: async () => {
      const response = await fetch('/api/reminders');
      if (!response.ok) {
        throw new Error(`Failed to fetch reminders: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, Reminder>;
      return !!data[`${source}+${id}`];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: options?.enabled,
  });
}
