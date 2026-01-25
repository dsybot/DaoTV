/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 性能监控模块
 * 收集和聚合应用性能数据
 */

import { RequestMetrics, HourlyMetrics, SystemMetrics } from './performance.types';

// 内存中的请求数据缓存（最近1小时）
const requestCache: RequestMetrics[] = [];
const MAX_CACHE_SIZE = 10000; // 最多缓存 10000 条请求

// 系统指标缓存
const systemMetricsCache: SystemMetrics[] = [];
const MAX_SYSTEM_METRICS = 1000;

// 数据库查询计数器
let dbQueryCount = 0;
let lastDbQueryReset = Date.now();

/**
 * 记录单次请求的性能数据
 */
export function recordRequest(metrics: RequestMetrics): void {
  // 添加到缓存
  requestCache.push(metrics);

  // 限制缓存大小，移除最旧的数据
  if (requestCache.length > MAX_CACHE_SIZE) {
    requestCache.shift();
  }
}

/**
 * 增加数据库查询计数
 */
export function incrementDbQuery(): void {
  dbQueryCount++;
}

/**
 * 获取当前数据库查询计数并重置
 */
export function getAndResetDbQueryCount(): number {
  const count = dbQueryCount;
  dbQueryCount = 0;
  lastDbQueryReset = Date.now();
  return count;
}

/**
 * 获取当前系统资源使用情况
 */
export function collectSystemMetrics(): SystemMetrics {
  const memUsage = process.memoryUsage();

  // CPU 使用率计算（简化版）
  const cpuUsage = process.cpuUsage();
  const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // 转换为秒

  return {
    timestamp: Date.now(),
    cpuUsage: cpuPercent,
    memoryUsage: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
    },
    eventLoopDelay: 0, // 暂时设为 0，后续可以用 perf_hooks 实现
  };
}

/**
 * 记录系统指标
 */
export function recordSystemMetrics(): void {
  const metrics = collectSystemMetrics();
  systemMetricsCache.push(metrics);

  // 限制缓存大小
  if (systemMetricsCache.length > MAX_SYSTEM_METRICS) {
    systemMetricsCache.shift();
  }
}

/**
 * 聚合指定时间范围内的请求数据
 */
export function aggregateMetrics(startTime: number, endTime: number): HourlyMetrics {
  // 过滤时间范围内的请求
  const requests = requestCache.filter(
    (r) => r.timestamp >= startTime && r.timestamp < endTime
  );

  if (requests.length === 0) {
    return {
      hour: new Date(startTime).toISOString(),
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      avgDuration: 0,
      maxDuration: 0,
      avgMemory: 0,
      maxMemory: 0,
      totalDbQueries: 0,
      totalTraffic: 0,
      topPaths: [],
      slowestPaths: [],
    };
  }

  // 计算基础指标
  const totalRequests = requests.length;
  const successRequests = requests.filter((r) => r.statusCode >= 200 && r.statusCode < 300).length;
  const errorRequests = requests.filter((r) => r.statusCode >= 400).length;

  const durations = requests.map((r) => r.duration);
  const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const maxDuration = Math.max(...durations);

  const memories = requests.map((r) => r.memoryUsed);
  const avgMemory = Math.round((memories.reduce((a, b) => a + b, 0) / memories.length) * 100) / 100;
  const maxMemory = Math.round(Math.max(...memories) * 100) / 100;

  const totalDbQueries = requests.reduce((sum, r) => sum + r.dbQueries, 0);
  const totalTraffic = requests.reduce((sum, r) => sum + r.requestSize + r.responseSize, 0);

  return {
    hour: new Date(startTime).toISOString(),
    totalRequests,
    successRequests,
    errorRequests,
    avgDuration,
    maxDuration,
    avgMemory,
    maxMemory,
    totalDbQueries,
    totalTraffic,
    topPaths: [],
    slowestPaths: [],
  };
}

/**
 * 获取最近 N 小时的聚合数据
 */
export function getRecentMetrics(hours: number): HourlyMetrics[] {
  const now = Date.now();
  const metrics: HourlyMetrics[] = [];

  for (let i = hours - 1; i >= 0; i--) {
    const endTime = now - i * 3600000; // 每小时 3600000 毫秒
    const startTime = endTime - 3600000;
    metrics.push(aggregateMetrics(startTime, endTime));
  }

  return metrics;
}

/**
 * 获取当前系统状态
 */
export function getCurrentStatus() {
  const systemMetrics = collectSystemMetrics();
  const recentRequests = requestCache.filter(
    (r) => r.timestamp > Date.now() - 60000 // 最近1分钟
  );

  return {
    system: systemMetrics,
    requestsPerMinute: recentRequests.length,
    dbQueriesPerMinute: recentRequests.reduce((sum, r) => sum + r.dbQueries, 0),
    avgResponseTime: recentRequests.length > 0
      ? Math.round(recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length)
      : 0,
  };
}

/**
 * 清空缓存数据
 */
export function clearCache(): void {
  requestCache.length = 0;
  systemMetricsCache.length = 0;
  dbQueryCount = 0;
}

// 自动数据收集定时器
let collectionInterval: NodeJS.Timeout | null = null;

/**
 * 启动自动数据收集
 */
export function startAutoCollection(): void {
  if (collectionInterval) return; // 已经启动

  console.log('🚀 启动性能监控自动数据收集...');

  // 每 10 秒收集一次系统指标
  collectionInterval = setInterval(() => {
    recordSystemMetrics();

    // 模拟一些请求数据（用于演示）
    const now = Date.now();
    const randomRequests = Math.floor(Math.random() * 5) + 1;

    for (let i = 0; i < randomRequests; i++) {
      recordRequest({
        timestamp: now - Math.random() * 10000,
        method: ['GET', 'POST'][Math.floor(Math.random() * 2)],
        path: ['/api/douban/details', '/api/playrecords', '/api/favorites'][Math.floor(Math.random() * 3)],
        statusCode: Math.random() > 0.1 ? 200 : 500,
        duration: Math.floor(Math.random() * 500) + 50,
        memoryUsed: Math.random() * 100 + 50,
        dbQueries: Math.floor(Math.random() * 5),
        requestSize: Math.floor(Math.random() * 1000),
        responseSize: Math.floor(Math.random() * 5000),
      });
    }
  }, 10000);
}

/**
 * 停止自动数据收集
 */
export function stopAutoCollection(): void {
  if (collectionInterval) {
    clearInterval(collectionInterval);
    collectionInterval = null;
    console.log('⏹️ 停止性能监控自动数据收集');
  }
}
