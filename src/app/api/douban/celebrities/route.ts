import { NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';

// 用户代理池
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

// 请求限制器
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2秒最小间隔

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min = 1000, max = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
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

  const originalUrl = `https://movie.douban.com/subject/${id}/celebrities`;
  // 如果配置了代理，使用代理地址
  const target = proxyUrl
    ? `${proxyUrl}${encodeURIComponent(originalUrl)}`
    : originalUrl;

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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
        ...(Math.random() > 0.5 ? { 'Referer': 'https://movie.douban.com/' } : {}),
      },
    };

    const response = await fetch(target, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const html = await response.text();

    // 解析演员列表
    const celebrities = parseDoubanCelebrities(html);

    const cacheTime = await getCacheTime();
    return NextResponse.json({
      code: 200,
      message: '获取成功',
      data: {
        celebrities,
        count: celebrities.length
      }
    }, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Netlify-Vary': 'query',
      },
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
  role: string;        // 职位（演员/导演/编剧等）
  character: string;   // 饰演的角色名
  douban_id: string;   // 豆瓣演员ID
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
    const celebrityRegex = /<li class="celebrity">([\s\S]*?)<\/li>/g;
    let match;

    while ((match = celebrityRegex.exec(html)) !== null) {
      try {
        const item = match[1];

        // 提取演员名 - 从 a 标签的 title 属性
        const nameMatch = item.match(/<a[^>]*href="https:\/\/www\.douban\.com\/personage\/(\d+)\/"[^>]*title="([^"]+)"/);
        if (!nameMatch) continue;

        const douban_id = nameMatch[1];
        const fullName = nameMatch[2].trim();
        // 取中文名（第一个空格前的部分，或整个名字）
        const name = fullName.split(/\s+/)[0] || fullName;

        // 提取角色信息 - 从 span.role 的 title 属性
        const roleMatch = item.match(/<span class="role"[^>]*title="([^"]+)"/);
        let role = '';
        let character = '';

        if (roleMatch) {
          const roleText = roleMatch[1];
          // 解析角色信息，格式如 "演员 Actor (饰 赤发)" 或 "导演 Director"
          const roleTypeMatch = roleText.match(/^([^\s(]+)/);
          role = roleTypeMatch ? roleTypeMatch[1] : '';

          // 提取饰演的角色名
          const characterMatch = roleText.match(/饰\s*([^)]+)/);
          character = characterMatch ? characterMatch[1].trim() : '';
        }

        // 只添加演员（有角色名的）
        if (name && role === '演员') {
          celebrities.push({
            name,
            role,
            character,
            douban_id
          });
        }
      } catch (e) {
        // 跳过解析失败的单条记录
        console.warn('解析单条演员信息失败:', e);
      }
    }

    return celebrities;
  } catch (error) {
    console.error('解析豆瓣演员表失败:', error);
    return [];
  }
}
