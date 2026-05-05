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

  // 最大缓存大小：2GB（优化后，可缓存更多视频）
  MAX_CACHE_SIZE: 2 * 1024 * 1024 * 1024, // 2 GB
};

// Kvrocks Key 前缀
const KEYS = {
  TRAILER_URL: 'trailer:url:', // trailer:url:{douban_id} → URL
  VIDEO_META: 'video:meta:', // video:meta:{url_hash} → 元数据
  VIDEO_SIZE: 'video:total_size', // 总缓存大小
  VIDEO_LRU: 'video:lru', // Sorted Set: 记录文件访问时间 (score = timestamp)
};

/**
 * 生成 URL 的哈希值（用作文件名）
 */
function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

/**
 * 获取缓存 Key（优先使用 douban_id，降级到 URL hash）
 * 这样即使 URL 刷新（时间戳变化），只要是同一个视频就能命中缓存
 */
function getCacheKey(videoUrl: string): string {
  // 不再从 URL 提取视频 ID，必须使用 doubanMovieId 参数
  // 如果没有 doubanMovieId，使用 URL hash 作为降级方案
  const urlHash = hashUrl(videoUrl);
  console.log(`[VideoCache] 使用 URL hash 作为缓存 Key: ${urlHash.substring(0, 8)}...`);
  return urlHash;
}

/**
 * 获取视频缓存文件路径
 */
function getVideoCachePath(cacheKey: string): string {
  return path.join(CACHE_CONFIG.VIDEO_CACHE_DIR, `${cacheKey}.mp4`);
}

/**
 * 确保缓存目录存在
 */
