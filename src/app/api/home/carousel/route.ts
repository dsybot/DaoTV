import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { 
  getTMDBTrendingMovies,
  getTMDBTrendingTV,
  getTMDBMovieVideos,
  getTMDBTVVideos,
  isTMDBEnabled, 
  CarouselItem 
} from '@/lib/tmdb.client';

const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';
const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export const runtime = 'nodejs';

/**
 * 获取首页轮播图数据
 * 从TMDB trending获取本周热门内容，保证有数据
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

    console.log('[轮播API] 从TMDB获取trending数据...');

    // 从TMDB获取trending数据
    const [moviesResult, tvShowsResult] = await Promise.allSettled([
      getTMDBTrendingMovies(),
      getTMDBTrendingTV(),
    ]);

    const trendingMovies =
      moviesResult.status === 'fulfilled' ? moviesResult.value.results.slice(0, 6) : [];
    const trendingTV =
      tvShowsResult.status === 'fulfilled' ? tvShowsResult.value.results.slice(0, 6) : [];

    console.log(`[轮播API] TMDB Trending: ${trendingMovies.length}部电影, ${trendingTV.length}部剧集`);

    if (trendingMovies.length === 0 && trendingTV.length === 0) {
      return NextResponse.json({
        code: 200,
        message: '暂无轮播数据',
        list: [],
      });
    }

    // 合并所有内容
    const allMedia = [
      ...trendingMovies.map(m => ({ data: m, type: 'movie' as const })),
      ...trendingTV.map(t => ({ data: t, type: 'tv' as const })),
    ];

    console.log('[轮播API] 开始获取预告片...');

    // 并行获取每个内容的预告片
    const carouselPromises = allMedia.map(async ({ data, type }) => {
      try {
        // 获取预告片
        let trailerKey: string | undefined;
        try {
          const videos = type === 'movie'
            ? await getTMDBMovieVideos(data.id)
            : await getTMDBTVVideos(data.id);

          const trailer = videos.results.find(
            v => v.site === 'YouTube' && v.type === 'Trailer' && v.official
          ) || videos.results.find(
            v => v.site === 'YouTube' && v.type === 'Trailer'
          ) || videos.results.find(
            v => v.site === 'YouTube' && v.type === 'Teaser'
          );

          if (trailer) {
            trailerKey = trailer.key;
          }
        } catch (err) {
          console.warn(`[轮播API] 获取预告片失败: ${type === 'movie' ? data.title : data.name}`);
        }

        const carouselItem: CarouselItem = {
          id: data.id,
          title: type === 'movie' ? data.title : data.name,
          overview: data.overview || '',
          backdrop: data.backdrop_path ? `${TMDB_BACKDROP_BASE_URL}${data.backdrop_path}` : '',
          poster: data.poster_path ? `${TMDB_POSTER_BASE_URL}${data.poster_path}` : '',
          rate: data.vote_average || 0,
          year: type === 'movie'
            ? (data.release_date?.split('-')[0] || '')
            : (data.first_air_date?.split('-')[0] || ''),
          type,
          trailerKey
        };

        return carouselItem;
      } catch (error) {
        console.error(`[轮播API] 处理失败:`, error);
        return null;
      }
    });

    const carouselResults = await Promise.allSettled(carouselPromises);

    // 过滤出成功获取的数据
    const carouselList: CarouselItem[] = carouselResults
      .filter(
        (result): result is PromiseFulfilledResult<CarouselItem> =>
          result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value)
      .filter(item => {
        // 优先使用横屏海报，如果没有则使用竖版海报
        if (item.backdrop && item.backdrop.length > 0) {
          return true;
        }
        // 如果没有横屏但有竖版海报也可以
        if (item.poster && item.poster.length > 0) {
          console.log(`[轮播API] ${item.title} 使用竖版海报代替横屏`);
          // 将竖版海报作为横屏使用
          item.backdrop = item.poster;
          return true;
        }
        console.warn(`[轮播API] ${item.title} 缺少海报，已过滤`);
        return false;
      });

    console.log(`[轮播API] 成功获取 ${carouselList.length} 个轮播项`);
    if (carouselList.length > 0) {
      console.log('[轮播API] 轮播项标题:', carouselList.map(item => item.title).join(', '));
    }

    // 如果没有获取到任何数据
    if (carouselList.length === 0) {
      console.warn('[轮播API] 警告：未能获取到任何有效的轮播数据');
      console.warn('[轮播API] Trending数据:', { movies: trendingMovies.length, tv: trendingTV.length });
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
