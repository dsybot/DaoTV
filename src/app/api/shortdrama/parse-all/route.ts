/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import {
  getDbQueryCount,
  recordRequest,
  resetDbQueryCount,
} from '@/lib/performance-monitor';
import { parseShortDramaAllFromSources } from '@/lib/shortdrama.server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  resetDbQueryCount();

  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const useProxy = searchParams.get('proxy') !== 'false';

    if (!id) {
      const errorResponse = { error: '缺少必要参数: id' };
      const responseSize = Buffer.byteLength(
        JSON.stringify(errorResponse),
        'utf8',
      );

      recordRequest({
        timestamp: startTime,
        method: 'GET',
        path: '/api/shortdrama/parse-all',
        statusCode: 400,
        duration: Date.now() - startTime,
        memoryUsed:
          (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
        dbQueries: getDbQueryCount(),
        requestSize: 0,
        responseSize,
      });

      return NextResponse.json(errorResponse, { status: 400 });
    }

    const videoId = Number.parseInt(id, 10);
    if (!Number.isFinite(videoId)) {
      const errorResponse = { error: '参数格式错误' };
      const responseSize = Buffer.byteLength(
        JSON.stringify(errorResponse),
        'utf8',
      );

      recordRequest({
        timestamp: startTime,
        method: 'GET',
        path: '/api/shortdrama/parse-all',
        statusCode: 400,
        duration: Date.now() - startTime,
        memoryUsed:
          (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
        dbQueries: getDbQueryCount(),
        requestSize: 0,
        responseSize,
      });

      return NextResponse.json(errorResponse, { status: 400 });
    }

    const results = await parseShortDramaAllFromSources(videoId, useProxy);

    const cacheTime = await getCacheTime();
    const response = NextResponse.json({ results });
    response.headers.set(
      'Cache-Control',
      `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
    );
    response.headers.set('CDN-Cache-Control', `public, s-maxage=${cacheTime}`);
    response.headers.set(
      'Vercel-CDN-Cache-Control',
      `public, s-maxage=${cacheTime}`,
    );
    response.headers.set('Netlify-Vary', 'query');

    const responseSize = Buffer.byteLength(JSON.stringify({ results }), 'utf8');
    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/shortdrama/parse-all',
      statusCode: 200,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      dbQueries: getDbQueryCount(),
      requestSize: 0,
      responseSize,
    });

    return response;
  } catch (error) {
    console.error('短剧整部解析失败:', error);

    const errorResponse = { error: '服务器内部错误' };
    const responseSize = Buffer.byteLength(
      JSON.stringify(errorResponse),
      'utf8',
    );

    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/shortdrama/parse-all',
      statusCode: 500,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      dbQueries: getDbQueryCount(),
      requestSize: 0,
      responseSize,
    });

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