async function ensureCacheDir(): Promise<void> {
  try {
    console.log(`[VideoCache] 确保缓存目录存在: ${CACHE_CONFIG.VIDEO_CACHE_DIR}`);
    await fs.mkdir(CACHE_CONFIG.VIDEO_CACHE_DIR, { recursive: true });
    console.log('[VideoCache] 缓存目录已创建/确认存在');
  } catch (error) {
    console.error('[VideoCache] 创建缓存目录失败:', error);
    throw error;
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
 * @param videoUrl 视频 URL
 * @param doubanMovieId 豆瓣影片 ID（可选，优先使用）
 */
export async function isVideoCached(videoUrl: string, doubanMovieId?: string | number): Promise<boolean> {
  try {
    let cacheKey: string;
    if (doubanMovieId) {
      cacheKey = `movie_${doubanMovieId}`;
      console.log(`[VideoCache] 使用豆瓣影片 ID 检查缓存: ${cacheKey}`);
    } else {
      cacheKey = getCacheKey(videoUrl);
      console.log(`[VideoCache] 使用视频 URL 检查缓存: ${cacheKey}`);
    }

    const redis = await getKvrocksClient();
    const metaKey = `${KEYS.VIDEO_META}${cacheKey}`;

    console.log(`[VideoCache] 检查缓存: cacheKey=${cacheKey}, metaKey=${metaKey}`);

    // 检查元数据是否存在
    const meta = await redis.get(metaKey);
    if (!meta) {
      console.log(`[VideoCache] 元数据不存在: ${cacheKey}`);
      return false;
    }

    console.log(`[VideoCache] 元数据存在，检查文件: ${cacheKey}`);

    // 检查文件是否存在
    const filePath = getVideoCachePath(cacheKey);
    try {
      await fs.access(filePath);
      console.log(`[VideoCache] ✅ 命中视频缓存: ${cacheKey}`);
      return true;
    } catch {
      // 文件不存在，清理元数据
      console.log(`[VideoCache] 文件不存在，清理元数据: ${cacheKey}`);
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
 * @param videoUrl 视频 URL
 * @param doubanMovieId 豆瓣影片 ID（可选，优先使用）
 */
export async function getCachedVideoPath(videoUrl: string, doubanMovieId?: string | number): Promise<string | null> {
  let cacheKey: string;
  if (doubanMovieId) {
    cacheKey = `movie_${doubanMovieId}`;
  } else {
    cacheKey = getCacheKey(videoUrl);
  }

  const filePath = getVideoCachePath(cacheKey);

  try {
    await fs.access(filePath);

    const redis = await getKvrocksClient();

    // 🚀 LRU: 更新访问时间（使用当前时间戳作为 score）
    // 注意：不重置 TTL，让文件在 12 小时后自然过期，避免热门视频永久占用空间
    const now = Date.now();
    await redis.zAdd(KEYS.VIDEO_LRU, [{ score: now, value: cacheKey }]);
    console.log(`[VideoCache] 更新 LRU 访问时间: ${cacheKey}`);

    return filePath;
  } catch {
    return null;
  }
}

/**
 * 缓存视频内容到文件系统
 * @param videoUrl 视频 URL
 * @param videoBuffer 视频内容
 * @param contentType 内容类型
 * @param doubanMovieId 豆瓣影片 ID（可选，用于生成稳定的文件名）
 */
export async function cacheVideoContent(
  videoUrl: string,
  videoBuffer: Buffer,
  contentType: string = 'video/mp4',
  doubanMovieId?: string | number
): Promise<string> {
  console.log(`[VideoCache] 开始缓存视频内容，大小: ${(videoBuffer.length / 1024 / 1024).toFixed(2)}MB`);
  await ensureCacheDir();

  let cacheKey: string;
  if (doubanMovieId) {
    cacheKey = `movie_${doubanMovieId}`;
    console.log(`[VideoCache] 使用豆瓣影片 ID 作为缓存 Key: ${cacheKey}`);
  } else {
    cacheKey = getCacheKey(videoUrl);
    console.log(`[VideoCache] 使用视频 URL 生成缓存 Key: ${cacheKey}`);
  }

  const filePath = getVideoCachePath(cacheKey);
  const fileSize = videoBuffer.length;

  console.log(`[VideoCache] 文件路径: ${filePath}`);

  try {
    // 检查缓存大小限制
    const redis = await getKvrocksClient();
    const totalSizeStr = await redis.get(KEYS.VIDEO_SIZE);
    const totalSize = totalSizeStr ? parseInt(totalSizeStr) : 0;

    console.log(`[VideoCache] 当前缓存大小: ${(totalSize / 1024 / 1024).toFixed(2)}MB / ${(CACHE_CONFIG.MAX_CACHE_SIZE / 1024 / 1024).toFixed(2)}MB`);

    if (totalSize + fileSize > CACHE_CONFIG.MAX_CACHE_SIZE) {
      console.warn(`[VideoCache] 缓存空间不足，尝试 LRU 清理...`);

      // 🚀 LRU: 尝试清理旧文件释放空间
      const requiredSpace = fileSize;
      const cleaned = await cleanupLRU(requiredSpace);

      if (!cleaned) {
        console.warn(`[VideoCache] LRU 清理失败，跳过缓存`);
        return filePath;
      }

      console.log(`[VideoCache] LRU 清理成功，继续缓存`);
    }

    // 写入文件
    console.log('[VideoCache] 开始写入文件...');
    await fs.writeFile(filePath, videoBuffer);
    console.log('[VideoCache] 文件写入成功');

    // 保存元数据到 Kvrocks
    const meta = JSON.stringify({
      url: videoUrl,
      cacheKey,
      contentType,
      size: fileSize,
      cachedAt: Date.now(),
    });

    const metaKey = `${KEYS.VIDEO_META}${cacheKey}`;
    await redis.setEx(metaKey, CACHE_CONFIG.VIDEO_TTL, meta);

    // 🚀 LRU: 添加到访问时间记录
    const now = Date.now();
    await redis.zAdd(KEYS.VIDEO_LRU, [{ score: now, value: cacheKey }]);

    // 更新总缓存大小
    await redis.incrBy(KEYS.VIDEO_SIZE, fileSize);

    console.log(`[VideoCache] 缓存视频成功: ${cacheKey} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);

    return filePath;
  } catch (error) {
    console.error('[VideoCache] 缓存视频失败:', error);
    throw error;
  }
}

/**
 * 清理过期的缓存文件
 * 由 Kvrocks TTL 自动触发，这里只是清理孤儿文件
 * 🚀 优化：添加错误处理和 LRU 列表清理
 */
export async function cleanupExpiredCache(): Promise<void> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_CONFIG.VIDEO_CACHE_DIR);
    const redis = await getKvrocksClient();

    let cleanedCount = 0;
    let freedSize = 0;
    let errorCount = 0;

    for (const file of files) {
      if (!file.endsWith('.mp4')) continue;

      const cacheKey = file.replace('.mp4', '');
      const metaKey = `${KEYS.VIDEO_META}${cacheKey}`;

      try {
        // 检查元数据是否存在
        const meta = await redis.get(metaKey);
        if (!meta) {
          // 元数据不存在，说明已过期，删除文件
          const filePath = path.join(CACHE_CONFIG.VIDEO_CACHE_DIR, file);

          try {
            const stats = await fs.stat(filePath);
            await fs.unlink(filePath);

            cleanedCount++;
            freedSize += stats.size;

            // 更新总缓存大小
            await redis.decrBy(KEYS.VIDEO_SIZE, stats.size);

            // 🚀 从 LRU 列表中移除
            await redis.zRem(KEYS.VIDEO_LRU, [cacheKey]);

            console.log(`[VideoCache] 清理过期文件: ${cacheKey}`);
          } catch (fileError) {
            console.error(`[VideoCache] 删除文件失败: ${cacheKey}`, fileError);
            errorCount++;
          }
        }
      } catch (error) {
        console.error(`[VideoCache] 处理文件失败: ${file}`, error);
        errorCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[VideoCache] 清理完成: 删除 ${cleanedCount} 个文件，释放 ${(freedSize / 1024 / 1024).toFixed(2)}MB${errorCount > 0 ? `, 错误 ${errorCount} 个` : ''}`);
    }
  } catch (error) {
    console.error('[VideoCache] 清理缓存失败:', error);
  }
}

/**
 * 删除指定 URL 的视频缓存
 * 用于处理视频 URL 过期的情况
 * 🚀 优化：添加 LRU 列表清理
 */
export async function deleteVideoCache(videoUrl: string): Promise<void> {
  const cacheKey = getCacheKey(videoUrl);
  const filePath = getVideoCachePath(cacheKey);

  try {
    const redis = await getKvrocksClient();
    const metaKey = `${KEYS.VIDEO_META}${cacheKey}`;

    // 获取文件大小（用于更新总缓存大小）
    const meta = await redis.get(metaKey);
    let fileSize = 0;
    if (meta) {
      const metaData = JSON.parse(meta);
      fileSize = metaData.size || 0;
    }

    // 删除元数据
    await redis.del(metaKey);

    // 🚀 从 LRU 列表中移除
    await redis.zRem(KEYS.VIDEO_LRU, [cacheKey]);

    // 删除文件
    try {
      await fs.unlink(filePath);
      console.log(`[VideoCache] 删除缓存文件: ${cacheKey}`);

      // 更新总缓存大小
      if (fileSize > 0) {
        await redis.decrBy(KEYS.VIDEO_SIZE, fileSize);
      }
    } catch (error) {
      // 文件可能已经不存在，忽略错误
      console.log(`[VideoCache] 缓存文件不存在或已删除: ${cacheKey}`);
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

/**
 * 🚀 LRU 清理：当缓存满时删除最久未使用的文件
 * @param requiredSpace 需要释放的空间（字节）
 * @returns 是否成功释放足够空间
 */
export async function cleanupLRU(requiredSpace: number): Promise<boolean> {
  try {
    console.log(`[VideoCache] LRU 清理开始，需要释放: ${(requiredSpace / 1024 / 1024).toFixed(2)}MB`);

    const redis = await getKvrocksClient();
    let freedSpace = 0;
    let deletedCount = 0;

    // 获取最旧的文件（按访问时间升序）
    const oldestFiles = await redis.zRange(KEYS.VIDEO_LRU, 0, -1);

    if (!oldestFiles || oldestFiles.length === 0) {
      console.log('[VideoCache] LRU 列表为空，无法清理');
      return false;
    }

    console.log(`[VideoCache] 找到 ${oldestFiles.length} 个缓存文件`);

    // 逐个删除最旧的文件，直到释放足够空间
    for (const cacheKey of oldestFiles) {
      if (freedSpace >= requiredSpace) {
        break; // 已释放足够空间
      }

      try {
        // 获取文件大小
        const metaKey = `${KEYS.VIDEO_META}${cacheKey}`;
        const meta = await redis.get(metaKey);

        if (!meta) {
          // 元数据不存在，从 LRU 中移除
          await redis.zRem(KEYS.VIDEO_LRU, [cacheKey]);
          continue;
        }

        const metaData = JSON.parse(meta);
        const fileSize = metaData.size || 0;

        // 删除文件
        const filePath = getVideoCachePath(cacheKey);
        try {
          await fs.unlink(filePath);
          console.log(`[VideoCache] LRU 删除文件: ${cacheKey} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
        } catch (err) {
          console.log(`[VideoCache] 文件不存在: ${cacheKey}`);
        }

        // 删除元数据
        await redis.del(metaKey);

        // 从 LRU 中移除
        await redis.zRem(KEYS.VIDEO_LRU, [cacheKey]);

        // 更新总缓存大小
        if (fileSize > 0) {
          await redis.decrBy(KEYS.VIDEO_SIZE, fileSize);
        }

        freedSpace += fileSize;
        deletedCount++;

      } catch (error) {
        console.error(`[VideoCache] LRU 删除失败: ${cacheKey}`, error);
      }
    }

    console.log(`[VideoCache] LRU 清理完成: 删除 ${deletedCount} 个文件，释放 ${(freedSpace / 1024 / 1024).toFixed(2)}MB`);
    return freedSpace >= requiredSpace;

  } catch (error) {
    console.error('[VideoCache] LRU 清理失败:', error);
    return false;
  }
}

/**
 * 🚀 启动时校验：重新计算实际磁盘使用，修正计数器
 * 防止 Redis 重启或异常导致的计数不准确
 */
export async function validateCacheSize(): Promise<void> {
  try {
    console.log('[VideoCache] 启动校验：开始计算实际磁盘使用...');
    await ensureCacheDir();

    const files = await fs.readdir(CACHE_CONFIG.VIDEO_CACHE_DIR);
    const redis = await getKvrocksClient();

    let actualTotalSize = 0;
    let validFileCount = 0;

    for (const file of files) {
      if (!file.endsWith('.mp4')) continue;

      try {
        const filePath = path.join(CACHE_CONFIG.VIDEO_CACHE_DIR, file);
        const stats = await fs.stat(filePath);
        actualTotalSize += stats.size;
        validFileCount++;
      } catch (error) {
        console.error(`[VideoCache] 无法读取文件: ${file}`, error);
      }
    }

    // 更新 Redis 中的总大小
    await redis.set(KEYS.VIDEO_SIZE, actualTotalSize.toString());

    console.log(`[VideoCache] ✅ 启动校验完成:`);
    console.log(`  - 文件数量: ${validFileCount}`);
    console.log(`  - 实际大小: ${(actualTotalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  - 最大限制: ${(CACHE_CONFIG.MAX_CACHE_SIZE / 1024 / 1024).toFixed(2)}MB`);

  } catch (error) {
    console.error('[VideoCache] 启动校验失败:', error);
  }
}
