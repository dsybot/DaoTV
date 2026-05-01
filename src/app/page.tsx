/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

import { Suspense } from 'react';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/get-query-client';
import { getConfig } from '@/lib/config';
import { getDoubanCategories } from '@/lib/douban.server';
import { GetBangumiCalendarData } from '@/lib/bangumi.server';
import { getRecommendedShortDramas } from '@/lib/shortdrama.server';
import HomeClient from './HomeClient';

// 🔥 Server Component - 在服务端预取数据
export default async function Home() {
  const queryClient = getQueryClient();

  // 🔥 在服务端获取配置
  const config = await getConfig();
  const homePageConfig = config.HomePageConfig || {
    showHeroBanner: true,
    showContinueWatching: true,
    showUpcomingReleases: true,
    showHotMovies: true,
    showHotTvShows: true,
    showNewAnime: true,
    showHotVariety: true,
    showHotShortDramas: true,
  };

  // 🔥 根据配置预取需要的数据
  const prefetchPromises = [];

  if (homePageConfig.showHotMovies) {
    prefetchPromises.push(
      queryClient.prefetchQuery({
        queryKey: ['douban', 'categories', 'movie', '热门', '全部'],
        queryFn: () => getDoubanCategories({ kind: 'movie', category: '热门', type: '全部' }),
        staleTime: 2 * 60 * 1000,
      })
    );
  }

  if (homePageConfig.showHotTvShows) {
    prefetchPromises.push(
      queryClient.prefetchQuery({
        queryKey: ['douban', 'categories', 'tv', 'tv', 'tv'],
        queryFn: () => getDoubanCategories({ kind: 'tv', category: 'tv', type: 'tv' }),
        staleTime: 2 * 60 * 1000,
      })
    );
  }

  if (homePageConfig.showHotVariety) {
    prefetchPromises.push(
      queryClient.prefetchQuery({
        queryKey: ['douban', 'categories', 'tv', 'show', 'show'],
        queryFn: () => getDoubanCategories({ kind: 'tv', category: 'show', type: 'show' }),
        staleTime: 2 * 60 * 1000,
      })
    );
  }

  if (homePageConfig.showNewAnime) {
    prefetchPromises.push(
      queryClient.prefetchQuery({
        queryKey: ['douban', 'categories', 'tv', 'tv', 'tv_animation'],
        queryFn: () => getDoubanCategories({ kind: 'tv', category: 'tv', type: 'tv_animation' }),
        staleTime: 2 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ['bangumi', 'calendar'],
        queryFn: () => GetBangumiCalendarData(),
        staleTime: 10 * 60 * 1000,
      })
    );
  }

  if (homePageConfig.showHotShortDramas) {
    prefetchPromises.push(
      queryClient.prefetchQuery({
        queryKey: ['shortdramas', 'recommended', 8],
        queryFn: () => getRecommendedShortDramas(undefined, 8),
        staleTime: 5 * 60 * 1000,
      })
    );
  }

  // 🔥 并行预取所有数据
  console.log('[Server] Starting prefetch for', prefetchPromises.length, 'queries');
  const results = await Promise.allSettled(prefetchPromises);
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error('[Server] Prefetch failed for query', index, ':', result.reason);
    } else {
      console.log('[Server] Prefetch succeeded for query', index);
    }
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <HomeClient initialConfig={homePageConfig} />
      </Suspense>
    </HydrationBoundary>
  );
}
