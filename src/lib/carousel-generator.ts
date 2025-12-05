/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 轮播图数据生成器
 * 
 * 负责从豆瓣和TMDB获取并处理轮播图数据
 * 
 * 新流程（IMDB精确匹配）：
 * 1. 从豆瓣获取热门数据
 * 2. 获取豆瓣详情（包含 IMDB ID）
 * 3. 优先用 IMDB ID 去 TMDB 精确匹配，无 IMDB 则降级为标题搜索
 * 4. 合并数据并返回
 */

import { getCarouselItemByTitle, getCarouselItemByIMDB, CarouselItem } from './tmdb.client';
import { fetchDoubanDetailsForCarousel } from './douban-details-fetcher';

/**
 * 生成轮播图数据（核心逻辑）
 * 
 * 新流程（IMDB精确匹配）：
 * 1. 从豆瓣获取热门数据
 * 2. 批量获取豆瓣详情（包含 IMDB ID、genres、首播日期）
 * 3. 优先用 IMDB ID 去 TMDB 精确匹配海报，无 IMDB 则降级为标题搜索
 * 4. 合并数据并返回
 */
export async function generateCarouselData(): Promise<any[]> {
  console.log('[轮播生成器] ===== 开始生成轮播图数据（IMDB精确匹配模式） =====');
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

  // 获取更多候选数据，以防有些获取不到TMDB数据
  const movies =
    moviesResult.status === 'fulfilled' && moviesResult.value?.code === 200
      ? moviesResult.value.list.slice(0, 20) // 获取20个候选，目标是5个
      : [];

  const tvShows =
    tvShowsResult.status === 'fulfilled' && tvShowsResult.value?.code === 200
      ? tvShowsResult.value.list.slice(0, 25) // 获取25个候选，目标是8个
      : [];

  const varietyShows =
    varietyShowsResult.status === 'fulfilled' && varietyShowsResult.value?.code === 200
      ? varietyShowsResult.value.list.slice(0, 10) // 获取10个候选，目标是2个
      : [];

  console.log(`[轮播生成器] 第2步: 豆瓣热门结果 - 电影:${movies.length}, 剧集:${tvShows.length}, 综艺:${varietyShows.length}`);
  console.log('[轮播生成器] 🔍 电视剧前5:', tvShows.slice(0, 5).map((t: any) => t.title));
  console.log('[轮播生成器] 🔍 电影前5:', movies.slice(0, 5).map((m: any) => m.title));

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
      doubanData: {
        id: m.id,
        rate: m.rate,
        year: m.year,
        title: m.title,
        poster: m.poster,
      }
    })),
    ...tvShows.map((t: any) => ({
      title: t.title,
      type: 'tv' as const,
      source: 'tv' as const,
      doubanData: {
        id: t.id,
        rate: t.rate,
        year: t.year,
        title: t.title,
        poster: t.poster,
      }
    })),
    ...varietyShows.map((v: any) => ({
      title: v.title,
      type: 'tv' as const,
      source: 'variety' as const,
      doubanData: {
        id: v.id,
        rate: v.rate,
        year: v.year,
        title: v.title,
        poster: v.poster,
      }
    })),
  ];

  console.log(`[轮播生成器] 第3步: 批量获取豆瓣详情（含IMDB ID）...共${items.length}项`);

  // 先批量获取豆瓣详情（包含 IMDB ID）
  const detailsPromises = items.map(async (item) => {
    try {
      const details = await fetchDoubanDetailsForCarousel(item.doubanData.id.toString());
      if (details) {
        console.log(`[轮播生成器] ✅ ${item.title} 详情: IMDB=${details.imdb_id || '无'}, genres=${details.genres?.length || 0}`);
        return {
          ...item,
          details: {
            genres: details.genres || [],
            first_aired: details.first_aired || '',
            plot_summary: details.plot_summary || '',
            imdb_id: details.imdb_id || '',
          }
        };
      }
    } catch (error) {
      console.warn(`[轮播生成器] ⚠️ ${item.title} 详情获取失败`);
    }
    return { ...item, details: null };
  });

  const itemsWithDetails = await Promise.all(detailsPromises);

  // 统计 IMDB ID 获取情况
  const withImdb = itemsWithDetails.filter(x => x.details?.imdb_id);
  const withoutImdb = itemsWithDetails.filter(x => !x.details?.imdb_id);
  console.log(`[轮播生成器] IMDB统计: 有IMDB=${withImdb.length}, 无IMDB=${withoutImdb.length}`);

  console.log(`[轮播生成器] 第4步: 搜索TMDB海报（优先IMDB精确匹配）...`);

  // 并行搜索TMDB：优先用 IMDB ID，无则降级为标题搜索
  const carouselPromises = itemsWithDetails.map(async (item) => {
    const imdbId = item.details?.imdb_id;

    // 优先使用 IMDB ID 精确匹配
    if (imdbId) {
      const result = await getCarouselItemByIMDB(imdbId, item.type);
      if (result) {
        return { status: 'fulfilled' as const, value: { result, source: item.source, doubanData: item.doubanData, details: item.details, matchType: 'imdb' as const } };
      }
      console.log(`[轮播生成器] ⚠️ ${item.title} IMDB匹配失败，降级为标题搜索`);
    }

    // 降级为标题搜索
    const result = await getCarouselItemByTitle(item.title, item.type);
    return { status: 'fulfilled' as const, value: { result, source: item.source, doubanData: item.doubanData, details: item.details, matchType: 'title' as const } };
  });

  const carouselResults = await Promise.all(carouselPromises);

  // 统计匹配情况
  const imdbMatched = carouselResults.filter(x => x.value.result && x.value.matchType === 'imdb').length;
  const titleMatched = carouselResults.filter(x => x.value.result && x.value.matchType === 'title').length;
  const notFound = carouselResults.filter(x => !x.value.result).length;
  console.log(`[轮播生成器] TMDB匹配完成: IMDB精确=${imdbMatched}, 标题搜索=${titleMatched}, 未找到=${notFound}`);

  // 处理结果
  const carouselWithSource = carouselResults
    .filter(x => x.value.result !== null)
    .map(x => ({
      item: x.value.result as CarouselItem,
      source: x.value.source,
      doubanData: x.value.doubanData,
      details: x.value.details,
      matchType: x.value.matchType
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

  console.log(`[轮播生成器] 海报过滤后剩余${carouselWithSource.length}项`);

  // 按来源分类
  const movieItems = carouselWithSource.filter(x => x.source === 'movie');
  const tvItems = carouselWithSource.filter(x => x.source === 'tv');
  const varietyItems = carouselWithSource.filter(x => x.source === 'variety');

  console.log(`[轮播生成器] 第5步: 可用数据 - 电视剧:${tvItems.length}, 电影:${movieItems.length}, 综艺:${varietyItems.length}`);

  // 目标配额：8个电视剧 + 5个电影 + 2个综艺 = 15个
  let finalTvItems = tvItems.slice(0, 8);
  let finalMovieItems = movieItems.slice(0, 5);
  let finalVarietyItems = varietyItems.slice(0, 2);

  // 智能补充机制
  const targetTotal = 15;
  let currentTotal = finalTvItems.length + finalMovieItems.length + finalVarietyItems.length;

  if (currentTotal < targetTotal) {
    console.log(`[轮播生成器] 数量不足(${currentTotal}/15)，开始智能补充...`);

    const usedIds = new Set([
      ...finalTvItems.map(x => x.doubanData.id),
      ...finalMovieItems.map(x => x.doubanData.id),
      ...finalVarietyItems.map(x => x.doubanData.id)
    ]);

    const remainingItems = carouselWithSource.filter(x => !usedIds.has(x.doubanData.id));
    const needed = targetTotal - currentTotal;
    const supplementItems = remainingItems.slice(0, needed);

    for (const item of supplementItems) {
      if (item.source === 'tv' && finalTvItems.length < 10) {
        finalTvItems.push(item);
      } else if (item.source === 'movie' && finalMovieItems.length < 10) {
        finalMovieItems.push(item);
      } else if (item.source === 'variety' && finalVarietyItems.length < 10) {
        finalVarietyItems.push(item);
      }
    }

    currentTotal = finalTvItems.length + finalMovieItems.length + finalVarietyItems.length;
  }

  console.log(`[轮播生成器] 第6步: 最终分配 - 电视剧:${finalTvItems.length}/8, 电影:${finalMovieItems.length}/5, 综艺:${finalVarietyItems.length}/2`);

  // 合并数据并使用豆瓣数据（详情已在第3步获取）
  let carouselList = [
    ...finalTvItems,
    ...finalMovieItems,
    ...finalVarietyItems,
  ].map(x => ({
    ...x.item,
    source: x.source,
    id: x.doubanData.id || x.item.id, // 使用豆瓣ID
    title: x.doubanData.title || x.item.title,
    rate: x.doubanData.rate && parseFloat(x.doubanData.rate) > 0
      ? parseFloat(x.doubanData.rate)
      : x.item.rate,
    year: x.doubanData.year || x.item.year,
    overview: x.details?.plot_summary || x.item.overview,
    poster: x.doubanData.poster || x.item.poster,
    genres: x.details?.genres || [],
    first_aired: x.details?.first_aired || '',
  }));

  // 随机打乱
  carouselList = carouselList.sort(() => Math.random() - 0.5);

  console.log(`[轮播生成器] 第7步: 随机排序完成，共${carouselList.length}项`);
  console.log('[轮播生成器] 🔍 最终列表:', carouselList.map(x => x.title));
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
    // 获取更多候选数据以确保成功率
    const url = `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${kind}?start=0&limit=30&category=${category}&type=${type}&_t=${Date.now()}`;

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

