/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 轮播图数据生成器
 * 
 * 负责从豆瓣和TMDB获取并处理轮播图数据
 */

import { getCarouselItemByTitle, CarouselItem } from './tmdb.client';

/**
 * 生成轮播图数据（核心逻辑）
 * 
 * 流程：
 * 1. 从豆瓣获取热门数据
 * 2. 在TMDB搜索并获取海报
 * 3. 合并数据并返回
 */
export async function generateCarouselData(): Promise<any[]> {
  console.log('[轮播生成器] ===== 开始生成轮播图数据 =====');
  console.log('[轮播生成器] 第1步: 从豆瓣获取热门数据...');

  // 从豆瓣API直接获取最新数据
  const [moviesResult, tvShowsResult, varietyShowsResult] = await Promise.allSettled([
    fetchDoubanHot('movie', '热门', '全部'),
    fetchDoubanHot('tv', 'tv', 'tv'),
    fetchDoubanHot('tv', 'show', 'show'),
  ]);

  console.log('[轮播生成器] 豆瓣API调用结果:', {
    movies: moviesResult.status,
    tvShows: tvShowsResult.status,
    variety: varietyShowsResult.status,
  });

  const movies =
    moviesResult.status === 'fulfilled' && moviesResult.value?.code === 200
      ? moviesResult.value.list.slice(0, 6)
      : [];

  const tvShows =
    tvShowsResult.status === 'fulfilled' && tvShowsResult.value?.code === 200
      ? tvShowsResult.value.list.slice(0, 10)
      : [];

  const varietyShows =
    varietyShowsResult.status === 'fulfilled' && varietyShowsResult.value?.code === 200
      ? varietyShowsResult.value.list.slice(0, 10)
      : [];

  console.log(`[轮播生成器] 第2步: 豆瓣热门结果 - 电影:${movies.length}, 剧集:${tvShows.length}, 综艺:${varietyShows.length}`);

  if (movies.length === 0 && tvShows.length === 0 && varietyShows.length === 0) {
    console.error('[轮播生成器] ❌ 豆瓣API未返回任何数据');
    return [];
  }

  // 合并标题列表
  const items = [
    ...movies.map((m: any) => ({
      title: m.title,
      type: 'movie' as const,
      source: 'movie' as const,
      doubanData: { rate: m.rate, year: m.year }
    })),
    ...tvShows.map((t: any) => ({
      title: t.title,
      type: 'tv' as const,
      source: 'tv' as const,
      doubanData: { rate: t.rate, year: t.year }
    })),
    ...varietyShows.map((v: any) => ({
      title: v.title,
      type: 'tv' as const,
      source: 'variety' as const,
      doubanData: { rate: v.rate, year: v.year }
    })),
  ];

  console.log(`[轮播生成器] 第3步: 准备搜索TMDB，共${items.length}个标题...`);

  // 并行搜索TMDB
  const carouselPromises = items.map(item =>
    getCarouselItemByTitle(item.title, item.type)
  );

  const carouselResults = await Promise.allSettled(carouselPromises);

  // 统计
  const fulfilled = carouselResults.filter(
    (r): r is PromiseFulfilledResult<CarouselItem | null> => r.status === 'fulfilled'
  );
  const validResults = fulfilled.filter(r => r.value !== null);

  console.log(`[轮播生成器] TMDB搜索完成 - 总数:${carouselResults.length}, 有效:${validResults.length}`);

  // 处理结果
  const carouselWithSource = carouselResults
    .map((result, index) => ({
      result,
      source: items[index].source,
      doubanData: items[index].doubanData
    }))
    .filter(({ result }) =>
      result.status === 'fulfilled' && result.value !== null
    )
    .map(({ result, source, doubanData }) => ({
      item: (result as PromiseFulfilledResult<CarouselItem>).value,
      source,
      doubanData
    }))
    .filter(({ item }) => {
      // 必须有海报
      if (item.backdrop && item.backdrop.length > 0) {
        return true;
      }
      if (item.poster && item.poster.length > 0) {
        item.backdrop = item.poster;
        return true;
      }
      return false;
    });

  // 按来源分类
  const movieItems = carouselWithSource.filter(x => x.source === 'movie');
  const tvItems = carouselWithSource.filter(x => x.source === 'tv');
  const varietyItems = carouselWithSource.filter(x => x.source === 'variety');

  // 目标配额：10剧集 + 4综艺 + 电影补足到20个
  const finalTvItems = tvItems.slice(0, 10);
  const finalVarietyItems = varietyItems.slice(0, 4);
  const targetTotal = 20;
  const neededMovies = targetTotal - finalTvItems.length - finalVarietyItems.length;
  const finalMovieItems = movieItems.slice(0, Math.max(6, neededMovies));

  console.log(`[轮播生成器] 第4步: 按类型分配 - 剧集:${finalTvItems.length}/10, 综艺:${finalVarietyItems.length}/4, 电影:${finalMovieItems.length}`);

  // 合并并优先使用豆瓣数据
  let carouselList = [
    ...finalMovieItems.map(x => ({
      ...x.item,
      source: x.source,
      rate: x.doubanData.rate && parseFloat(x.doubanData.rate) > 0
        ? parseFloat(x.doubanData.rate)
        : x.item.rate,
      year: x.doubanData.year || x.item.year,
    })),
    ...finalTvItems.map(x => ({
      ...x.item,
      source: x.source,
      rate: x.doubanData.rate && parseFloat(x.doubanData.rate) > 0
        ? parseFloat(x.doubanData.rate)
        : x.item.rate,
      year: x.doubanData.year || x.item.year,
    })),
    ...finalVarietyItems.map(x => ({
      ...x.item,
      source: x.source,
      rate: x.doubanData.rate && parseFloat(x.doubanData.rate) > 0
        ? parseFloat(x.doubanData.rate)
        : x.item.rate,
      year: x.doubanData.year || x.item.year,
    })),
  ];

  // 随机打乱
  carouselList = carouselList.sort(() => Math.random() - 0.5);

  console.log(`[轮播生成器] 第5步: 随机排序完成，共${carouselList.length}项`);
  console.log('[轮播生成器] ===== 生成完成 =====');

  return carouselList;
}

/**
 * 从豆瓣API直接获取热门数据
 */
async function fetchDoubanHot(
  kind: 'movie' | 'tv',
  category: string,
  type: string
): Promise<{ code: number; list: any[] }> {
  try {
    const url = `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${kind}?start=0&limit=20&category=${category}&type=${type}&_t=${Date.now()}`;
    
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://movie.douban.com/',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    return {
      code: 200,
      list: data.items?.map((item: any) => ({
        id: item.id,
        title: item.title,
        poster: item.pic?.normal || item.pic?.large || '',
        rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
        year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
      })) || []
    };
  } catch (error) {
    console.error(`[豆瓣获取] ${kind}/${category} 失败:`, error);
    return { code: 500, list: [] };
  }
}

