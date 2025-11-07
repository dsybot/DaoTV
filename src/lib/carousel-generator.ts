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
      doubanData: { id: m.id, rate: m.rate, year: m.year }
    })),
    ...tvShows.map((t: any) => ({
      title: t.title,
      type: 'tv' as const,
      source: 'tv' as const,
      doubanData: { id: t.id, rate: t.rate, year: t.year }
    })),
    ...varietyShows.map((v: any) => ({
      title: v.title,
      type: 'tv' as const,
      source: 'variety' as const,
      doubanData: { id: v.id, rate: v.rate, year: v.year }
    })),
  ];

  console.log(`[轮播生成器] 第3步: 准备搜索TMDB，共${items.length}个标题...`);
  console.log(`[轮播生成器] 候选标题列表: ${items.map(i => `${i.title}(${i.source})`).slice(0, 10).join(', ')}...`);

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
  const rejectedCount = carouselResults.filter(r => r.status === 'rejected').length;
  const nullCount = fulfilled.filter(r => r.value === null).length;

  console.log(`[轮播生成器] TMDB搜索完成 - 总数:${carouselResults.length}, 成功:${validResults.length}, 失败:${rejectedCount}, 未找到:${nullCount}`);

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

  console.log(`[轮播生成器] 海报过滤后剩余${carouselWithSource.length}项`);

  // 按来源分类
  const movieItems = carouselWithSource.filter(x => x.source === 'movie');
  const tvItems = carouselWithSource.filter(x => x.source === 'tv');
  const varietyItems = carouselWithSource.filter(x => x.source === 'variety');

  console.log(`[轮播生成器] 第4步: 可用数据 - 电视剧:${tvItems.length}, 电影:${movieItems.length}, 综艺:${varietyItems.length}, 总计:${carouselWithSource.length}`);

  // 目标配额：8个电视剧 + 5个电影 + 2个综艺 = 15个
  let finalTvItems = tvItems.slice(0, 8);
  let finalMovieItems = movieItems.slice(0, 5);
  let finalVarietyItems = varietyItems.slice(0, 2);

  // 智能补充机制：如果某类不足，用其他类型补充
  const targetTotal = 15;
  let currentTotal = finalTvItems.length + finalMovieItems.length + finalVarietyItems.length;

  if (currentTotal < targetTotal) {
    console.log(`[轮播生成器] 数量不足(${currentTotal}/15)，开始智能补充...`);

    // 尝试从剩余的项目中补充
    const usedIds = new Set([
      ...finalTvItems.map(x => x.doubanData.id),
      ...finalMovieItems.map(x => x.doubanData.id),
      ...finalVarietyItems.map(x => x.doubanData.id)
    ]);

    const remainingItems = carouselWithSource.filter(x => !usedIds.has(x.doubanData.id));
    const needed = targetTotal - currentTotal;
    const supplementItems = remainingItems.slice(0, needed);

    console.log(`[轮播生成器] 从剩余${remainingItems.length}项中补充${supplementItems.length}项`);

    // 将补充的项目按类型分配
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

  console.log(`[轮播生成器] 第5步: 最终分配 - 电视剧:${finalTvItems.length}/8, 电影:${finalMovieItems.length}/5, 综艺:${finalVarietyItems.length}/2, 总计:${currentTotal}/15`);

  // 合并数据
  const allItems = [
    ...finalMovieItems.map(x => ({ ...x.item, source: x.source, doubanData: x.doubanData })),
    ...finalTvItems.map(x => ({ ...x.item, source: x.source, doubanData: x.doubanData })),
    ...finalVarietyItems.map(x => ({ ...x.item, source: x.source, doubanData: x.doubanData })),
  ];

  console.log(`[轮播生成器] 第6步: 开始获取豆瓣详情（genres和首播）...共${allItems.length}项`);

  // 批量获取豆瓣详情（通过内部API）- 添加超时和详细日志
  const detailsPromises = allItems.map(async (item, index) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_BASE || process.env.SITE_BASE || 'http://localhost:3000';
      const url = `${baseUrl}/api/douban/details?id=${item.doubanData.id}`;
      
      console.log(`[轮播生成器] [${index + 1}/${allItems.length}] 获取详情: ${item.title} (ID: ${item.doubanData.id})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
      
      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const details = await response.json();
        if (details.code === 200 && details.data) {
          console.log(`[轮播生成器] ✅ ${item.title} 详情获取成功: genres=${details.data.genres?.length || 0}, first_aired=${details.data.first_aired || 'N/A'}`);
          return {
            id: item.doubanData.id,
            genres: details.data.genres || [],
            first_aired: details.data.first_aired || '',
          };
        } else {
          console.warn(`[轮播生成器] ⚠️ ${item.title} API返回失败: code=${details.code}`);
        }
      } else {
        console.warn(`[轮播生成器] ⚠️ ${item.title} HTTP错误: ${response.status}`);
      }
    } catch (error) {
      console.warn(`[轮播生成器] ❌ ${item.title} 异常:`, error instanceof Error ? error.message : error);
    }
    return null;
  });

  const detailsResults = await Promise.all(detailsPromises);
  const successCount = detailsResults.filter(d => d).length;
  console.log(`[轮播生成器] 豆瓣详情获取完成: ${successCount}/${allItems.length} 成功`);

  // 合并并优先使用豆瓣数据
  let carouselList = allItems.map(x => {
    const detail = detailsResults.find(d => d?.id === x.doubanData.id);
    return {
      ...x,
      id: x.doubanData.id || x.id, // 使用豆瓣ID而不是TMDB ID
      rate: x.doubanData.rate && parseFloat(x.doubanData.rate) > 0
        ? parseFloat(x.doubanData.rate)
        : x.rate,
      year: x.doubanData.year || x.year,
      genres: detail?.genres || [],
      first_aired: detail?.first_aired || '',
    };
  });

  // 随机打乱
  carouselList = carouselList.sort(() => Math.random() - 0.5);

  console.log(`[轮播生成器] 第7步: 随机排序完成，共${carouselList.length}项`);
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

