/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 性能监控中间件
 * 拦截所有请求并记录性能数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordRequest, incrementDbQuery, collectSystemMetrics } from '@/lib/performance-monitor';

/**
 * 性能监控中间件
 */
export async function performanceMiddleware(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

  // 重置数据库查询计数
  let dbQueriesBeforeRequest = 0;

  try {
    // 执行请求处理
    const response = await handler();

    // 记录性能数据
    const endTime = Date.now();
    const duration = endTime - startTime;
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    recordRequest({
      timestamp: startTime,
      method: request.method,
      path: new URL(request.url).pathname,
      statusCode: response.status,
      duration,
      memoryUsed: endMemory,
      dbQueries: 0, // 暂时设为 0，后续通过包装 db 调用来统计
      requestSize: parseInt(request.headers.get('content-length') || '0'),
      responseSize: 0, // Next.js 响应大小难以直接获取
    });

    return response;
  } catch (error) {
    // 记录错误请求
    const endTime = Date.now();
    const duration = endTime - startTime;

    recordRequest({
      timestamp: startTime,
      method: request.method,
      path: new URL(request.url).pathname,
      statusCode: 500,
      duration,
      memoryUsed: process.memoryUsage().heapUsed / 1024 / 1024,
      dbQueries: 0,
      requestSize: parseInt(request.headers.get('content-length') || '0'),
      responseSize: 0,
    });

    throw error;
  }
}
