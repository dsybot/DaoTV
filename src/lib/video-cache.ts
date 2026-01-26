/**
 * 视频缓存管理模块
 *
 * 两层缓存架构：
 * 1. Kvrocks: 存储 URL 映射和元数据
 * 2. 文件系统: 存储视频文件内容
 *
 * 优势：
 * - 减少重复下载（28次请求 → 1次下载 + 27次缓存命中）
 * - 快速响应（本地文件读取）
 * - 自动过期清理
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { KvrocksStorage } from './kvrocks.db';

// Kvrocks 客户端单例
let kvrocksStorage: KvrocksStorage | null = null;

/**
 * 获取 Kvrocks Redis 客户端实例
 */
function getKvrocksClient() {
  if (!kvrocksStorage) {
    kvrocksStorage = new KvrocksStorage();
  }
  // @ts-ignore - 访问 protected client 属性
  return kvrocksStorage.client;
}

// 缓存配置
const CACHE_CONFIG = {
  // URL 映射缓存时间：15分钟（豆瓣 URL 通常 15-20 分钟过期）
  URL_TTL: 15 * 60, // 900 秒

  // 视频内容缓存时间：12小时（本地文件不依赖URL过期，可以缓存更久）
  VIDEO_TTL: 12 * 60 * 60, // 43200 秒

  // 视频文件存储目录（Docker volume 持久化）
  VIDEO_CACHE_DIR: process.env.VIDEO_CACHE_DIR || '/tmp/video-cache',

  // 最大缓存大小：500MB（防止磁盘占用过多）
  MAX_CACHE_SIZE: 500 * 1024 * 1024, // 500 MB
};

// Kvrocks Key 前缀
const KEYS = {
  TRAILER_URL: 'trailer:url:', // trailer:url:{douban_id} → URL
  VIDEO_META: 'video:meta:', // video:meta:{url_hash} → 元数据
  VIDEO_SIZE: 'video:total_size', // 总缓存大小
};

/**
 * 生成 URL 的哈希值（用作文件名）
 */
function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

/**
 * 获取视频缓存文件路径
 */
function getVideoCachePath(urlHash: string): string {
  return path.join(CACHE_CONFIG.VIDEO_CACHE_DIR, `${urlHash}.mp4`);
}

/**
 * 确保缓存目录存在
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_CONFIG.VIDEO_CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('[VideoCache] 创建缓存目录失败:', error);
  }
}

/**
 * 获取缓存的 trailer URL
 */
export async function getCachedTrailerUrl(doubanId: string | number): Promise<string | null> {
  try {
    const redis = await getKvrocksClient();
    const key = `${KEYS.TRAILER_URL}${doubanId}`;
    const url = await redis.get(key);

    if (url) {
      console.log(`[VideoCache] 命中 trailer URL 缓存: ${doubanId}`);
    }

    return url;
  } catch (error) {
    console.error('[VideoCache] 获取 trailer URL 缓存失败:', error);
    return null;
  }
}

/**
 * 缓存 trailer URL
 */
export async function cacheTrailerUrl(doubanId: string | number, url: string): Promise<void> {
  try {
    const redis = await getKvrocksClient();
    const key = `${KEYS.TRAILER_URL}${doubanId}`;
    await redis.setEx(key, CACHE_CONFIG.URL_TTL, url);
    console.log(`[VideoCache] 缓存 trailer URL: ${doubanId} (TTL: ${CACHE_CONFIG.URL_TTL}s)`);
  } catch (error) {
    console.error('[VideoCache] 缓存 trailer URL 失败:', error);
  }
}

/**
 * 检查视频文件是否已缓存
 */
export async function isVideoCached(videoUrl: string): Promise<boolean> {
  try {
    const urlHash = hashUrl(videoUrl);
    const redis = await getKvrocksClient();
    const metaKey = `${KEYS.VIDEO_META}${urlHash}`;

    // 检查元数据是否存在
    const meta = await redis.get(metaKey);
    if (!meta) {
      return false;
    }

    // 检查文件是否存在
    const filePath = getVideoCachePath(urlHash);
    try {
      await fs.access(filePath);
      console.log(`[VideoCache] 命中视频缓存: ${urlHash.substring(0, 8)}...`);
      return true;
    } catch {
      // 文件不存在，清理元数据
      await redis.del(metaKey);
      return false;
    }
  } catch (error) {
    console.error('[VideoCache] 检查视频缓存失败:', error);
    return false;
  }
}

/**
 * 获取缓存的视频文件路径
 */
export async function getCachedVideoPath(videoUrl: string): Promise<string | null> {
  const urlHash = hashUrl(videoUrl);
  const filePath = getVideoCachePath(urlHash);

  try {
    await fs.access(filePath);

    // 更新元数据的 TTL（延长缓存时间）
    const redis = await getKvrocksClient();
    const metaKey = `${KEYS.VIDEO_META}${urlHash}`;
    await redis.expire(metaKey, CACHE_CONFIG.VIDEO_TTL);

    return filePath;
  } catch {
    return null;
  }
}

/**
 * 缓存视频内容到文件系统
 */
