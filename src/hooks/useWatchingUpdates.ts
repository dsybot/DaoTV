'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { PlayRecord } from '@/lib/types';

import { usePlayRecordsArrayQuery } from './usePlayRecordsQuery';
import { useSourceMapQuery } from './useSourcesQuery';

export interface WatchingUpdate {
  hasUpdates: boolean;
  timestamp: number;
  updatedCount: number;
  continueWatchingCount: number;
  newReleasesCount: number;
  updatedSeries: {
    title: string;
    source_name: string;
    year: string;
    cover: string;
    sourceKey: string;
    videoId: string;
    douban_id?: number;
    currentEpisode: number;
    totalEpisodes: number;
    hasNewEpisode: boolean;
    hasContinueWatching: boolean;
    hasNewRelease: boolean;
    newEpisodes?: number;
    remainingEpisodes?: number;
    latestEpisodes?: number;
    remarks?: string;
    releaseDate?: string;
  }[];
}

async function checkSingleRecordUpdate(
  record: PlayRecord & { key: string },
  videoId: string,
  sourceKey: string,
): Promise<{
  hasUpdate: boolean;
  hasNewEpisode: boolean;
  hasContinueWatching: boolean;
  hasNewRelease: boolean;
  newEpisodes: number;
  remainingEpisodes: number;
  latestEpisodes: number;
}> {
  try {
    const response = await fetch(`/api/detail?source=${sourceKey}&id=${videoId}`);
    if (!response.ok) {
      console.warn(`获取${record.title}详情失败:`, response.status);
      return {
        hasUpdate: false,
        hasNewEpisode: false,
        hasContinueWatching: false,
        hasNewRelease: false,
        newEpisodes: 0,
        remainingEpisodes: 0,
        latestEpisodes: record.total_episodes,
      };
    }

    const detailData = await response.json();
    const latestEpisodes =
      detailData.total || detailData.episodes?.length || record.total_episodes;
    const originalTotalEpisodes =
      record.original_episodes || record.total_episodes;
    const hasNewEpisode = latestEpisodes > originalTotalEpisodes;
    const newEpisodes = hasNewEpisode
      ? latestEpisodes - originalTotalEpisodes
      : 0;
    const protectedTotalEpisodes = Math.max(
      latestEpisodes,
      originalTotalEpisodes,
      record.total_episodes,
    );
    const hasContinueWatching = record.index < protectedTotalEpisodes;
    const remainingEpisodes = hasContinueWatching
      ? protectedTotalEpisodes - record.index
      : 0;
    const hasNewRelease =
      originalTotalEpisodes <= 1 && protectedTotalEpisodes > 1;

    return {
      hasUpdate: hasNewEpisode || hasContinueWatching || hasNewRelease,
      hasNewEpisode,
      hasContinueWatching,
      hasNewRelease,
      newEpisodes,
      remainingEpisodes,
      latestEpisodes: protectedTotalEpisodes,
    };
  } catch (error) {
    console.error(`检查${record.title}更新失败:`, error);
    return {
      hasUpdate: false,
      hasNewEpisode: false,
      hasContinueWatching: false,
      hasNewRelease: false,
      newEpisodes: 0,
      remainingEpisodes: 0,
      latestEpisodes: record.total_episodes,
    };
  }
}

export function useWatchingUpdatesQuery(options?: {
  enabled?: boolean;
  forceRefresh?: boolean;
}) {
  const { data: playRecordsArray } = usePlayRecordsArrayQuery({
    enabled: options?.enabled,
  });
  const { data: sourceMap } = useSourceMapQuery({
    enabled: options?.enabled,
  });

  return useQuery({
    queryKey: [
      'watchingUpdates',
      options?.forceRefresh ? Date.now() : 'cached',
    ] as const,
    queryFn: async (): Promise<WatchingUpdate> => {
      if (!playRecordsArray || playRecordsArray.length === 0) {
        return {
          hasUpdates: false,
          timestamp: Date.now(),
          updatedCount: 0,
          continueWatchingCount: 0,
          newReleasesCount: 0,
          updatedSeries: [],
        };
      }

      const candidateRecords = playRecordsArray.filter((record) => {
        if (record.play_time < 120) return false;
        if (record.total_episodes <= 1) return false;
        return true;
      });

      let updatedCount = 0;
      let continueWatchingCount = 0;
      let newReleasesCount = 0;
      const updatedSeries: WatchingUpdate['updatedSeries'] = [];

      await Promise.all(
        candidateRecords.map(async (record) => {
          const [sourceName, videoId] = record.key.split('+');
          const sourceKey = sourceMap?.get(sourceName) || sourceName;
          const updateInfo = await checkSingleRecordUpdate(
            record,
            videoId,
            sourceKey,
          );

          if (updateInfo.hasNewEpisode) updatedCount += 1;
          if (updateInfo.hasContinueWatching) continueWatchingCount += 1;
          if (updateInfo.hasNewRelease) newReleasesCount += 1;

          if (updateInfo.hasUpdate) {
            updatedSeries.push({
              title: record.title,
              source_name: record.source_name,
              year: record.year,
              cover: record.cover,
              sourceKey,
              videoId,
              douban_id: record.douban_id,
              currentEpisode: record.index,
              totalEpisodes: record.total_episodes,
              hasNewEpisode: updateInfo.hasNewEpisode,
              hasContinueWatching: updateInfo.hasContinueWatching,
              hasNewRelease: updateInfo.hasNewRelease,
              newEpisodes: updateInfo.newEpisodes,
              remainingEpisodes: updateInfo.remainingEpisodes,
              latestEpisodes: updateInfo.latestEpisodes,
              remarks: record.remarks,
            });
          }
        }),
      );

      updatedSeries.sort((a, b) => {
        if (a.hasNewRelease !== b.hasNewRelease) {
          return a.hasNewRelease ? -1 : 1;
        }
        if (a.hasNewEpisode !== b.hasNewEpisode) {
          return a.hasNewEpisode ? -1 : 1;
        }
        if (a.hasContinueWatching !== b.hasContinueWatching) {
          return a.hasContinueWatching ? -1 : 1;
        }
        return a.title.localeCompare(b.title, 'zh-CN');
      });

      return {
        hasUpdates:
          updatedCount > 0 ||
          continueWatchingCount > 0 ||
          newReleasesCount > 0,
        timestamp: Date.now(),
        updatedCount,
        continueWatchingCount,
        newReleasesCount,
        updatedSeries,
      };
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: options?.enabled && !!playRecordsArray && !!sourceMap,
    retry: false,
  });
}

export function useRefreshWatchingUpdates() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['playRecords'] });
    queryClient.invalidateQueries({ queryKey: ['watchingUpdates'] });
  };
}
