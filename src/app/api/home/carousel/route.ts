import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { getDoubanCategories } from '@/lib/douban.client';
import { getCarouselItemByTitle, isTMDBEnabled, CarouselItem } from '@/lib/tmdb.client';

export const runtime = 'nodejs';

/**
 * 获取首页轮播图数据
 * 从豆瓣获取热门电影和电视剧，然后从TMDB获取横屏海报和预告片
 */
export async function GET() {
  try {
    // 检查TMDB是否启用
    const tmdbEnabled = await isTMDBEnabled();
    if (!tmdbEnabled) {
      return NextResponse.json(
        {
          code: 503,
          message: 'TMDB功能未启用，无法获取轮播数据',
          list: []
        },
        { status: 503 }
      );
    }

    console.log('[轮播API] 开始获取豆瓣热门数据...');

    // 从豆瓣获取热门电影和电视剧（各取3个）
    const [moviesResult, tvShowsResult] = await Promise.allSettled([
      getDoubanCategories({
        kind: 'movie',
        category: '热门',
        type: '全部',
      }),
      getDoubanCategories({
        kind: 'tv',
        category: 'tv',
        type: 'tv',
      }),
    ]);

    const movies =
      moviesResult.status === 'fulfilled' && moviesResult.value?.code === 200
        ? moviesResult.value.list.slice(0, 3)
        : [];

    const tvShows =
      tvShowsResult.status === 'fulfilled' && tvShowsResult.value?.code === 200
        ? tvShowsResult.value.list.slice(0, 3)
        : [];

    console.log(`[轮播API] 豆瓣数据: ${movies.length}部电影, ${tvShows.length}部电视剧`);

    // 合并并准备要查询的项目
    const items = [
      ...movies.map(m => ({ title: m.title, type: 'movie' as const })),
      ...tvShows.map(t => ({ title: t.title, type: 'tv' as const })),
    ];

    if (items.length === 0) {
      return NextResponse.json({
        code: 200,
        message: '暂无轮播数据',
        list: [],
      });
    }

    console.log('[轮播API] 开始从TMDB获取详情...');

    // 并行获取TMDB数据
    const carouselPromises = items.map(item =>
      getCarouselItemByTitle(item.title, item.type)
    );

    const carouselResults = await Promise.allSettled(carouselPromises);

    // 过滤出成功获取的数据
    const carouselList: CarouselItem[] = carouselResults
      .filter(
        (result): result is PromiseFulfilledResult<CarouselItem> =>
          result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value)
      .filter(item => item.backdrop && item.backdrop.length > 0); // 确保有横屏海报

    console.log(`[轮播API] 成功获取 ${carouselList.length} 个轮播项`);

    // 如果没有获取到任何数据
    if (carouselList.length === 0) {
      return NextResponse.json({
        code: 200,
        message: '未能获取到有效的轮播数据',
        list: [],
      });
    }

    const cacheTime = await getCacheTime();
    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        list: carouselList,
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    console.error('[轮播API] 获取失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取轮播数据失败',
        details: (error as Error).message,
        list: [],
      },
      { status: 500 }
    );
  }
}
