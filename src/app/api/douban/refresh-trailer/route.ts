import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordRequest } from '@/lib/performance-monitor';
import { DEFAULT_USER_AGENT } from '@/lib/user-agent';
import { isVideoCached } from '@/lib/video-cache';

/**
 * 刷新过期的 Douban trailer URL
 *
 * 三层缓存策略：
 * 1. Redis URL 缓存（24小时）- 最快，存储豆瓣返回的 URL
 * 2. 视频文件缓存（12小时）- 次快，本地已有视频文件时直接返回代理 URL
 * 3. 豆瓣 API - 最慢，所有缓存都未命中时才请求
 *
 * 优势：
 * - 即使 Redis URL 缓存过期，只要视频文件还在就不需要请求豆瓣
 * - 大幅减少对豆瓣 API 的请求次数，避免被封 IP
 */

type CacheStatus = 'success' | 'no_trailer' | 'failed';

interface TrailerCache {
  url: string | null;
  status: CacheStatus;
  timestamp: number;
}

const CACHE_TTL = {
  success: 24 * 60 * 60,
  no_trailer: 24 * 60 * 60,
  failed: 5 * 60,
};

function getCacheKey(id: string): string {
  return `trailer:${id}`;
}

async function getCache(id: string): Promise<TrailerCache | null> {
  try {
    const cached = await db.getCache(getCacheKey(id));
    return cached as TrailerCache | null;
  } catch (error) {
    console.error('[refresh-trailer] Redis 读取失败:', error);
    return null;
  }
}

async function setCache(id: string, data: TrailerCache): Promise<void> {
  try {
    const ttl = CACHE_TTL[data.status];
    await db.setCache(getCacheKey(id), data, ttl);
    console.log(`[refresh-trailer] 已缓存 ${id}，状态: ${data.status}，TTL: ${ttl}秒`);
  } catch (error) {
    console.error('[refresh-trailer] Redis 写入失败:', error);
  }
}

async function clearCache(id: string): Promise<void> {
  try {
    await db.deleteCache(getCacheKey(id));
    console.log(`[refresh-trailer] 已清除缓存 ${id}`);
  } catch (error) {
    console.error('[refresh-trailer] Redis 删除失败:', error);
  }
}

