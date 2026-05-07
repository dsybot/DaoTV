/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { queryOptions, useQuery } from '@tanstack/react-query';

import { useWatchingUpdatesQuery as useWatchingUpdates } from './useWatchingUpdates';

const continueWatchingOptions = () =>
  queryOptions({
    queryKey: ['playRecords', 'continueWatching'],
    queryFn: async () => {
      const response = await fetch('/api/playrecords');
      if (!response.ok) {
        throw new Error(`Failed to fetch play records: ${response.status}`);
      }

      const allRecords = await response.json();
      const recordsArray = Object.entries(allRecords).map(
        ([key, record]: [string, any]) => ({
          ...record,
          key,
        }),
      );

      return recordsArray.sort((a, b) => b.save_time - a.save_time);
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export function useContinueWatchingQuery() {
  return useQuery(continueWatchingOptions());
}

export function useWatchingUpdatesQuery(options?: { enabled?: boolean }) {
  return useWatchingUpdates(options);
}
