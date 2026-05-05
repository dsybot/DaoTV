import { NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';
import { fetchDoubanWithVerification } from '@/lib/douban-anti-crawler';
import {
  getRandomUserAgentWithInfo,
  getSecChUaHeaders,
} from '@/lib/user-agent';

// 请求限制器
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2秒最小间隔

function randomDelay(min = 1000, max = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function getDoubanCookies(): Promise<string | null> {
  try {
    const config = await getConfig();
    return config.DoubanConfig?.cookies || null;
  } catch (error) {
    console.warn('[Douban Celebrities] 获取 cookies 配置失败:', error);
    return null;
  }
}

function isDoubanChallengePage(html: string): boolean {
  return (
    html.includes('sec.douban.com') ||
    html.includes('form name="sec"') ||
    (html.includes('name="tok"') && html.includes('name="cha"')) ||
    (html.includes('sha512') &&
      html.includes('process(cha)') &&
      html.includes('载入中'))
  );
}

async function tryFetchWithAntiCrawler(url: string): Promise<string | null> {
  try {
    console.log('[Douban Celebrities] 尝试使用反爬验证');
    const response = await fetchDoubanWithVerification(url);

    if (!response.ok) {
      console.log(
        `[Douban Celebrities] 反爬验证返回状态: ${response.status}`,
      );
      return null;
    }

    const html = await response.text();
    if (isDoubanChallengePage(html)) {
      console.log('[Douban Celebrities] 反爬验证仍返回 challenge 页面');
      return null;
    }

    console.log(
      `[Douban Celebrities] 反爬验证成功，页面长度: ${html.length}`,
    );
    return html;
  } catch (error) {
    console.warn('[Douban Celebrities] 反爬验证失败:', error);
    return null;
  }
}

async function fetchDoubanHtml(url: string): Promise<string> {
  const antiCrawlerHtml = await tryFetchWithAntiCrawler(url);
  if (antiCrawlerHtml) return antiCrawlerHtml;

  const { ua, browser, platform } = getRandomUserAgentWithInfo();
  const secChHeaders = getSecChUaHeaders(browser, platform);
  const doubanCookies = await getDoubanCookies();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        DNT: '1',
        ...secChHeaders,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': ua,
        ...(Math.random() > 0.5
          ? { Referer: 'https://movie.douban.com/' }
          : {}),
        ...(doubanCookies ? { Cookie: doubanCookies } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    let html = await response.text();
    if (!isDoubanChallengePage(html)) {
      return html;
    }

    // Puppeteer 已禁用以减少包体积（78MB）
    throw new Error('豆瓣反爬虫激活，演职员功能暂时不可用，请配置 Cookies');
  } finally {
    clearTimeout(timeoutId);
  }
}

export const runtime = 'nodejs';

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

  const celebritiesUrl = `https://movie.douban.com/subject/${id}/celebrities`;
  const detailsUrl = `https://movie.douban.com/subject/${id}/`;
  // 如果配置了代理，使用代理地址
  const target = proxyUrl
    ? `${proxyUrl}${encodeURIComponent(celebritiesUrl)}`
    : celebritiesUrl;
  const detailTarget = proxyUrl
    ? `${proxyUrl}${encodeURIComponent(detailsUrl)}`
    : detailsUrl;

  console.log(`[豆瓣演员表] 请求URL: ${target}`);

  try {
    // 请求限流：确保请求间隔
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve =>
        setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }
    lastRequestTime = Date.now();

    // 添加随机延时
    await randomDelay(500, 1500);

    const html = await fetchDoubanHtml(target);

    // 先解析完整演员页；如果为空，回退解析详情页的 #celebrities 区块。
    let celebrities = parseDoubanCelebrities(html);
    if (celebrities.length === 0) {
      console.warn('[豆瓣演员表] 演员页解析为空，尝试从详情页演员区回退解析');
      const detailHtml = await fetchDoubanHtml(detailTarget);
      celebrities = parseDoubanCelebrities(detailHtml);
    }

  // 代理返回不完整时，再尝试直连源站。这里仍会走反爬验证/Cookies。
    if (proxyUrl && celebrities.length === 0) {
      console.warn('[豆瓣演员表] 代理解析为空，尝试直连豆瓣演员页');
      const directHtml = await fetchDoubanHtml(celebritiesUrl);
      celebrities = parseDoubanCelebrities(directHtml);
    }

    if (proxyUrl && celebrities.length === 0) {
      console.warn('[豆瓣演员表] 直连演员页仍为空，尝试直连豆瓣详情页');
      const directDetailHtml = await fetchDoubanHtml(detailsUrl);
      celebrities = parseDoubanCelebrities(directDetailHtml);
    }

    const cacheTime = await getCacheTime();
    const cacheHeaders =
      celebrities.length > 0
        ? {
            'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
            'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
            'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
            'Netlify-Vary': 'query',
          }
        : {
            'Cache-Control': 'no-store',
          };

    return NextResponse.json({
      code: 200,
      message: '获取成功',
      data: {
        celebrities,
        count: celebrities.length
      }
    }, {
      headers: cacheHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取豆瓣演员表失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

interface DoubanCelebrity {
  name: string;        // 演员名
  full_name: string;   // 豆瓣 title 原始姓名（通常包含中文名和英文名）
  name_en: string;     // 英文名（如果豆瓣提供）
  aliases: string[];   // 用于本地匹配的别名
  role: string;        // 职位（演员/导演/编剧等）
  character: string;   // 饰演的角色名
  douban_id: string;   // 豆瓣演员ID
  order: number;       // 豆瓣演员表顺序
}

function decodeHtmlText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .trim();
}

function uniqueValues(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = value?.trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });

  return result;
}

function reverseEnglishName(name: string): string {
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 4) return '';
  return [...tokens].reverse().join(' ');
}

