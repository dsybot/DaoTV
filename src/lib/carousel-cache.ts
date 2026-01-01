/**
 * 轮播图数据服务端缓存
 * - 服务启动时立即获取一次
 * - 每30分钟后台静默刷新
 * - 前端直接读取缓存，秒级响应
 */

import { getConfig } from './config';

export interface CarouselItem {
  id: string;
  title: string;
  poster: string;
  rate: string;
  year: string;
  type: 'movie' | 'tv' | 'variety' | 'anime';
  plot_summary?: string;
  backdrop?: string;
  trailerUrl?: string;
}

interface CarouselCache {
  movies: CarouselItem[];
  tvShows: CarouselItem[];
  variety: CarouselItem[];
  anime: CarouselItem[];
  lastUpdated: number;
  isRefreshing: boolean;
}

// 内存缓存
let cache: CarouselCache = {
  movies: [],
  tvShows: [],
  variety: [],
  anime: [],
  lastUpdated: 0,
  isRefreshing: false,
};

// 缓存有效期：30分钟
const CACHE_TTL = 30 * 60 * 1000;
// 请求间隔：500ms（避免触发反爬）
const REQUEST_INTERVAL = 500;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 从豆瓣移动端API获取详情
 */
async function fetchMobileDetails(id: string, proxyUrl: string): Promise<{
  plot_summary?: string;
  backdrop?: string;
  trailerUrl?: string;
} | null> {
  try {
    const mobileApiUrl = `https://m.douban.com/rexxar/api/v2/movie/${id}`;
    const targetUrl = proxyUrl
      ? `${proxyUrl}${encodeURIComponent(mobileApiUrl)}&noredirect=1`
      : mobileApiUrl;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'Referer': 'https://movie.douban.com/explore',
        'Accept': 'application/json',
      },
      redirect: proxyUrl ? 'follow' : 'manual',
    });

    clearTimeout(timeoutId);

    // 重定向说明可能是TV，尝试TV端点
    if (response.status >= 300 && response.status < 400) {
      const tvApiUrl = `https://m.douban.com/rexxar/api/v2/tv/${id}`;
      const tvTargetUrl = proxyUrl
        ? `${proxyUrl}${encodeURIComponent(tvApiUrl)}`
        : tvApiUrl;

      response = await fetch(tvTargetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://movie.douban.com/explore',
          'Accept': 'application/json',
        },
      });
    }

    if (!response.ok) return null;

    const data = await response.json();

    let backdrop = data.cover?.image?.large?.url ||
      data.cover?.image?.normal?.url ||
      data.pic?.large;

    if (backdrop) {
      backdrop = backdrop
        .replace('/view/photo/s/', '/view/photo/l/')
        .replace('/view/photo/m/', '/view/photo/l/')
        .replace('/view/photo/sqxs/', '/view/photo/l/')
        .replace('/s_ratio_poster/', '/l_ratio_poster/')
        .replace('/m_ratio_poster/', '/l_ratio_poster/');
    }

    return {
      plot_summary: data.intro || '',
      backdrop,
      trailerUrl: data.trailers?.[0]?.video_url,
    };
  } catch (error) {
    console.warn(`[carousel-cache] 获取详情失败 ${id}:`, error);
    return null;
  }
}


/**
 * 从豆瓣获取热门列表
 */
async function fetchHotList(
  kind: 'movie' | 'tv',
  category: string,
  type: string,
  proxyUrl: string,
  limit = 20
): Promise<CarouselItem[]> {
  try {
    // 使用 cmliussss CDN（更稳定）
    const apiUrl = `https://m.douban.cmliussss.net/rexxar/api/v2/subject/recent_hot/${kind}?start=0&limit=${limit}&category=${category}&type=${type}`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const itemType = kind === 'movie' ? 'movie' :
      (type === 'show' ? 'variety' : (type === 'tv_animation' ? 'anime' : 'tv'));

    return (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
      type: itemType as CarouselItem['type'],
    }));
  } catch (error) {
    console.warn(`[carousel-cache] 获取热门列表失败 ${kind}/${category}:`, error);
    return [];
  }
}

/**
 * 刷新轮播图缓存（后台任务）
 */
export async function refreshCarouselCache(): Promise<void> {
  if (cache.isRefreshing) {
    console.log('[carousel-cache] 已有刷新任务在运行，跳过');
    return;
  }

  cache.isRefreshing = true;
  console.log('[carousel-cache] 开始刷新轮播图缓存...');

  try {
    const config = await getConfig();
    const proxyUrl = config.SiteConfig.DoubanDetailProxy || '';

    if (proxyUrl) {
      console.log('[carousel-cache] 使用代理:', proxyUrl.substring(0, 30) + '...');
    }

    // 1. 获取热门列表
    const [movies, tvShows, variety, anime] = await Promise.all([
      fetchHotList('movie', '热门', '全部', proxyUrl),
      fetchHotList('tv', 'tv', 'tv', proxyUrl),
      fetchHotList('tv', 'show', 'show', proxyUrl),
      fetchHotList('tv', 'tv', 'tv_animation', proxyUrl),
    ]);

    console.log(`[carousel-cache] 获取列表完成: 电影${movies.length} 剧集${tvShows.length} 综艺${variety.length} 动漫${anime.length}`);

    // 2. 获取轮播图需要的详情（电影前3，剧集前4，综艺前2，动漫前1）
    const itemsToFetch = [
      ...movies.slice(0, 3),
      ...tvShows.slice(0, 4),
      ...variety.slice(0, 2),
      ...anime.slice(0, 1),
    ];

    console.log(`[carousel-cache] 开始获取 ${itemsToFetch.length} 个详情...`);

    // 串行获取详情，每个请求间隔500ms
    for (const item of itemsToFetch) {
      const details = await fetchMobileDetails(item.id, proxyUrl);
      if (details) {
        item.plot_summary = details.plot_summary;
        item.backdrop = details.backdrop;
        item.trailerUrl = details.trailerUrl;
      }
      await delay(REQUEST_INTERVAL);
    }

    // 3. 更新缓存
    cache = {
      movies,
      tvShows,
      variety,
      anime,
      lastUpdated: Date.now(),
      isRefreshing: false,
    };

    console.log(`[carousel-cache] 缓存刷新完成，下次刷新: ${new Date(Date.now() + CACHE_TTL).toLocaleTimeString()}`);
  } catch (error) {
    console.error('[carousel-cache] 刷新缓存失败:', error);
    cache.isRefreshing = false;
  }
}

/**
 * 获取缓存的轮播图数据
 */
export function getCarouselCache(): CarouselCache {
  return cache;
}

/**
 * 检查缓存是否有效
 */
export function isCacheValid(): boolean {
  return cache.lastUpdated > 0 && (Date.now() - cache.lastUpdated) < CACHE_TTL;
}

/**
 * 初始化轮播图缓存系统
 * - 立即获取一次
 * - 设置30分钟定时刷新
 */
let initialized = false;

export function initCarouselCache(): void {
  if (initialized) return;
  initialized = true;

  console.log('[carousel-cache] 初始化轮播图缓存系统...');

  // 立即获取一次
  refreshCarouselCache();

  // 每30分钟刷新一次
  setInterval(() => {
    refreshCarouselCache();
  }, CACHE_TTL);
}
