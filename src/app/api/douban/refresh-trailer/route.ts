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

const pendingRequests = new Map<string, Promise<TrailerCache>>();

let lastDoubanRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000;

const RATE_LIMIT_KEY = 'douban:refresh-trailer:rate-limit';
const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

const lastForceRefreshTime = new Map<string, number>();
const FORCE_REFRESH_COOLDOWN = 60 * 1000;

const lastNoCacheForceRefreshTime = new Map<string, number>();
const NO_CACHE_FORCE_REFRESH_COOLDOWN = 5 * 60 * 1000;

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

async function checkRateLimit(): Promise<{
  allowed: boolean;
  remaining: number;
  resetIn: number;
}> {
  try {
    const count = (await db.getCache(RATE_LIMIT_KEY)) as number | null;
    const currentCount = count || 0;

    if (currentCount >= RATE_LIMIT_MAX_REQUESTS) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: RATE_LIMIT_WINDOW,
      };
    }

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - currentCount - 1,
      resetIn: RATE_LIMIT_WINDOW,
    };
  } catch (error) {
    console.error('[refresh-trailer] 检查限流失败:', error);
    return { allowed: true, remaining: 0, resetIn: 0 };
  }
}

async function incrementRateLimit(): Promise<void> {
  try {
    const count = (await db.getCache(RATE_LIMIT_KEY)) as number | null;
    const newCount = (count || 0) + 1;
    await db.setCache(RATE_LIMIT_KEY, newCount, RATE_LIMIT_WINDOW);
    console.log(
      `[refresh-trailer] 限流计数: ${newCount}/${RATE_LIMIT_MAX_REQUESTS} (${RATE_LIMIT_WINDOW}秒窗口)`,
    );
  } catch (error) {
    console.error('[refresh-trailer] 更新限流计数失败:', error);
  }
}

