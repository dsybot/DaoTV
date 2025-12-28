import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';

// 用户代理池
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

// 请求限制器 - 使用代理时可以更快
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // 降低到0.5秒（使用代理时风险较低）
const MIN_REQUEST_INTERVAL_NO_PROXY = 2000; // 无代理时保持2秒

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min = 100, max = 300): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

export const runtime = 'nodejs';

// ============================================================================
// 核心爬虫函数（带缓存）
// ============================================================================

/**
 * 爬取豆瓣详情页面（内部函数）
 */
async function _scrapeDoubanDetails(id: string, proxyUrl: string) {
  const originalUrl = `https://movie.douban.com/subject/${id}/`;
  // 如果配置了代理，使用代理地址
  const target = proxyUrl
    ? `${proxyUrl}${encodeURIComponent(originalUrl)}`
    : originalUrl;

  console.log(`[豆瓣详情] 请求URL: ${target}`);

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

  // 添加随机延时（使用代理时延时更短）
  if (proxyUrl) {
    await randomDelay(50, 150); // 使用代理：50-150ms
  } else {
    await randomDelay(500, 1500); // 无代理：500-1500ms
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const fetchOptions = {
    signal: controller.signal,
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
      // 随机添加Referer
      ...(Math.random() > 0.5 ? { 'Referer': 'https://www.douban.com/' } : {}),
    },
  };

  const response = await fetch(target, fetchOptions);
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const html = await response.text();

  // 解析详细信息
  return parseDoubanDetails(html, id);
}

/**
 * 使用 unstable_cache 包裹爬虫函数
 * - 24小时缓存
 * - 自动重新验证
 */
const scrapeDoubanDetails = unstable_cache(
  _scrapeDoubanDetails,
  ['douban-details'],
  {
    revalidate: 86400, // 24小时缓存
    tags: ['douban'],
  }
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: '缺少必要参数: id' },
      { status: 400 }
    );
  }

  // 获取代理配置
  const config = await getConfig();
  const proxyUrl = config.SiteConfig.DoubanDetailProxy || '';

  try {
    const details = await scrapeDoubanDetails(id, proxyUrl);

    const cacheTime = await getCacheTime();
    return NextResponse.json(details, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=86400, stale-while-revalidate=43200`,
        'CDN-Cache-Control': `public, s-maxage=86400`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=86400`,
        'Netlify-Vary': 'query',
        'X-Data-Source': 'scraper-cached',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取豆瓣详情失败', details: (error as Error).message },
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
      }
    };
  } catch (error) {
    throw new Error(`解析豆瓣详情页面失败: ${(error as Error).message}`);
  }
}