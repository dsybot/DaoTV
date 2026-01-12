import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { DEFAULT_USER_AGENT } from '@/lib/user-agent';

/**
 * 刷新过期的 Douban trailer URL
 * 不使用任何缓存，直接调用豆瓣移动端API获取最新URL
 * 支持通过代理获取（如果配置了DoubanDetailProxy）
 * 
 * 注意：豆瓣移动端API对电影和电视剧使用不同的路径
 * - 电影: /movie/{id}
 * - 电视剧: /tv/{id}
 */

// 获取trailer的函数（支持重定向检测）
async function fetchTrailerWithRedirectDetection(id: string, proxyUrl?: string): Promise<string | null> {
  const TIMEOUT = 15000;

  try {
    // 先尝试 movie 端点
    let mobileApiUrl = `https://m.douban.com/rexxar/api/v2/movie/${id}`;

    console.log(`[refresh-trailer] 开始请求: ${id}`);

    // 如果配置了代理，使用代理地址，并添加 noredirect 参数
    let targetUrl = proxyUrl
      ? `${proxyUrl}${encodeURIComponent(mobileApiUrl)}&noredirect=1`
      : mobileApiUrl;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    let response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Referer': 'https://movie.douban.com/explore',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Origin': 'https://movie.douban.com',
      },
      redirect: proxyUrl ? 'follow' : 'manual', // 无代理时手动处理重定向
    });

    clearTimeout(timeoutId);

    // 如果是 3xx 重定向，说明可能是电视剧，尝试 tv 端点
    if (response.status >= 300 && response.status < 400) {
      console.log(`[refresh-trailer] 检测到重定向，尝试 TV 端点: ${id}`);
      mobileApiUrl = `https://m.douban.com/rexxar/api/v2/tv/${id}`;

      targetUrl = proxyUrl
        ? `${proxyUrl}${encodeURIComponent(mobileApiUrl)}`
        : mobileApiUrl;

      const tvController = new AbortController();
      const tvTimeoutId = setTimeout(() => tvController.abort(), TIMEOUT);

      response = await fetch(targetUrl, {
        signal: tvController.signal,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Referer': 'https://movie.douban.com/explore',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Origin': 'https://movie.douban.com',
        },
      });

      clearTimeout(tvTimeoutId);
    }

    console.log(`[refresh-trailer] 请求完成，状态: ${response.status}`);

    if (!response.ok) {
      console.warn(`[refresh-trailer] 请求失败: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const trailerUrl = data.trailers?.[0]?.video_url;

    if (trailerUrl) {
      console.log(`[refresh-trailer] 成功获取trailer URL`);
    }

    return trailerUrl || null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[refresh-trailer] 请求超时`);
    } else {
      console.warn(`[refresh-trailer] 获取失败: ${(error as Error).message}`);
    }
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

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

  try {
    // 获取代理配置
    const config = await getConfig();
    const proxyUrl = config.SiteConfig.DoubanDetailProxy || undefined;

    console.log(`[refresh-trailer] ID: ${id}, 代理: ${proxyUrl ? proxyUrl.substring(0, 30) + '...' : '(无)'}`);

    const trailerUrl = await fetchTrailerWithRedirectDetection(id, proxyUrl);

    if (!trailerUrl) {
      return NextResponse.json(
        {
          code: 404,
          message: '未能获取预告片URL（movie和tv类型都尝试过）',
          error: 'NO_TRAILER',
        },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    }

    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        data: {
          trailerUrl,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error(`[refresh-trailer] 异常:`, error);

    return NextResponse.json(
      {
        code: 500,
        message: '刷新 trailer URL 失败',
        error: 'UNKNOWN_ERROR',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
