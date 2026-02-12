import { db } from './db';

// TMDB数据缓存配置（秒）
const TMDB_CACHE_EXPIRE = {
  actor_search: 6 * 60 * 60,    // 演员搜索6小时（较稳定）
  person_details: 24 * 60 * 60, // 人物详情24小时（基本不变）
  movie_credits: 12 * 60 * 60,  // 演员电影作品12小时（较稳定）
  tv_credits: 12 * 60 * 60,     // 演员电视剧作品12小时（较稳定）
  movie_details: 24 * 60 * 60,  // 电影详情24小时（基本不变）
  tv_details: 24 * 60 * 60,     // 电视剧详情24小时（基本不变）
  trending: 2 * 60 * 60,        // 热门内容2小时（更新频繁）
  discover: 4 * 60 * 60,        // 发现内容4小时
};

// 缓存工具函数
function getCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return `tmdb-${prefix}-${sortedParams}`;
}

// 统一缓存获取方法
async function getCache(key: string): Promise<any | null> {
  try {
    const cached = await db.getCache(key);
    return cached;
  } catch (e) {
    console.warn('获取TMDB缓存失败:', e);
    return null;
  }
}

// 统一缓存设置方法
async function setCache(key: string, data: any, expireSeconds: number): Promise<void> {
  try {
    await db.setCache(key, data, expireSeconds);
  } catch (e) {
    console.warn('设置TMDB缓存失败:', key, e);
  }
}

// 清理过期缓存
async function cleanExpiredCache(): Promise<void> {
  try {
    // 清理数据库中的过期缓存
    // 静默处理错误，避免在没有数据时产生401错误
    try {
      await db.clearExpiredCache('tmdb-');
    } catch (e) {
      // 静默处理：如果缓存为空或请求失败，不影响应用运行
      // 这是正常情况，不需要警告
    }
  } catch (e) {
    console.warn('清理TMDB过期缓存失败:', e);
  }
}

// 获取缓存状态信息
export async function getTMDBCacheStats(): Promise<{
  totalItems: number;
  totalSize: number;
  byType: Record<string, number>;
}> {
  // TODO: 实现数据库缓存统计
  return { totalItems: 0, totalSize: 0, byType: {} };
}

// 清理所有TMDB缓存
export async function clearTMDBCache(): Promise<void> {
  await db.clearExpiredCache('tmdb-');
  console.log('已清理所有TMDB缓存项');
}

// 初始化缓存系统（服务器端不需要定时清理）
async function initTMDBCache(): Promise<void> {
  // 立即清理一次过期缓存
  await cleanExpiredCache();

  // 每1小时清理一次过期缓存
  setInterval(() => cleanExpiredCache(), 60 * 60 * 1000);

  console.log('TMDB缓存系统已初始化');
}

export {
  TMDB_CACHE_EXPIRE,
  getCacheKey,
  getCache,
  setCache,
  cleanExpiredCache,
};