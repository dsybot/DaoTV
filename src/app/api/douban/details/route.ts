import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';
import { getRandomUserAgent, getRandomUserAgentWithInfo, getSecChUaHeaders, DEFAULT_USER_AGENT } from '@/lib/user-agent';

// ============================================================================
// 移动端API数据获取（预告片和高清图片）
// ============================================================================

/**
 * 从移动端API获取预告片和高清图片（内部函数）
 * @param id 豆瓣影片ID
 * @param proxyUrl 代理地址（使用 DoubanDetailProxy 配置）
 * 2026 最佳实践：使用最新 User-Agent 和完整请求头
 * 
 * 注意：豆瓣移动端API对电影和电视剧使用不同的路径
 * - 电影: /movie/{id}
 * - 电视剧: /tv/{id}
 * 此函数会先尝试movie，失败后尝试tv
 */
async function _fetchMobileApiData(id: string, proxyUrl: string): Promise<{
  trailerUrl?: string;
  backdrop?: string;
} | null> {
  try {
    // 先尝试 movie 端点
    let mobileApiUrl = `https://m.douban.com/rexxar/api/v2/movie/${id}`;

    // 如果配置了代理，使用代理地址，并添加 noredirect 参数
    let targetUrl = proxyUrl
      ? `${proxyUrl}${encodeURIComponent(mobileApiUrl)}&noredirect=1`
      : mobileApiUrl;

    // 获取随机浏览器指纹
    const { ua, browser, platform } = getRandomUserAgentWithInfo();
    const secChHeaders = getSecChUaHeaders(browser, platform);

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

    let response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': ua,
        'Referer': 'https://movie.douban.com/explore',  // 更具体的 Referer
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://movie.douban.com',
        ...secChHeaders,  // Chrome/Edge 的 Sec-CH-UA 头部
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
      },
      redirect: proxyUrl ? 'follow' : 'manual', // 无代理时手动处理重定向
    });

    clearTimeout(timeoutId);

    // 如果是 3xx 重定向，说明可能是电视剧，尝试 tv 端点
    if (response.status >= 300 && response.status < 400) {
      console.log(`[移动端API] 检测到重定向，尝试 TV 端点: ${id}`);
      mobileApiUrl = `https://m.douban.com/rexxar/api/v2/tv/${id}`;

      targetUrl = proxyUrl
        ? `${proxyUrl}${encodeURIComponent(mobileApiUrl)}`
        : mobileApiUrl;

      const tvController = new AbortController();
      const tvTimeoutId = setTimeout(() => tvController.abort(), 15000);

      response = await fetch(targetUrl, {
        signal: tvController.signal,
        headers: {
          'User-Agent': ua,
          'Referer': 'https://movie.douban.com/explore',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Origin': 'https://movie.douban.com',
          ...secChHeaders,  // Chrome/Edge 的 Sec-CH-UA 头部
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
        },
      });

      clearTimeout(tvTimeoutId);
    }

    if (!response.ok) {
      console.warn(`[移动端API] 请求失败: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // 提取预告片URL（取第一个预告片）
    const trailerUrl = data.trailers?.[0]?.video_url || undefined;

    // 提取高清图片：优先使用raw原图，转换URL到最高清晰度
    let backdrop = data.cover?.image?.raw?.url ||
      data.cover?.image?.large?.url ||
      data.cover?.image?.normal?.url ||
      data.pic?.large ||
      undefined;

    // 将图片URL转换为高清版本（使用l而不是raw，避免重定向）
    if (backdrop) {
      backdrop = backdrop
        .replace('/view/photo/s/', '/view/photo/l/')
        .replace('/view/photo/m/', '/view/photo/l/')
        .replace('/view/photo/sqxs/', '/view/photo/l/')
        .replace('/s_ratio_poster/', '/l_ratio_poster/')
        .replace('/m_ratio_poster/', '/l_ratio_poster/');
    }

    return { trailerUrl, backdrop };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[移动端API] 请求超时`);
    } else {
      console.warn(`[移动端API] 获取失败: ${(error as Error).message}`);
    }
    return null;
  }
}

/**
 * 使用 unstable_cache 包裹移动端API请求
 * - 30分钟缓存（trailer URL 有时效性，需要较短缓存）
 * - 与详情页缓存分开管理
 * - Next.js会自动根据函数参数区分缓存
 */