async function fetchTrailerWithRetry(
  id: string,
  retryCount = 0,
): Promise<string | null> {
  const MAX_RETRIES = 2;
  const TIMEOUT = 20000;
  const RETRY_DELAY = 2000;

  const startTime = Date.now();

  try {
    let mobileApiUrl = `https://m.douban.com/rexxar/api/v2/movie/${id}`;

    console.log(
      `[refresh-trailer] 开始请求影片 ${id}${retryCount > 0 ? ` (重试 ${retryCount}/${MAX_RETRIES})` : ''}`,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    let response = await fetch(mobileApiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: 'https://movie.douban.com/explore',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Origin: 'https://movie.douban.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
      },
      redirect: 'manual',
    });

    clearTimeout(timeoutId);

    if (response.status >= 300 && response.status < 400) {
      console.log('[refresh-trailer] 检测到重定向，尝试 TV 端点');
      mobileApiUrl = `https://m.douban.com/rexxar/api/v2/tv/${id}`;

      const tvController = new AbortController();
      const tvTimeoutId = setTimeout(() => tvController.abort(), TIMEOUT);

      response = await fetch(mobileApiUrl, {
        signal: tvController.signal,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Referer: 'https://movie.douban.com/explore',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          Origin: 'https://movie.douban.com',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
        },
      });

      clearTimeout(tvTimeoutId);
    }

    const fetchTime = Date.now() - startTime;
    console.log(
      `[refresh-trailer] 影片 ${id} 请求完成，耗时: ${fetchTime}ms, 状态: ${response.status}`,
    );

    if (!response.ok) {
      throw new Error(`豆瓣API返回错误: ${response.status}`);
    }

    const data = await response.json();
    const trailerUrl = data.trailers?.[0]?.video_url;

    if (!trailerUrl) {
      console.warn(`[refresh-trailer] 影片 ${id} 没有预告片数据`);
      throw new Error('该影片没有预告片');
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `[refresh-trailer] 影片 ${id} 成功获取trailer URL，总耗时: ${totalTime}ms`,
    );

    return trailerUrl;
  } catch (error) {
    const failTime = Date.now() - startTime;

    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('fetch'))
    ) {
      console.error(
        `[refresh-trailer] 影片 ${id} 请求失败 (耗时: ${failTime}ms): ${error.name === 'AbortError' ? '超时' : error.message}`,
      );

      if (retryCount < MAX_RETRIES) {
        console.warn(
          `[refresh-trailer] ${RETRY_DELAY}ms后重试 (${retryCount + 1}/${MAX_RETRIES})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return fetchTrailerWithRetry(id, retryCount + 1);
      }

      console.error(`[refresh-trailer] 影片 ${id} 重试次数已达上限，放弃请求`);
    } else {
      console.error(
        `[refresh-trailer] 影片 ${id} 发生错误 (耗时: ${failTime}ms):`,
        error,
      );
    }

    throw error;
  }
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const force = searchParams.get('force') === 'true';

  if (!id) {
    const errorResponse = {
      code: 400,
      message: '缺少必要参数: id',
      error: 'MISSING_PARAMETER',
    };
    const errorSize = Buffer.byteLength(JSON.stringify(errorResponse), 'utf8');

    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/douban/refresh-trailer',
      statusCode: 400,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      dbQueries: 0,
      requestSize: 0,
      responseSize: errorSize,
    });

    return NextResponse.json(errorResponse, { status: 400 });
  }

  if (force) {
    console.log(`[refresh-trailer] 强制刷新，清除缓存: ${id}`);
    await clearCache(id);
  } else {
    const cached = await getCache(id);
    if (cached) {
      const now = Date.now();
      const age = Math.floor((now - cached.timestamp) / 1000);

      console.log(
        `[refresh-trailer] 命中 Redis 缓存: ${id}，状态: ${cached.status}，年龄: ${age}秒`,
      );

      if (cached.status === 'success' && cached.url) {
        const successResponse = {
          code: 200,
          message: '获取成功（Redis 缓存）',
          data: {
            trailerUrl: cached.url,
          },
        };
        const responseSize = Buffer.byteLength(
          JSON.stringify(successResponse),
          'utf8',
        );

        recordRequest({
          timestamp: startTime,
          method: 'GET',
          path: '/api/douban/refresh-trailer',
          statusCode: 200,
          duration: Date.now() - startTime,
          memoryUsed:
            (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
          dbQueries: 0,
          requestSize: 0,
          responseSize,
        });

        return NextResponse.json(successResponse, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          },
        });
      }

      if (cached.status === 'no_trailer') {
        const noTrailerResponse = {
          code: 404,
          message: '该影片没有预告片（缓存）',
          error: 'NO_TRAILER',
        };
        const noTrailerSize = Buffer.byteLength(
          JSON.stringify(noTrailerResponse),
          'utf8',
        );

        recordRequest({
          timestamp: startTime,
          method: 'GET',
          path: '/api/douban/refresh-trailer',
          statusCode: 404,
          duration: Date.now() - startTime,
          memoryUsed:
            (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
          dbQueries: 0,
          requestSize: 0,
          responseSize: noTrailerSize,
        });

        return NextResponse.json(noTrailerResponse, { status: 404 });
      }

      if (cached.status === 'failed') {
        const failedResponse = {
          code: 500,
          message: '刷新 trailer URL 失败（缓存）',
          error: 'FETCH_ERROR',
          details: '服务端错误，请稍后重试',
        };
        const failedSize = Buffer.byteLength(
          JSON.stringify(failedResponse),
          'utf8',
        );

        recordRequest({
          timestamp: startTime,
          method: 'GET',
          path: '/api/douban/refresh-trailer',
          statusCode: 500,
          duration: Date.now() - startTime,
          memoryUsed:
            (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
          dbQueries: 0,
          requestSize: 0,
          responseSize: failedSize,
        });

        return NextResponse.json(failedResponse, { status: 500 });
      }
    }

    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE;
    if (storageType === 'kvrocks') {
      try {
        const tempUrl = `https://vt1.doubanio.com/placeholder/M/${id}.mp4`;
        const videoFileExists = await isVideoCached(tempUrl);

        if (videoFileExists) {
          console.log(`[refresh-trailer] 命中视频文件缓存: ${id}，返回代理 URL`);

          const cachedVideoUrl = `/api/video-proxy?url=${encodeURIComponent(tempUrl)}`;

          const successResponse = {
            code: 200,
            message: '获取成功（视频文件缓存）',
            data: {
              trailerUrl: cachedVideoUrl,
            },
          };
          const responseSize = Buffer.byteLength(
            JSON.stringify(successResponse),
            'utf8',
          );

          recordRequest({
            timestamp: startTime,
            method: 'GET',
            path: '/api/douban/refresh-trailer',
            statusCode: 200,
            duration: Date.now() - startTime,
            memoryUsed:
              (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
            dbQueries: 0,
            requestSize: 0,
            responseSize,
          });

          return NextResponse.json(successResponse, {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
              Pragma: 'no-cache',
              Expires: '0',
            },
          });
        }
      } catch (error) {
        console.error('[refresh-trailer] 检查视频文件缓存失败:', error);
      }
    }
  }

  try {
    const trailerUrl = await fetchTrailerWithRetry(id);

    await setCache(id, {
      url: trailerUrl,
      status: 'success',
      timestamp: Date.now(),
    });

    const successResponse = {
      code: 200,
      message: '获取成功',
      data: {
        trailerUrl,
      },
    };
    const responseSize = Buffer.byteLength(JSON.stringify(successResponse), 'utf8');

    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/douban/refresh-trailer',
      statusCode: 200,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      dbQueries: 0,
      requestSize: 0,
      responseSize,
    });

    return NextResponse.json(successResponse, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        await setCache(id, {
          url: null,
          status: 'failed',
          timestamp: Date.now(),
        });

        const timeoutResponse = {
          code: 504,
          message: '请求超时，豆瓣响应过慢',
          error: 'TIMEOUT',
        };
        const timeoutSize = Buffer.byteLength(JSON.stringify(timeoutResponse), 'utf8');

        recordRequest({
          timestamp: startTime,
          method: 'GET',
          path: '/api/douban/refresh-trailer',
          statusCode: 504,
          duration: Date.now() - startTime,
          memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
          dbQueries: 0,
          requestSize: 0,
          responseSize: timeoutSize,
        });

        return NextResponse.json(timeoutResponse, { status: 504 });
      }

      if (error.message.includes('没有预告片')) {
        await setCache(id, {
          url: null,
          status: 'no_trailer',
          timestamp: Date.now(),
        });

        const noTrailerResponse = {
          code: 404,
          message: error.message,
          error: 'NO_TRAILER',
        };
        const noTrailerSize = Buffer.byteLength(
          JSON.stringify(noTrailerResponse),
          'utf8',
        );

        recordRequest({
          timestamp: startTime,
          method: 'GET',
          path: '/api/douban/refresh-trailer',
          statusCode: 404,
          duration: Date.now() - startTime,
          memoryUsed:
            (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
          dbQueries: 0,
          requestSize: 0,
          responseSize: noTrailerSize,
        });

        return NextResponse.json(noTrailerResponse, { status: 404 });
      }

      await setCache(id, {
        url: null,
        status: 'failed',
        timestamp: Date.now(),
      });

      const fetchErrorResponse = {
        code: 500,
        message: '刷新 trailer URL 失败',
        error: 'FETCH_ERROR',
        details: error.message,
      };
      const fetchErrorSize = Buffer.byteLength(
        JSON.stringify(fetchErrorResponse),
        'utf8',
      );

      recordRequest({
        timestamp: startTime,
        method: 'GET',
        path: '/api/douban/refresh-trailer',
        statusCode: 500,
        duration: Date.now() - startTime,
        memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
        dbQueries: 0,
        requestSize: 0,
        responseSize: fetchErrorSize,
      });

      return NextResponse.json(fetchErrorResponse, { status: 500 });
    }

    await setCache(id, {
      url: null,
      status: 'failed',
      timestamp: Date.now(),
    });

    const unknownErrorResponse = {
      code: 500,
      message: '刷新 trailer URL 失败',
      error: 'UNKNOWN_ERROR',
    };
    const unknownErrorSize = Buffer.byteLength(
      JSON.stringify(unknownErrorResponse),
      'utf8',
    );

    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/douban/refresh-trailer',
      statusCode: 500,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      dbQueries: 0,
      requestSize: 0,
      responseSize: unknownErrorSize,
    });

    return NextResponse.json(unknownErrorResponse, { status: 500 });
  }
}
