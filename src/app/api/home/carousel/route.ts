import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { getDoubanCategories } from '@/lib/douban.client';
import { 
  getCarouselItemByTitle,
  isTMDBEnabled, 
  CarouselItem 
} from '@/lib/tmdb.client';

export const runtime = 'nodejs';

/**
 * 获取首页轮播图数据
 * 从豆瓣热门获取标题，然后从TMDB搜索获取海报和预告片
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

    console.log('[轮播API] ===== 开始轮播数据获取流程 =====');
    console.log('[轮播API] 第1步: 从豆瓣获取热门数据 (6电影+10剧集+4综艺)...');

    // 从豆瓣获取热门数据：6部电影 + 10部剧集 + 4部综艺
    const [moviesResult, tvShowsResult, varietyShowsResult] = await Promise.allSettled([
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
      getDoubanCategories({
        kind: 'tv',
        category: 'show',
        type: 'show',
      }),
    ]);
    
    console.log('[轮播API] 豆瓣API调用结果:', {
      moviesStatus: moviesResult.status,
      tvShowsStatus: tvShowsResult.status,
      varietyShowsStatus: varietyShowsResult.status,
    });

    const movies =
      moviesResult.status === 'fulfilled' && moviesResult.value?.code === 200
        ? moviesResult.value.list.slice(0, 6)
        : [];

    const tvShows =
      tvShowsResult.status === 'fulfilled' && tvShowsResult.value?.code === 200
        ? tvShowsResult.value.list.slice(0, 10)
        : [];

    // 综艺获取更多备选（因为TMDB搜索成功率可能较低）
    const varietyShows =
      varietyShowsResult.status === 'fulfilled' && varietyShowsResult.value?.code === 200
        ? varietyShowsResult.value.list.slice(0, 10) // 获取10个，期望至少能匹配到4个
        : [];

    console.log(`[轮播API] 第2步: 豆瓣热门结果: ${movies.length}部电影, ${tvShows.length}部剧集, ${varietyShows.length}部综艺`);
    
    // 调试：如果没有数据，输出原因
    if (movies.length === 0) {
      if (moviesResult.status === 'rejected') {
        console.error('[轮播API] 电影获取失败:', moviesResult.reason);
      } else if (moviesResult.status === 'fulfilled') {
        console.warn('[轮播API] 电影API返回:', moviesResult.value);
      }
    }
    if (tvShows.length === 0) {
      if (tvShowsResult.status === 'rejected') {
        console.error('[轮播API] 剧集获取失败:', tvShowsResult.reason);
      } else if (tvShowsResult.status === 'fulfilled') {
        console.warn('[轮播API] 剧集API返回:', tvShowsResult.value);
      }
    }
    if (varietyShows.length === 0) {
      if (varietyShowsResult.status === 'rejected') {
        console.error('[轮播API] 综艺获取失败:', varietyShowsResult.reason);
      } else if (varietyShowsResult.status === 'fulfilled') {
        console.warn('[轮播API] 综艺API返回:', varietyShowsResult.value);
      }
    }
    
    if (movies.length === 0 && tvShows.length === 0 && varietyShows.length === 0) {
      console.error('[轮播API] 豆瓣API未返回任何数据');
      return NextResponse.json({
        code: 200,
        message: '豆瓣API未返回热门数据',
        list: [],
        debug: process.env.NODE_ENV === 'development' ? {
          moviesStatus: moviesResult.status,
          tvShowsStatus: tvShowsResult.status,
          varietyShowsStatus: varietyShowsResult.status,
        } : undefined
      });
    }

    // 合并标题列表：电影 + 剧集 + 综艺（标记来源以便后续分配）
    const items = [
      ...movies.map(m => ({ title: m.title, type: 'movie' as const, source: 'movie' as const })),
      ...tvShows.map(t => ({ title: t.title, type: 'tv' as const, source: 'tv' as const })),
      ...varietyShows.map(v => ({ title: v.title, type: 'tv' as const, source: 'variety' as const })), // 综艺也用tv类型在TMDB搜索
    ];

    console.log(`[轮播API] 第3步: 准备搜索${items.length}个标题...`);
    console.log('[轮播API] 📝 标题列表:', items.map(i => `"${i.title}"(${i.type})`).join(', '));

    // 并行搜索TMDB获取详情
    const carouselPromises = items.map(item =>
      getCarouselItemByTitle(item.title, item.type)
    );

    const carouselResults = await Promise.allSettled(carouselPromises);
    
    // 详细统计
    const fulfilled = carouselResults.filter(
      (r): r is PromiseFulfilledResult<CarouselItem | null> => r.status === 'fulfilled'
    );
    const rejected = carouselResults.filter(r => r.status === 'rejected');
    const nullResults = fulfilled.filter(r => r.value === null);
    const validResults = fulfilled.filter(r => r.value !== null);
    
    console.log(`[轮播API] 搜索统计: 总数${carouselResults.length}, 成功${fulfilled.length}, 失败${rejected.length}, 空值${nullResults.length}, 有效${validResults.length}`);

    // 将搜索结果与原始items关联，保留source信息
    const carouselWithSource = carouselResults
      .map((result, index) => ({
        result,
        source: items[index].source,
        originalTitle: items[index].title
      }))
      .filter(({ result }) => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(({ result, source, originalTitle }) => ({
        item: (result as PromiseFulfilledResult<CarouselItem>).value,
        source,
        originalTitle
      }))
      .filter(({ item }) => {
        // 优先使用横屏海报，如果没有则使用竖版海报
        if (item.backdrop && item.backdrop.length > 0) {
          return true;
        }
        // 如果没有横屏但有竖版海报也可以
        if (item.poster && item.poster.length > 0) {
          console.log(`[轮播API] ${item.title} 使用竖版海报代替横屏`);
          item.backdrop = item.poster;
          return true;
        }
        console.warn(`[轮播API] ${item.title} 缺少海报，已过滤`);
        return false;
      });

    // 按来源分类
    const movieItems = carouselWithSource.filter(x => x.source === 'movie');
    const tvItems = carouselWithSource.filter(x => x.source === 'tv');
    const varietyItems = carouselWithSource.filter(x => x.source === 'variety');

    // 目标配额：10剧集 + 4综艺 + 电影补足到20个
    let finalTvItems = tvItems.slice(0, 10);
    let finalVarietyItems = varietyItems.slice(0, 4);
    
    // 计算需要的电影数量
    const targetTotal = 20;
    const tvCount = finalTvItems.length;
    const varietyCount = finalVarietyItems.length;
    const neededMovies = targetTotal - tvCount - varietyCount;
    
    let finalMovieItems = movieItems.slice(0, Math.max(6, neededMovies)); // 至少6部，不足20则多补

    console.log(`[轮播API] 第4步: 按类型分配 - 剧集:${finalTvItems.length}/10, 综艺:${finalVarietyItems.length}/4, 电影:${finalMovieItems.length}(补足到20)`);
    
    if (varietyCount < 4) {
      console.log(`[轮播API] 注意: 综艺不足4个(仅${varietyCount}个)，已用${neededMovies - 6}部额外电影补充`);
    }

    // 合并所有项目
    let carouselList = [
      ...finalMovieItems.map(x => x.item),
      ...finalTvItems.map(x => x.item),
      ...finalVarietyItems.map(x => x.item),
    ];

    console.log(`[轮播API] 总计:${carouselList.length}个轮播项`);
    
    // 随机打乱顺序，避免同类型聚在一起
    carouselList = carouselList.sort(() => Math.random() - 0.5);
    
    console.log('[轮播API] 第5步: 随机排序完成');
    if (carouselList.length > 0) {
      console.log('[轮播API] ✅ 最终轮播项:', carouselList.map(item => `${item.title}(${item.type})`).join(', '));
    }

    // 如果没有获取到任何数据
    if (carouselList.length === 0) {
      console.error('[轮播API] 警告：未能获取到任何有效的轮播数据');
      console.error('[轮播API] 原始数据:', { movies: movies.length, tvShows: tvShows.length });
      console.error('[轮播API] 所有TMDB搜索都失败或无海报');
      
      // 输出失败的标题
      if (rejected.length > 0) {
        console.error('[轮播API] 搜索异常的标题:', rejected.length);
      }
      if (nullResults.length > 0) {
        console.error('[轮播API] 未找到匹配的标题数量:', nullResults.length);
      }
      
      return NextResponse.json({
        code: 200,
        message: `TMDB搜索完成但无有效结果 (搜索${items.length}个, 成功${validResults.length}个, 空值${nullResults.length}个, 失败${rejected.length}个)`,
        list: [],
        debug: {
          totalSearched: items.length,
          validResults: validResults.length,
          nullResults: nullResults.length,
          rejectedResults: rejected.length,
          sourceMovies: movies.length,
          sourceTVShows: tvShows.length,
          sourceVarietyShows: varietyShows.length,
        }
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