const fetchMobileApiData = unstable_cache(
  async (id: string, proxyUrl: string) => _fetchMobileApiData(id, proxyUrl),
  ['douban-mobile-api'],
  {
    revalidate: 1800, // 30分钟缓存
    tags: ['douban-mobile'],
  }
);

// 请求限制器 - 使用代理时可以更快
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // 降低到0.5秒（使用代理时风险较低）
const MIN_REQUEST_INTERVAL_NO_PROXY = 2000; // 无代理时保持2秒

function randomDelay(min = 1000, max = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 检测是否为豆瓣 challenge 页面
 */
function isDoubanChallengePage(html: string): boolean {
  return (
    html.includes('sha512') &&
    html.includes('process(cha)') &&
    html.includes('载入中')
  );
}

/**
 * 从 Mobile API 获取详情（fallback 方案）
 */
async function fetchFromMobileAPI(id: string): Promise<any> {
  try {
    const mobileApiUrl = `https://m.douban.com/rexxar/api/v2/movie/${id}`;

    console.log(`[Douban Mobile API] 请求: ${mobileApiUrl}`);

    // 获取随机浏览器指纹
    const { ua, browser, platform } = getRandomUserAgentWithInfo();
    const secChHeaders = getSecChUaHeaders(browser, platform);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(mobileApiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': ua,
        'Referer': 'https://movie.douban.com/explore',  // 更具体的 Referer
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://movie.douban.com',
        ...secChHeaders,  // Chrome/Edge 的 Sec-CH-UA 头部
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Mobile API 返回 ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Douban Mobile API] 成功获取数据`);

    // 转换 Mobile API 数据格式到标准格式
    return {
      id: data.id,
      title: data.title,
      originalTitle: data.original_title || '',
      year: data.year || '',
      rating: {
        value: data.rating?.value || 0,
        count: data.rating?.count || 0,
      },
      genres: data.genres || [],
      directors: data.directors?.map((d: any) => d.name) || [],
      actors: data.actors?.map((a: any) => a.name) || [],
      summary: data.intro || '',
      poster: data.pic?.large || data.pic?.normal || '',
      countries: data.countries || [],
      languages: data.languages || [],
      duration: data.durations?.[0] || '',
      releaseDate: data.pubdate?.[0] || '',
      trailerUrl: data.trailers?.[0]?.video_url || '',
      imdbId: '',
      tags: data.tags || [],
    };
  } catch (error) {
    console.error(`[Douban Mobile API] 获取失败:`, error);
    throw new DoubanError(
      'Mobile API 获取失败，请稍后再试',
      'SERVER_ERROR',
      500
    );
  }
}

export const runtime = 'nodejs';

// ============================================================================
// 错误类型枚举
// ============================================================================

/**
 * 豆瓣错误类
 */
class DoubanError extends Error {
  constructor(
    message: string,
    public code: 'TIMEOUT' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'PARSE_ERROR' | 'NETWORK_ERROR',
    public status?: number,
  ) {
    super(message);
    this.name = 'DoubanError';
  }
}

// ============================================================================
// 核心爬虫函数（带缓存和重试）
// ============================================================================

/**
 * 带重试的爬取函数
 */
async function _scrapeDoubanDetails(id: string, proxyUrl: string, retryCount = 0): Promise<ReturnType<typeof parseDoubanDetails>> {
  const originalUrl = `https://movie.douban.com/subject/${id}/`;
  // 如果配置了代理，使用代理地址
  const target = proxyUrl
    ? `${proxyUrl}${encodeURIComponent(originalUrl)}`
    : originalUrl;

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000]; // 指数退避

  try {
    // 请求限流：确保请求间隔（使用代理时间隔更短）
    const interval = proxyUrl ? MIN_REQUEST_INTERVAL : MIN_REQUEST_INTERVAL_NO_PROXY;
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < interval) {
      await new Promise(resolve =>
        setTimeout(resolve, interval - timeSinceLastRequest)
      );
    }
    lastRequestTime = Date.now();

    // 添加随机延时（仅无代理时需要，避免被封）
    if (!proxyUrl) {
      await randomDelay(500, 1500); // 无代理：500-1500ms
    }

    // 增加超时时间至20秒
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    // 获取随机浏览器指纹
    const { ua, browser, platform } = getRandomUserAgentWithInfo();
    const secChHeaders = getSecChUaHeaders(browser, platform);

    // 🎯 2025 最佳实践：按照真实浏览器的头部顺序发送
    const fetchOptions = {
      signal: controller.signal,
      headers: {
        // 基础头部（所有浏览器通用）
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        ...secChHeaders,  // Chrome/Edge 的 Sec-CH-UA 头部
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': ua,
        // 随机添加 Referer（50% 概率）
        ...(Math.random() > 0.5 ? { 'Referer': 'https://www.douban.com/' } : {}),
      },
    };

    const response = await fetch(target, fetchOptions);
    clearTimeout(timeoutId);

    let html: string;

    // 处理不同的HTTP状态码
    if (!response.ok) {
      if (response.status === 429) {
        // 速率限制 - fallback 到 Mobile API（不重试）
        console.log(`[Douban] 遇到 429 速率限制，尝试使用 Mobile API...`);
        try {
          return await fetchFromMobileAPI(id);
        } catch (mobileError) {
          // Mobile API 也失败，直接抛出错误，不再重试
          throw new DoubanError('豆瓣 API 和 Mobile API 均不可用，请稍后再试', 'RATE_LIMIT', 429);
        }
      } else if (response.status >= 500) {
        // 服务器错误
        throw new DoubanError(`豆瓣服务器错误: ${response.status}`, 'SERVER_ERROR', response.status);
      } else if (response.status === 404) {
        throw new DoubanError(`影片不存在: ${id}`, 'SERVER_ERROR', 404);
      } else {
        throw new DoubanError(`HTTP错误: ${response.status}`, 'NETWORK_ERROR', response.status);
      }
    }

    html = await response.text();

    // 检测 challenge 页面 - fallback 到 Mobile API（不重试）
    if (isDoubanChallengePage(html)) {
      console.log(`[Douban] 检测到反爬虫 challenge 页面，fallback 到 Mobile API...`);
      try {
        return await fetchFromMobileAPI(id);
      } catch (mobileError) {
        // Mobile API 也失败，直接抛出错误，不再重试
        throw new DoubanError('豆瓣反爬虫激活且 Mobile API 不可用，请稍后再试', 'RATE_LIMIT', 429);
      }
    }

    // 解析详细信息
    const result = parseDoubanDetails(html, id);

    // 🔄 回退机制：如果使用代理但解析结果不完整，尝试直接请求
    if (proxyUrl && result.code === 200 && result.data) {
      const hasTitle = !!result.data.title;
      const hasSummary = !!result.data.plot_summary;
      if (!hasTitle || !hasSummary) {
        console.warn(`[豆瓣详情] 代理返回数据不完整，尝试直接请求...`);
        return _scrapeDoubanDetails(id, '', retryCount);
      }
    }

    return result;
  } catch (error) {
    // 超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new DoubanError('请求超时，豆瓣响应过慢', 'TIMEOUT', 504);

      // 超时重试
      if (retryCount < MAX_RETRIES) {
        console.warn(`[Douban] 超时，重试 ${retryCount + 1}/${MAX_RETRIES}...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryCount]));
        return _scrapeDoubanDetails(id, proxyUrl, retryCount + 1);
      }

      throw timeoutError;
    }

    // DoubanError 直接抛出
    if (error instanceof DoubanError) {
      // 速率限制或服务器错误重试
      if ((error.code === 'RATE_LIMIT' || error.code === 'SERVER_ERROR') && retryCount < MAX_RETRIES) {
        console.warn(`[Douban] ${error.message}，重试 ${retryCount + 1}/${MAX_RETRIES}...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryCount]));
        return _scrapeDoubanDetails(id, proxyUrl, retryCount + 1);
      }
      throw error;
    }

    // 其他错误
    throw new DoubanError(
      error instanceof Error ? error.message : '未知网络错误',
      'NETWORK_ERROR',
    );
  }
}

