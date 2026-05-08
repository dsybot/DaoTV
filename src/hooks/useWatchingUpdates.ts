'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Reminder } from '@/lib/db.client';
import type { PlayRecord } from '@/lib/types';

const WATCHING_UPDATES_CACHE_KEY = 'moontv_watching_updates';

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

async function getOriginalEpisodes(
  record: PlayRecord & { key: string },
  recordKey: string,
): Promise<number> {
  console.log(`🔍 getOriginalEpisodes 调试信息 - ${record.title}:`, {
    recordOriginalEpisodes: record.original_episodes,
    recordTotalEpisodes: record.total_episodes,
    valueType: typeof record.original_episodes,
    record,
  });

  try {
    console.log(`🔍 从数据库读取最新的原始集数: ${record.title}`);
    const freshRecordsResponse = await fetch('/api/playrecords');
    if (freshRecordsResponse.ok) {
      const freshRecords = (await freshRecordsResponse.json()) as Record<
        string,
        PlayRecord
      >;
      const freshRecord = freshRecords[recordKey];

      if (freshRecord?.original_episodes && freshRecord.original_episodes > 0) {
        console.log(
          `📚 从数据库读取到最新原始集数: ${record.title} = ${freshRecord.original_episodes}集 (当前播放记录: ${record.total_episodes}集)`,
        );
        return freshRecord.original_episodes;
      }
    }
  } catch (error) {
    console.warn(
      `⚠️ 从数据库读取原始集数失败: ${record.title}，使用内存值`,
      error,
    );
  }

  if (record.original_episodes && record.original_episodes > 0) {
    console.log(
      `📚 使用内存中的原始集数: ${record.title} = ${record.original_episodes}集 (当前播放记录: ${record.total_episodes}集)`,
    );
    return record.original_episodes;
  }

  if (
    (record.original_episodes === undefined ||
      record.original_episodes === null) &&
    record.total_episodes > 0
  ) {
    console.log(
      `⚠️ ${record.title} 缺少原始集数，使用当前值 ${record.total_episodes}集（不写入数据库）`,
    );
    return record.total_episodes;
  }

  console.log(
    `⚠️ 该剧集未找到原始集数记录，使用当前播放记录集数: ${record.title} = ${record.total_episodes}集`,
  );
  return record.total_episodes;
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
    const cacheKey = Math.floor(Date.now() / 600000) * 600000;
    const apiUrl = `/api/detail?source=${sourceKey}&id=${videoId}&_t=${cacheKey}`;
    console.log(`🔍 [追番更新] ${record.title} 调用API:`, apiUrl);

    const response = await fetch(apiUrl, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn(`❌ [追番更新] 获取${record.title}详情失败:`, response.status);
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
    const latestEpisodes = detailData.episodes ? detailData.episodes.length : 0;

    console.log(`📊 [追番更新] ${record.title} API检查详情:`, {
      apiEpisodes: latestEpisodes,
      currentEpisode: record.index,
      playRecordEpisodes: record.total_episodes,
    });

    const originalTotalEpisodes = await getOriginalEpisodes(record, record.key);

    console.log(`📊 [追番更新] ${record.title} 集数对比:`, {
      originalTotalEpisodes,
      playRecordEpisodes: record.total_episodes,
      apiEpisodes: latestEpisodes,
    });

    const hasUpdate = latestEpisodes > originalTotalEpisodes;
    const newEpisodes = hasUpdate ? latestEpisodes - originalTotalEpisodes : 0;
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
      originalTotalEpisodes <= 1 && latestEpisodes > 1;

    if (latestEpisodes < originalTotalEpisodes) {
      console.warn(
        `⚠️ [追番更新] ${record.title} API返回集数(${latestEpisodes})少于原始记录(${originalTotalEpisodes})，可能是API缓存问题`,
      );
    }

    if (hasUpdate) {
      console.log(
        `✨ [追番更新] ${record.title} 发现新集数: ${originalTotalEpisodes} -> ${latestEpisodes} 集，新增${newEpisodes}集`,
      );

      if (latestEpisodes > record.total_episodes) {
        console.log(
          `📊 [追番更新] 检测到集数差异: ${record.title} 播放记录${record.total_episodes}集 < API最新${latestEpisodes}集`,
        );
        console.log(
          '✅ [追番更新] 已记录新集数信息，等待用户实际观看时自动同步',
        );
      }
    }

    if (hasContinueWatching) {
      console.log(
        `📺 [追番更新] ${record.title} 继续观看提醒: 当前第${record.index}集，共${protectedTotalEpisodes}集，还有${remainingEpisodes}集未看`,
      );
    }

    console.log(`✓ [追番更新] ${record.title} 最终检测结果:`, {
      hasUpdate,
      hasContinueWatching,
      newEpisodes,
      remainingEpisodes,
      originalTotalEpisodes,
      playRecordEpisodes: record.total_episodes,
      apiEpisodes: latestEpisodes,
      protectedTotalEpisodes,
      currentEpisode: record.index,
    });

    return {
      hasUpdate,
      hasNewEpisode: hasUpdate,
      hasContinueWatching,
      hasNewRelease,
      newEpisodes,
      remainingEpisodes,
      latestEpisodes: protectedTotalEpisodes,
    };
  } catch (error) {
    console.error(`❌ [追番更新] 检查${record.title}更新失败:`, error);
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
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [
      'watchingUpdates',
      options?.forceRefresh ? Date.now() : 'cached',
    ] as const,
    queryFn: async (): Promise<WatchingUpdate> => {
      console.log('🔄 [追番更新] 开始检查追番更新...');

      const playRecordsArray = await queryClient.ensureQueryData({
        queryKey: ['playRecords', 'array'],
        queryFn: async () => {
          const response = await fetch('/api/playrecords');
          if (!response.ok) {
            throw new Error('Failed to fetch play records');
          }

          const data = (await response.json()) as Record<string, PlayRecord>;
          return Object.entries(data)
            .map(([key, record]) => ({ ...record, key }))
            .sort((a, b) => (b.save_time || 0) - (a.save_time || 0));
        },
      });

      const sourceMap = await queryClient.ensureQueryData({
        queryKey: ['sources', 'map'],
        queryFn: async () => {
          const response = await fetch('/api/sources');
          if (!response.ok) {
            throw new Error('Failed to fetch sources');
          }

          const sources = (await response.json()) as Array<{
            key?: string;
            name?: string;
          }>;
          const map = new Map<string, string>();

          sources.forEach((source) => {
            if (source.key) {
              map.set(source.key, source.key);
            }
            if (source.name && source.key) {
              map.set(source.name, source.key);
            }
          });

          return map;
        },
      });

      const reminders = await queryClient.ensureQueryData({
        queryKey: ['reminders'],
        queryFn: async () => {
          const response = await fetch('/api/reminders');
          if (!response.ok) {
            throw new Error('Failed to fetch reminders');
          }
          return (await response.json()) as Record<string, Reminder>;
        },
      });

      let updatedCount = 0;
      let continueWatchingCount = 0;
      let newReleasesCount = 0;
      const updatedSeries: WatchingUpdate['updatedSeries'] = [];

      if (!playRecordsArray || playRecordsArray.length === 0) {
        console.log('⚠️ [追番更新] 无播放记录，跳过播放记录更新检查');
      } else {
        console.log(`📋 [追番更新] 找到 ${playRecordsArray.length} 条播放记录`);

        const candidateRecords = playRecordsArray.filter(
          (record) => record.total_episodes > 1,
        );

        console.log(
          `🎯 [追番更新] 找到 ${candidateRecords.length} 个可能有更新的剧集`,
        );
        if (candidateRecords.length > 0) {
          console.log(
            '[追番更新] 候选记录详情:',
            candidateRecords.map((record) => ({
              title: record.title,
              index: record.index,
              total: record.total_episodes,
            })),
          );
        }

        if (candidateRecords.length > 0) {
          await Promise.all(
            candidateRecords.map(async (record) => {
              try {
                const [sourceName, videoId] = record.key.split('+');
                let sourceKey = sourceName;
                const mappedSource = sourceMap.get(sourceName);

                if (mappedSource) {
                  sourceKey = mappedSource;
                  console.log(`[追番更新] 映射数据源: ${sourceName} -> ${sourceKey}`);
                }
                // 如果找不到映射，说明 sourceName 本身就是 API key，直接使用

                const updateInfo = await checkSingleRecordUpdate(
                  record,
                  videoId,
                  sourceKey,
                );

                const seriesInfo = {
                  title: record.title,
                  source_name: record.source_name,
                  year: record.year,
                  cover: record.cover,
                  sourceKey,
                  videoId,
                  douban_id: record.douban_id,
                  currentEpisode: record.index,
                  totalEpisodes: updateInfo.latestEpisodes,
                  hasNewEpisode: updateInfo.hasNewEpisode,
                  hasContinueWatching: updateInfo.hasContinueWatching,
                  hasNewRelease: updateInfo.hasNewRelease,
                  newEpisodes: updateInfo.newEpisodes,
                  remainingEpisodes: updateInfo.remainingEpisodes,
                  latestEpisodes: updateInfo.latestEpisodes,
                  remarks: record.remarks,
                };

                updatedSeries.push(seriesInfo);

                if (updateInfo.hasNewEpisode) {
                  updatedCount += 1;
                }
                if (updateInfo.hasContinueWatching) {
                  continueWatchingCount += 1;
                  console.log(
                    `[追番更新] ${record.title} 计入继续观看计数，当前总数: ${continueWatchingCount}`,
                  );
                }
                if (updateInfo.hasNewRelease) {
                  newReleasesCount += 1;
                }

                console.log(
                  `[追番更新] ${record.title} 检查结果: hasUpdate=${updateInfo.hasUpdate}, hasContinueWatching=${updateInfo.hasContinueWatching}`,
                );
              } catch (error) {
                console.error(`[追番更新] 检查${record.title}更新失败:`, error);

                const [sourceName, videoId] = record.key.split('+');
                const sourceKey = sourceMap.get(sourceName) || sourceName;

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
                  hasNewEpisode: false,
                  hasContinueWatching: false,
                  hasNewRelease: false,
                  newEpisodes: 0,
                  remainingEpisodes: 0,
                  latestEpisodes: record.total_episodes,
                  remarks: record.remarks,
                });
              }
            }),
          );
        }
      }

      console.log('🎬 开始检查想看中的新上映内容...');
      try {
        if (reminders) {
          const today = new Date()
            .toLocaleDateString('zh-CN', {
              timeZone: 'Asia/Shanghai',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            })
            .replace(/\//g, '-');

          const newReleases = Object.entries(reminders)
            .filter(([, reminder]) => {
              if (!reminder.releaseDate) {
                return false;
              }
              if (reminder.releaseDate > today) {
                return false;
              }

              const isInPlayRecords = playRecordsArray?.some(
                (record) =>
                  record.title === reminder.title &&
                  record.year === reminder.year,
              );

              return !isInPlayRecords;
            })
            .map(([key, reminder]) => {
              const [sourceName, videoId] = key.split('+');
              let remarksText = '已上映';

              if (reminder.releaseDate) {
                if (reminder.releaseDate < today) {
                  const releaseParts = reminder.releaseDate
                    .split('-')
                    .map(Number);
                  const todayParts = today.split('-').map(Number);
                  const releaseMs = new Date(
                    releaseParts[0],
                    releaseParts[1] - 1,
                    releaseParts[2],
                  ).getTime();
                  const todayMs = new Date(
                    todayParts[0],
                    todayParts[1] - 1,
                    todayParts[2],
                  ).getTime();
                  const daysAgo = Math.floor(
                    (todayMs - releaseMs) / (1000 * 60 * 60 * 24),
                  );
                  remarksText = `已上映${daysAgo}天`;
                } else if (reminder.releaseDate === today) {
                  remarksText = '今日上映';
                }
              }

              return {
                title: reminder.title,
                source_name: reminder.source_name,
                year: reminder.year,
                cover: reminder.cover,
                sourceKey: sourceName || 'unknown',
                videoId: videoId || 'unknown',
                currentEpisode: 0,
                totalEpisodes: reminder.total_episodes || 0,
                hasNewEpisode: false,
                hasContinueWatching: false,
                hasNewRelease: true,
                newEpisodes: 0,
                remainingEpisodes: 0,
                latestEpisodes: reminder.total_episodes || 0,
                remarks: remarksText,
                releaseDate: reminder.releaseDate,
              };
            });

          if (newReleases.length > 0) {
            console.log(
              `🎬 [追番更新] 发现 ${newReleases.length} 部新上映的想看内容`,
            );
            updatedSeries.push(...newReleases);
            newReleasesCount = newReleases.length;
          } else {
            console.log('🎬 [追番更新] 没有新上映的想看内容');
          }
        }
      } catch (error) {
        console.error('[追番更新] 检查新上映内容失败:', error);
      }

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

      const hasUpdates =
        updatedCount > 0 || continueWatchingCount > 0 || newReleasesCount > 0;

      console.log(
        `✅ [追番更新] 检查完成: ${
          hasUpdates
            ? `发现${newReleasesCount}部新上映，${updatedCount}部剧集有新集数更新，${continueWatchingCount}部剧集需要继续观看`
            : '暂无更新'
        }`,
      );

      const result = {
        hasUpdates,
        timestamp: Date.now(),
        updatedCount,
        continueWatchingCount,
        newReleasesCount,
        updatedSeries,
      };

      try {
        if (typeof window !== 'undefined' && localStorage) {
          localStorage.setItem(
            WATCHING_UPDATES_CACHE_KEY,
            JSON.stringify(result),
          );
          console.log('[追番更新] 结果已保存到 localStorage');
        }
      } catch (error) {
        console.warn('[追番更新] 保存到 localStorage 失败:', error);
      }

      return result;
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    refetchIntervalInBackground: false,
    initialData: () => {
      try {
        if (typeof window !== 'undefined' && localStorage) {
          const cached = localStorage.getItem(WATCHING_UPDATES_CACHE_KEY);
          if (cached) {
            const data = JSON.parse(cached) as WatchingUpdate;
            console.log('[追番更新] 从 localStorage 加载缓存数据');
            return data;
          }
        }
      } catch (error) {
        console.warn('[追番更新] 从 localStorage 读取失败:', error);
      }
      return undefined;
    },
    enabled: options?.enabled !== false,
    retry: false,
  });
}

export function useRefreshWatchingUpdates() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({
      queryKey: ['playRecords'],
      refetchType: 'all',
    });
    queryClient.invalidateQueries({
      queryKey: ['reminders'],
      refetchType: 'all',
    });
    queryClient.invalidateQueries({
      queryKey: ['watchingUpdates'],
      refetchType: 'all',
    });
  };
}
