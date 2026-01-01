import { NextResponse } from 'next/server';
import {
  getCarouselCache,
  isCacheValid,
  initCarouselCache,
  refreshCarouselCache,
} from '@/lib/carousel-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 确保缓存系统已初始化
initCarouselCache();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === '1';

  // 强制刷新
  if (forceRefresh) {
    await refreshCarouselCache();
  }

  const cache = getCarouselCache();
  const valid = isCacheValid();

  // 如果缓存无效且不在刷新中，触发后台刷新
  if (!valid && !cache.isRefreshing) {
    // 不等待，后台刷新
    refreshCarouselCache();
  }

  return NextResponse.json({
    code: 200,
    data: {
      movies: cache.movies,
      tvShows: cache.tvShows,
      variety: cache.variety,
      anime: cache.anime,
    },
    meta: {
      lastUpdated: cache.lastUpdated,
      isRefreshing: cache.isRefreshing,
      cacheValid: valid,
    },
  }, {
    headers: {
      // 客户端缓存5分钟，CDN缓存10分钟
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800',
    },
  });
}