async function waitForRequestInterval(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastDoubanRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`[refresh-trailer] 全局限流：等待 ${waitTime}ms 后请求豆瓣`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastDoubanRequestTime = Date.now();
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
    const mobileApiUrl = `https://m.douban.com/rexxar/api/v2/movie/${id}`;

    console.log(
      `[refresh-trailer] 开始请求影片 ${id}${retryCount > 0 ? ` (重试 ${retryCount}/${MAX_RETRIES})` : ''}`,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(mobileApiUrl, {
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
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

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
    const fetchedAt = new Date().toISOString();
    console.log(
      `[refresh-trailer] 影片 ${id} 成功获取trailer URL，总耗时: ${totalTime}ms，获取时间: ${fetchedAt}`,
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
    const now = Date.now();
    const lastRefreshTime = lastForceRefreshTime.get(id) || 0;
    const timeSinceLastRefresh = now - lastRefreshTime;

    if (timeSinceLastRefresh < FORCE_REFRESH_COOLDOWN) {
      const remainingSeconds = Math.ceil(
        (FORCE_REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000,
      );
      console.warn(
        `[refresh-trailer] 强制刷新冷却中: ${id}，${remainingSeconds}秒后可重试`,
      );

      const cooldownResponse = {
        code: 429,
        message: `强制刷新冷却中，${remainingSeconds}秒后可重试`,
        error: 'FORCE_REFRESH_COOLDOWN',
      };
      const cooldownSize = Buffer.byteLength(
        JSON.stringify(cooldownResponse),
        'utf8',
      );

      recordRequest({
        timestamp: startTime,
        method: 'GET',
        path: '/api/douban/refresh-trailer',
        statusCode: 429,
        duration: Date.now() - startTime,
        memoryUsed:
          (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
        dbQueries: 0,
        requestSize: 0,
        responseSize: cooldownSize,
      });

      return NextResponse.json(cooldownResponse, { status: 429 });
    }

    lastForceRefreshTime.set(id, now);

    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE;
    if (storageType === 'kvrocks') {
      try {
        const videoFileExists = await isVideoCached('', id);

        if (videoFileExists) {
          console.log(
            `[refresh-trailer] 强制刷新但命中视频文件缓存: ${id}，直接返回，不清除 Redis 缓存`,
          );

          const tempUrl = `https://vt1.doubanio.com/placeholder/M/${id}.mp4`;
          const cachedVideoUrl = `/api/video-proxy?url=${encodeURIComponent(tempUrl)}&douban_id=${id}`;

          const successResponse = {
            code: 200,
            message: '获取成功（视频文件缓存，跳过强制刷新）',
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

        const lastNoCacheRefreshTime = lastNoCacheForceRefreshTime.get(id) || 0;
        const timeSinceLastNoCacheRefresh = now - lastNoCacheRefreshTime;

        if (timeSinceLastNoCacheRefresh < NO_CACHE_FORCE_REFRESH_COOLDOWN) {
          const remainingSeconds = Math.ceil(
            (NO_CACHE_FORCE_REFRESH_COOLDOWN - timeSinceLastNoCacheRefresh) /
              1000,
          );
          console.warn(
            `[refresh-trailer] 无视频缓存的强制刷新冷却中: ${id}，${remainingSeconds}秒后可重试`,
          );

          const cooldownResponse = {
            code: 429,
            message: `视频未缓存，强制刷新冷却中，${remainingSeconds}秒后可重试`,
            error: 'NO_CACHE_FORCE_REFRESH_COOLDOWN',
          };
          const cooldownSize = Buffer.byteLength(
            JSON.stringify(cooldownResponse),
            'utf8',
          );

          recordRequest({
            timestamp: startTime,
            method: 'GET',
            path: '/api/douban/refresh-trailer',
            statusCode: 429,
            duration: Date.now() - startTime,
            memoryUsed:
              (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
            dbQueries: 0,
            requestSize: 0,
            responseSize: cooldownSize,
          });

          return NextResponse.json(cooldownResponse, { status: 429 });
        }

        lastNoCacheForceRefreshTime.set(id, now);
      } catch (error) {
        console.error('[refresh-trailer] 检查视频文件缓存失败:', error);
      }
    }

    console.log(`[refresh-trailer] 强制刷新，清除 Redis 缓存: ${id}`);
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
        let trailerUrl = cached.url;
        if (!trailerUrl.includes('douban_id=')) {
          if (trailerUrl.startsWith('/api/video-proxy?url=')) {
            trailerUrl = `${trailerUrl}&douban_id=${id}`;
          } else if (
            trailerUrl.includes('douban') ||
            trailerUrl.includes('doubanio')
          ) {
            trailerUrl = `/api/video-proxy?url=${encodeURIComponent(trailerUrl)}&douban_id=${id}`;
          }
        }

        const successResponse = {
          code: 200,
          message: '获取成功（Redis 缓存）',
          data: {
            trailerUrl,
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
        const videoFileExists = await isVideoCached('', id);

        if (videoFileExists) {
          console.log(`[refresh-trailer] 命中视频文件缓存: ${id}，返回代理 URL`);

          const tempUrl = `https://vt1.doubanio.com/placeholder/M/${id}.mp4`;
          const cachedVideoUrl = `/api/video-proxy?url=${encodeURIComponent(tempUrl)}&douban_id=${id}`;

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

  const rateLimitCheck = await checkRateLimit();
  if (!rateLimitCheck.allowed) {
    console.warn(
      `[refresh-trailer] 触发限流：已达到每分钟 ${RATE_LIMIT_MAX_REQUESTS} 次请求上限，${rateLimitCheck.resetIn}秒后重置`,
    );

    const rateLimitResponse = {
      code: 429,
      message: '请求过于频繁，请稍后再试',
      error: 'RATE_LIMIT_EXCEEDED',
      details: `每分钟最多 ${RATE_LIMIT_MAX_REQUESTS} 次请求，${rateLimitCheck.resetIn}秒后重置`,
    };
    const rateLimitSize = Buffer.byteLength(
      JSON.stringify(rateLimitResponse),
      'utf8',
    );

    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/douban/refresh-trailer',
      statusCode: 429,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      dbQueries: 0,
      requestSize: 0,
      responseSize: rateLimitSize,
    });

    return NextResponse.json(rateLimitResponse, {
      status: 429,
      headers: {
        'Retry-After': rateLimitCheck.resetIn.toString(),
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Date.now() + rateLimitCheck.resetIn * 1000).toString(),
      },
    });
  }

  const existingRequest = pendingRequests.get(id);
  if (existingRequest) {
    console.log(`[refresh-trailer] 检测到正在进行的请求，等待结果: ${id}`);
    try {
      const result = await existingRequest;

      const successResponse = {
        code: 200,
        message:
          result.status === 'success'
            ? '获取成功（等待中的请求）'
            : '请求完成（等待中的请求）',
        data: {
          trailerUrl: result.url,
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
        statusCode:
          result.status === 'success'
            ? 200
            : result.status === 'no_trailer'
              ? 404
              : 500,
        duration: Date.now() - startTime,
        memoryUsed:
          (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
        dbQueries: 0,
        requestSize: 0,
        responseSize,
      });

      if (result.status === 'success' && result.url) {
        return NextResponse.json(successResponse, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          },
        });
      }

      if (result.status === 'no_trailer') {
        return NextResponse.json(
          {
            code: 404,
            message: '该影片没有预告片',
            error: 'NO_TRAILER',
          },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          code: 500,
          message: '刷新 trailer URL 失败',
          error: 'FETCH_ERROR',
        },
        { status: 500 },
      );
    } catch (error) {
      console.error(`[refresh-trailer] 等待请求失败: ${id}`, error);
    }
  }

  const requestPromise = (async (): Promise<TrailerCache> => {
    try {
      await waitForRequestInterval();
      await incrementRateLimit();

      const trailerUrl = await fetchTrailerWithRetry(id);
      const proxiedUrl = trailerUrl
        ? `/api/video-proxy?url=${encodeURIComponent(trailerUrl)}&douban_id=${id}`
        : null;

      const cacheData: TrailerCache = {
        url: proxiedUrl,
        status: 'success',
        timestamp: Date.now(),
      };

      await setCache(id, cacheData);

      return cacheData;
    } catch (error) {
      let cacheData: TrailerCache;

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          cacheData = {
            url: null,
            status: 'failed',
            timestamp: Date.now(),
          };
        } else if (error.message.includes('没有预告片')) {
          cacheData = {
            url: null,
            status: 'no_trailer',
            timestamp: Date.now(),
          };
        } else {
          cacheData = {
            url: null,
            status: 'failed',
            timestamp: Date.now(),
          };
        }
      } else {
        cacheData = {
          url: null,
          status: 'failed',
          timestamp: Date.now(),
        };
      }

      await setCache(id, cacheData);

      return cacheData;
    }
  })();

  pendingRequests.set(id, requestPromise);

  try {
    const result = await requestPromise;
    pendingRequests.delete(id);

    if (result.status === 'success' && result.url) {
      const successResponse = {
        code: 200,
        message: '获取成功',
        data: {
          trailerUrl: result.url,
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

    if (result.status === 'no_trailer') {
      const noTrailerResponse = {
        code: 404,
        message: '该影片没有预告片',
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

    const failedResponse = {
      code: 500,
      message: '刷新 trailer URL 失败',
      error: 'FETCH_ERROR',
      details: '服务端错误',
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
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      dbQueries: 0,
      requestSize: 0,
      responseSize: failedSize,
    });

    return NextResponse.json(failedResponse, { status: 500 });
  } catch {
    pendingRequests.delete(id);

    const errorResponse = {
      code: 500,
      message: '刷新 trailer URL 失败',
      error: 'UNKNOWN_ERROR',
    };
    const errorSize = Buffer.byteLength(JSON.stringify(errorResponse), 'utf8');

    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/douban/refresh-trailer',
      statusCode: 500,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      dbQueries: 0,
      requestSize: 0,
      responseSize: errorSize,
    });

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
