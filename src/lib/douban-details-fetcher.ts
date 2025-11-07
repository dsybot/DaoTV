/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

/**
 * 服务器端豆瓣详情获取器
 * 直接调用豆瓣网页，解析genres和first_aired
 */

// 用户代理池
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min = 500, max = 1500): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 获取豆瓣详情（genres和首播日期）
 */
export async function fetchDoubanDetailsForCarousel(doubanId: string): Promise<{
  genres: string[];
  first_aired: string;
} | null> {
  try {
    const target = `https://movie.douban.com/subject/${doubanId}/`;

    // 添加随机延时防止反爬
    await randomDelay();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(target, {
      signal: controller.signal,
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.douban.com/',
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[豆瓣详情] HTTP ${response.status}: ${doubanId}`);
      return null;
    }

    const html = await response.text();

    // 提取类型/genres
    const genreMatches = html.match(/<span[^>]*property="v:genre">([^<]+)<\/span>/g);
    const genres = genreMatches ? genreMatches.map(match => {
      const result = match.match(/<span[^>]*property="v:genre">([^<]+)<\/span>/);
      return result ? result[1] : '';
    }).filter(Boolean) : [];

    // 提取首播/上映日期
    let first_aired = '';

    // 首播信息：<span class="pl">首播:</span> <span property="v:initialReleaseDate" content="2025-08-13(中国大陆)">
    const firstAiredMatch = html.match(/<span class="pl">首播:<\/span>\s*<span[^>]*property="v:initialReleaseDate"[^>]*content="([^"]*)"[^>]*>/);
    if (firstAiredMatch) {
      first_aired = firstAiredMatch[1].split('(')[0]; // 移除地区信息
    } else {
      // 如果没有首播，尝试上映日期
      const releaseDateMatch = html.match(/<span class="pl">上映日期:<\/span>\s*<span[^>]*property="v:initialReleaseDate"[^>]*content="([^"]*)"[^>]*>/);
      if (releaseDateMatch) {
        first_aired = releaseDateMatch[1].split('(')[0];
      }
    }

    return {
      genres,
      first_aired,
    };
  } catch (error) {
    console.warn(`[豆瓣详情] 获取失败 ${doubanId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