function parseDoubanName(fullName: string): {
  name: string;
  name_en: string;
  aliases: string[];
} {
  const cleanFullName = decodeHtmlText(fullName);
  const leadingChinese = cleanFullName.match(/^[\u3400-\u9fff·・]+/);
  const name = leadingChinese?.[0] || cleanFullName.split(/\s+/)[0] || cleanFullName;
  const remainder = leadingChinese
    ? cleanFullName.slice(leadingChinese[0].length).trim()
    : '';
  const name_en = /[a-zA-Z]/.test(remainder) ? remainder : '';

  const aliases = uniqueValues([
    cleanFullName,
    name,
    name_en,
    reverseEnglishName(name_en),
  ]);

  return { name, name_en, aliases };
}

function stripHtmlTags(text: string): string {
  return decodeHtmlText(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

function extractRoleInfo(item: string): { role: string; character: string } {
  const roleAttrMatch = item.match(
    /<span[^>]*class=["'][^"']*role[^"']*["'][^>]*title=["']([^"']+)["'][^>]*>/,
  );
  const roleTextMatch = item.match(
    /<span[^>]*class=["'][^"']*role[^"']*["'][^>]*>([\s\S]*?)<\/span>/,
  );
  const roleText = stripHtmlTags(roleAttrMatch?.[1] || roleTextMatch?.[1] || '');
  const roleTypeMatch = roleText.match(/^([^\s(（]+)/);
  const isActor = roleText.includes('演员') || /\bActor\b/i.test(roleText);
  const characterMatch = roleText.match(/饰(?:演)?\s*[:：]?\s*([^)）]+)/);

  return {
    role: isActor ? '演员' : roleTypeMatch?.[1] || '',
    character: characterMatch ? characterMatch[1].trim() : '',
  };
}

function collectCelebrityItems(html: string): string[] {
  const sectionMatch = html.match(
    /<div[^>]*id=["']celebrities["'][\s\S]*?<ul[^>]*class=["'][^"']*celebrities-list[^"']*["'][^>]*>([\s\S]*?)<\/ul>/,
  );
  const source = sectionMatch?.[1] || html;
  const items = source.match(
    /<li[^>]*class=["'][^"']*celebrity[^"']*["'][^>]*>[\s\S]*?<\/li>/g,
  );

  if (items && items.length > 0) {
    return items;
  }

  return sectionMatch ? sectionMatch[1].match(/<li[\s\S]*?<\/li>/g) || [] : [];
}

function parseDoubanCelebrities(html: string): DoubanCelebrity[] {
  const celebrities: DoubanCelebrity[] = [];

  try {
    // 匹配所有 celebrity li 元素
    // <li class="celebrity">
    //   <a href="https://www.douban.com/personage/27480235/" title="邓超 Chao Deng" class>...</a>
    //   <div class="info">
    //     <span class="name">...</span>
    //     <span class="role" title="演员 Actor (饰 赤发)">演员 Actor (饰 赤发)</span>
    //     <span class="works">...</span>
    //   </div>
    // </li>
    const celebrityItems = collectCelebrityItems(html);
    const seen = new Set<string>();

    celebrityItems.forEach((item) => {
      try {
        // 提取演员ID和姓名 - 支持 personage 和 celebrity 两种URL格式
        const idMatch = item.match(
          /href=["']https:\/\/www\.douban\.com\/(?:personage|celebrity)\/(\d+)\/[^"']*["']/,
        );
        const titleMatch = item.match(/<a[^>]*title=["']([^"']+)["']/);
        const nameMatch = item.match(
          /<span[^>]*class=["'][^"']*name[^"']*["'][^>]*>([\s\S]*?)<\/span>/,
        );

        if (!idMatch || (!titleMatch && !nameMatch)) return;

        const douban_id = idMatch[1];
        const fullName = titleMatch
          ? decodeHtmlText(titleMatch[1])
          : stripHtmlTags(nameMatch?.[1] || '');
        if (!fullName) return;

        const { name, name_en, aliases } = parseDoubanName(fullName);
        const { role, character } = extractRoleInfo(item);

        if (name && (role === '演员' || role.includes('演员'))) {
          const dedupeKey = douban_id || name.toLowerCase();
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);

          celebrities.push({
            name,
            full_name: fullName,
            name_en,
            aliases,
            role,
            character,
            douban_id,
            order: celebrities.length,
          });
        }
      } catch (e) {
        console.warn('解析单条演员信息失败:', e);
      }
    });

    return celebrities;
  } catch (error) {
    console.error('解析豆瓣演员表失败:', error);
    return [];
  }
}