/**
 * 使用 unstable_cache 包裹爬虫函数
 * - 4小时缓存
 * - 自动重新验证
 * - Next.js会自动根据函数参数区分缓存
 */
export const scrapeDoubanDetails = unstable_cache(
  async (id: string, proxyUrl: string, retryCount = 0) => _scrapeDoubanDetails(id, proxyUrl, retryCount),
  ['douban-details'],
  {
    revalidate: 14400, // 4小时缓存
    tags: ['douban'],
  }
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const noCache = searchParams.get('nocache') === '1' || searchParams.get('debug') === '1';

  if (!id) {
    return NextResponse.json(
      {
        code: 400,
        message: '缺少必要参数: id',
        error: 'MISSING_PARAMETER',
      },
      { status: 400 }
    );
  }

  // 获取代理配置（本地特性：支持自定义代理）
  const config = await getConfig();
  const proxyUrl = config.SiteConfig.DoubanDetailProxy || '';

  try {
    // 并行获取详情和移动端API数据（都使用代理）
    const [details, mobileData] = await Promise.all([
      scrapeDoubanDetails(id, proxyUrl),
      fetchMobileApiData(id, proxyUrl),
    ]);

    // 合并数据：混合使用爬虫和移动端API的优势
    if (details.code === 200 && details.data && mobileData) {
      // 预告片来自移动端API
      details.data.trailerUrl = mobileData.trailerUrl;
      // Backdrop优先使用爬虫的剧照（横版高清），否则用移动端API的海报
      if (!details.data.backdrop && mobileData.backdrop) {
        details.data.backdrop = mobileData.backdrop;
      }
    }

    const cacheTime = await getCacheTime();

    // 🔍 调试模式：绕过缓存
    // 🎬 Trailer安全缓存：30分钟（与移动端API的unstable_cache保持一致）
    // 因为trailer URL有效期约2-3小时，30分钟缓存确保用户拿到的链接仍然有效
    const trailerSafeCacheTime = 1800; // 30分钟
    const cacheHeaders = noCache ? {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Data-Source': 'no-cache-debug',
    } : {
      'Cache-Control': `public, max-age=${trailerSafeCacheTime}, s-maxage=${trailerSafeCacheTime}, stale-while-revalidate=${trailerSafeCacheTime}`,
      'CDN-Cache-Control': `public, s-maxage=${trailerSafeCacheTime}`,
      'Vercel-CDN-Cache-Control': `public, s-maxage=${trailerSafeCacheTime}`,
      'Netlify-Vary': 'query',
      'X-Data-Source': 'scraper-cached',
    };

    return NextResponse.json(details, { headers: cacheHeaders });
  } catch (error) {
    // 处理 DoubanError
    if (error instanceof DoubanError) {
      const statusCode = error.status || (
        error.code === 'TIMEOUT' ? 504 :
          error.code === 'RATE_LIMIT' ? 429 :
            error.code === 'SERVER_ERROR' ? 502 :
              500
      );

      return NextResponse.json(
        {
          code: statusCode,
          message: error.message,
          error: error.code,
          details: `获取豆瓣详情失败 (ID: ${id})`,
        },
        {
          status: statusCode,
          headers: {
            // 对于速率限制和超时，允许客户端缓存错误响应
            ...(error.code === 'RATE_LIMIT' || error.code === 'TIMEOUT' ? {
              'Cache-Control': 'public, max-age=60',
            } : {}),
          },
        }
      );
    }

    // 解析错误
    if (error instanceof Error && error.message.includes('解析')) {
      return NextResponse.json(
        {
          code: 500,
          message: '解析豆瓣数据失败，可能是页面结构已变化',
          error: 'PARSE_ERROR',
          details: error.message,
        },
        { status: 500 }
      );
    }

    // 未知错误
    return NextResponse.json(
      {
        code: 500,
        message: '获取豆瓣详情失败',
        error: 'UNKNOWN_ERROR',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

function parseDoubanDetails(html: string, id: string) {
  try {
    // 提取基本信息
    const titleMatch = html.match(/<h1[^>]*>[\s\S]*?<span[^>]*property="v:itemreviewed"[^>]*>([^<]+)<\/span>/);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // 提取海报
    const posterMatch = html.match(/<a[^>]*class="nbgnbg"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/);
    const poster = posterMatch ? posterMatch[1] : '';

    // 提取评分
    const ratingMatch = html.match(/<strong[^>]*class="ll rating_num"[^>]*property="v:average">([^<]+)<\/strong>/);
    const rate = ratingMatch ? ratingMatch[1] : '';

    // 提取年份
    const yearMatch = html.match(/<span[^>]*class="year">[(]([^)]+)[)]<\/span>/);
    const year = yearMatch ? yearMatch[1] : '';

    // 根据真实HTML结构提取导演、编剧、主演
    let directors: string[] = [];
    let screenwriters: string[] = [];
    let cast: string[] = [];

    // 导演：<span class='pl'>导演</span>: <span class='attrs'><a href="..." rel="v:directedBy">刘家成</a></span>
    const directorMatch = html.match(/<span class=['"]pl['"]>导演<\/span>:\s*<span class=['"]attrs['"]>(.*?)<\/span>/);
    if (directorMatch) {
      const directorLinks = directorMatch[1].match(/<a[^>]*>([^<]+)<\/a>/g);
      if (directorLinks) {
        directors = directorLinks.map(link => {
          const nameMatch = link.match(/>([^<]+)</);
          return nameMatch ? nameMatch[1].trim() : '';
        }).filter(Boolean);
      }
    }

    // 编剧：<span class='pl'>编剧</span>: <span class='attrs'><a href="...">王贺</a></span>
    const writerMatch = html.match(/<span class=['"]pl['"]>编剧<\/span>:\s*<span class=['"]attrs['"]>(.*?)<\/span>/);
    if (writerMatch) {
      const writerLinks = writerMatch[1].match(/<a[^>]*>([^<]+)<\/a>/g);
      if (writerLinks) {
        screenwriters = writerLinks.map(link => {
          const nameMatch = link.match(/>([^<]+)</);
          return nameMatch ? nameMatch[1].trim() : '';
        }).filter(Boolean);
      }
    }

    // 主演：<span class='pl'>主演</span>: <span class='attrs'><a href="..." rel="v:starring">杨幂</a> / <a href="...">欧豪</a> / ...</span>
    const castMatch = html.match(/<span class=['"]pl['"]>主演<\/span>:\s*<span class=['"]attrs['"]>(.*?)<\/span>/);
    if (castMatch) {
      const castLinks = castMatch[1].match(/<a[^>]*>([^<]+)<\/a>/g);
      if (castLinks) {
        cast = castLinks.map(link => {
          const nameMatch = link.match(/>([^<]+)</);
          return nameMatch ? nameMatch[1].trim() : '';
        }).filter(Boolean);
      }
    }

    // 提取类型
    const genreMatches = html.match(/<span[^>]*property="v:genre">([^<]+)<\/span>/g);
    const genres = genreMatches ? genreMatches.map(match => {
      const result = match.match(/<span[^>]*property="v:genre">([^<]+)<\/span>/);
      return result ? result[1] : '';
    }).filter(Boolean) : [];

    // 提取制片国家/地区
    const countryMatch = html.match(/<span[^>]*class="pl">制片国家\/地区:<\/span>([^<]+)/);
    const countries = countryMatch ? countryMatch[1].trim().split('/').map(c => c.trim()).filter(Boolean) : [];

    // 提取语言
    const languageMatch = html.match(/<span[^>]*class="pl">语言:<\/span>([^<]+)/);
    const languages = languageMatch ? languageMatch[1].trim().split('/').map(l => l.trim()).filter(Boolean) : [];

    // 提取首播/上映日期 - 根据真实HTML结构
    let first_aired = '';

    // 首播信息：<span class="pl">首播:</span> <span property="v:initialReleaseDate" content="2025-08-13(中国大陆)">2025-08-13(中国大陆)</span>
    const firstAiredMatch = html.match(/<span class="pl">首播:<\/span>\s*<span[^>]*property="v:initialReleaseDate"[^>]*content="([^"]*)"[^>]*>([^<]*)<\/span>/);
    if (firstAiredMatch) {
      first_aired = firstAiredMatch[1]; // 使用content属性的值
    } else {
      // 如果没有首播，尝试上映日期 - 可能有多个日期，取第一个
      const releaseDateMatch = html.match(/<span class="pl">上映日期:<\/span>\s*<span[^>]*property="v:initialReleaseDate"[^>]*content="([^"]*)"[^>]*>([^<]*)<\/span>/);
      if (releaseDateMatch) {
        first_aired = releaseDateMatch[1];
      }
    }

    // 提取集数（仅剧集有）
    const episodesMatch = html.match(/<span[^>]*class="pl">集数:<\/span>([^<]+)/);
    const episodes = episodesMatch ? parseInt(episodesMatch[1].trim()) || undefined : undefined;

    // 提取时长 - 支持电影和剧集
    let episode_length: number | undefined;
    let movie_duration: number | undefined;

    // 先尝试提取剧集的单集片长
    const singleEpisodeDurationMatch = html.match(/<span[^>]*class="pl">单集片长:<\/span>([^<]+)/);
    if (singleEpisodeDurationMatch) {
      episode_length = parseInt(singleEpisodeDurationMatch[1].trim()) || undefined;
    } else {
      // 如果没有单集片长，尝试提取电影的总片长
      const movieDurationMatch = html.match(/<span[^>]*class="pl">片长:<\/span>([^<]+)/);
      if (movieDurationMatch) {
        movie_duration = parseInt(movieDurationMatch[1].trim()) || undefined;
      }
    }

    // 提取剧情简介 - 使用更宽松的匹配，支持HTML标签
    const summaryMatch = html.match(/<span[^>]*class="all hidden">([\s\S]*?)<\/span>/) ||
      html.match(/<span[^>]*property="v:summary"[^>]*>([\s\S]*?)<\/span>/);
    let plot_summary = '';
    if (summaryMatch) {
      // 移除HTML标签，保留文本内容
      plot_summary = summaryMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')  // 将<br>转换为换行
        .replace(/<[^>]+>/g, '')         // 移除其他HTML标签
        .trim()
        .replace(/\n{3,}/g, '\n\n');     // 将多个换行合并为最多两个
    }

    // 提取IMDb ID：<span class="pl">IMDb:</span> tt36758770
    const imdbMatch = html.match(/<span class="pl">IMDb:<\/span>\s*(tt\d+)/i);
    const imdb_id = imdbMatch ? imdbMatch[1] : '';

    // 提取演员照片（从 celebrities 区域）- 增强版
    const celebrities: Array<{
      id: string;
      name: string;
      avatar: string;
      role: string;
      avatars?: {
        small: string;
        medium: string;
        large: string;
      };
    }> = [];

    const celebritiesSection = html.match(/<div id="celebrities"[\s\S]*?<ul class="celebrities-list[^"]*">([\s\S]*?)<\/ul>/);
    if (celebritiesSection) {
      const celebrityItems = celebritiesSection[1].match(/<li[\s\S]*?<\/li>/g);
      if (celebrityItems) {
        celebrityItems.forEach(item => {
          // 提取演员ID和名字 - 支持 personage 和 celebrity 两种URL格式
          const linkMatch = item.match(/<a href="https:\/\/www\.douban\.com\/(personage|celebrity)\/(\d+)\/[^"]*"\s+title="([^"]+)"/);

          // 🎯 三种方法提取头像 URL
          let avatarUrl = '';

          // 方法 1: CSS 背景图（最常见）
          const bgMatch = item.match(/background-image:\s*url\(([^)]+)\)/);
          if (bgMatch) {
            avatarUrl = bgMatch[1].replace(/^['"]|['"]$/g, ''); // 去掉引号
          }

          // 方法 2: IMG 标签 (fallback)
          if (!avatarUrl) {
            const imgMatch = item.match(/<img[^>]*src="([^"]+)"/);
            if (imgMatch) {
              avatarUrl = imgMatch[1];
            }
          }

          // 方法 3: data-src 属性
          if (!avatarUrl) {
            const dataSrcMatch = item.match(/data-src="([^"]+)"/);
            if (dataSrcMatch) {
              avatarUrl = dataSrcMatch[1];
            }
          }

          // 提取角色
          const roleMatch = item.match(/<span class="role"[^>]*>([^<]+)<\/span>/);

          if (linkMatch && avatarUrl) {
            // 清理URL
            avatarUrl = avatarUrl.trim().replace(/^http:/, 'https:');

            // 🎨 高清图替换：/s/ → /l/, /m/ → /l/
            const largeUrl = avatarUrl
              .replace(/\/s\//, '/l/')
              .replace(/\/m\//, '/l/')
              .replace('/s_ratio/', '/l_ratio/')
              .replace('/m_ratio/', '/l_ratio/')
              .replace('/small/', '/large/')
              .replace('/medium/', '/large/');

            // 过滤掉默认头像
            const isDefaultAvatar = avatarUrl.includes('personage-default') ||
              avatarUrl.includes('celebrity-default') ||
              avatarUrl.includes('has_douban');

            if (!isDefaultAvatar) {
              celebrities.push({
                id: linkMatch[2],  // 第二个捕获组是ID
                name: linkMatch[3].split(' ')[0], // 第三个捕获组是名字，只取中文名
                avatar: avatarUrl,
                role: roleMatch ? roleMatch[1].trim() : '',
                // 🎯 新增：返回三种尺寸的头像
                avatars: {
                  small: largeUrl
                    .replace('/l/', '/s/')
                    .replace('/l_ratio/', '/s_ratio/')
                    .replace('/large/', '/small/'),
                  medium: largeUrl
                    .replace('/l/', '/m/')
                    .replace('/l_ratio/', '/m_ratio/')
                    .replace('/large/', '/medium/'),
                  large: largeUrl,
                },
              });
            }
          }
        });
      }
    }

    // 提取推荐影片
    const recommendations: Array<{
      id: string;
      title: string;
      poster: string;
      rate: string;
    }> = [];

    const recommendationsSection = html.match(/<div id="recommendations">[\s\S]*?<div class="recommendations-bd">([\s\S]*?)<\/div>/);
    if (recommendationsSection) {
      const recommendItems = recommendationsSection[1].match(/<dl>[\s\S]*?<\/dl>/g);
      if (recommendItems) {
        recommendItems.forEach(item => {
          // 提取影片ID
          const idMatch = item.match(/\/subject\/(\d+)\//);
          // 提取标题
          const titleMatch = item.match(/alt="([^"]+)"/);
          // 提取海报
          const posterMatch = item.match(/<img src="([^"]+)"/);
          // 提取评分
          const rateMatch = item.match(/<span class="subject-rate">([^<]+)<\/span>/);

          if (idMatch && titleMatch && posterMatch) {
            recommendations.push({
              id: idMatch[1],
              title: titleMatch[1],
              poster: posterMatch[1],
              rate: rateMatch ? rateMatch[1] : ''
            });
          }
        });
      }
    }

    // 🎬 提取剧照作为backdrop（横版高清图，比竖版海报更适合做背景）
    let scenePhoto: string | undefined;
    const photosSection = html.match(/<div[^>]*id="related-pic"[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/);
    if (photosSection) {
      // 查找第一张剧照图片URL
      const photoMatch = photosSection[1].match(/https:\/\/img[0-9]\.doubanio\.com\/view\/photo\/[a-z_]*\/public\/p[0-9]+\.jpg/);
      if (photoMatch) {
        // 转换为高清版本（使用l而不是raw，避免重定向）
        scenePhoto = photoMatch[0]
          .replace(/^http:/, 'https:')
          .replace('/view/photo/s/', '/view/photo/l/')
          .replace('/view/photo/m/', '/view/photo/l/')
          .replace('/view/photo/sqxs/', '/view/photo/l/');
      }
    }

    return {
      code: 200,
      message: '获取成功',
      data: {
        id,
        title,
        poster: poster.replace(/^http:/, 'https:'),
        rate,
        year,
        directors,
        screenwriters,
        cast,
        genres,
        countries,
        languages,
        episodes,
        episode_length,
        movie_duration,
        first_aired,
        plot_summary,
        imdb_id,
        celebrities,
        recommendations,
        // 🎯 新增：将 celebrities 中的演员单独提取为 actors 字段
        actors: celebrities.filter(c => !c.role.includes('导演')),
        // 🎬 剧照作为backdrop（横版高清图）
        backdrop: scenePhoto,
        // 🎬 预告片URL（由移动端API填充）
        trailerUrl: undefined as string | undefined,
      }
    };
  } catch (error) {
    throw new DoubanError(
      `解析豆瓣详情页面失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'PARSE_ERROR',
    );
  }
}