export async function cacheVideoContent(
  videoUrl: string,
  videoBuffer: Buffer,
  contentType: string = 'video/mp4'
): Promise<string> {
  await ensureCacheDir();

  const urlHash = hashUrl(videoUrl);
  const filePath = getVideoCachePath(urlHash);
  const fileSize = videoBuffer.length;

  try {
    // 检查缓存大小限制
    const redis = await getKvrocksClient();
    const totalSizeStr = await redis.get(KEYS.VIDEO_SIZE);
    const totalSize = totalSizeStr ? parseInt(totalSizeStr) : 0;

    if (totalSize + fileSize > CACHE_CONFIG.MAX_CACHE_SIZE) {
      console.warn(`[VideoCache] 缓存空间不足，跳过缓存 (当前: ${(totalSize / 1024 / 1024).toFixed(2)}MB)`);
      return filePath;
    }

    // 写入文件
    await fs.writeFile(filePath, videoBuffer);

    // 保存元数据到 Kvrocks
    const meta = JSON.stringify({
      url: videoUrl,
      urlHash,
      contentType,
      size: fileSize,
      cachedAt: Date.now(),
    });

    const metaKey = `${KEYS.VIDEO_META}${urlHash}`;
    await redis.setEx(metaKey, CACHE_CONFIG.VIDEO_TTL, meta);

    // 更新总缓存大小
    await redis.incrBy(KEYS.VIDEO_SIZE, fileSize);

    console.log(`[VideoCache] 缓存视频成功: ${urlHash.substring(0, 8)}... (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);

    return filePath;
  } catch (error) {
    console.error('[VideoCache] 缓存视频失败:', error);
    throw error;
  }
}

/**
 * 清理过期的缓存文件
 * 由 Kvrocks TTL 自动触发，这里只是清理孤儿文件
 */
export async function cleanupExpiredCache(): Promise<void> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_CONFIG.VIDEO_CACHE_DIR);
    const redis = await getKvrocksClient();

    let cleanedCount = 0;
    let freedSize = 0;

    for (const file of files) {
      if (!file.endsWith('.mp4')) continue;

      const urlHash = file.replace('.mp4', '');
      const metaKey = `${KEYS.VIDEO_META}${urlHash}`;

      // 检查元数据是否存在
      const meta = await redis.get(metaKey);
      if (!meta) {
        // 元数据不存在，说明已过期，删除文件
        const filePath = path.join(CACHE_CONFIG.VIDEO_CACHE_DIR, file);
        const stats = await fs.stat(filePath);
        await fs.unlink(filePath);

        cleanedCount++;
        freedSize += stats.size;

        // 更新总缓存大小
        await redis.decrBy(KEYS.VIDEO_SIZE, stats.size);
      }
    }

    if (cleanedCount > 0) {
      console.log(`[VideoCache] 清理完成: 删除 ${cleanedCount} 个文件，释放 ${(freedSize / 1024 / 1024).toFixed(2)}MB`);
    }
  } catch (error) {
    console.error('[VideoCache] 清理缓存失败:', error);
  }
}

/**
 * 删除指定 URL 的视频缓存
 * 用于处理视频 URL 过期的情况
 */
export async function deleteVideoCache(videoUrl: string): Promise<void> {
  const urlHash = hashUrl(videoUrl);
  const filePath = getVideoCachePath(urlHash);

  try {
    const redis = await getKvrocksClient();
    const metaKey = `${KEYS.VIDEO_META}${urlHash}`;

    // 获取文件大小（用于更新总缓存大小）
    const meta = await redis.get(metaKey);
    let fileSize = 0;
    if (meta) {
      const metaData = JSON.parse(meta);
      fileSize = metaData.size || 0;
    }

    // 删除元数据
    await redis.del(metaKey);

    // 删除文件
    try {
      await fs.unlink(filePath);
      console.log(`[VideoCache] 删除缓存文件: ${urlHash.substring(0, 8)}...`);

      // 更新总缓存大小
      if (fileSize > 0) {
        await redis.decrBy(KEYS.VIDEO_SIZE, fileSize);
      }
    } catch (error) {
      // 文件可能已经不存在，忽略错误
      console.log(`[VideoCache] 缓存文件不存在或已删除: ${urlHash.substring(0, 8)}...`);
    }
  } catch (error) {
    console.error('[VideoCache] 删除视频缓存失败:', error);
  }
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats(): Promise<{
  totalSize: number;
  fileCount: number;
  maxSize: number;
}> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_CONFIG.VIDEO_CACHE_DIR);
    const mp4Files = files.filter(f => f.endsWith('.mp4'));

    const redis = await getKvrocksClient();
    const totalSizeStr = await redis.get(KEYS.VIDEO_SIZE);
    const totalSize = totalSizeStr ? parseInt(totalSizeStr) : 0;

    return {
      totalSize,
      fileCount: mp4Files.length,
      maxSize: CACHE_CONFIG.MAX_CACHE_SIZE,
    };
  } catch (error) {
    console.error('[VideoCache] 获取缓存统计失败:', error);
    return {
      totalSize: 0,
      fileCount: 0,
      maxSize: CACHE_CONFIG.MAX_CACHE_SIZE,
    };
  }
}
