/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { isTMDBEnabled } from '@/lib/tmdb.client';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w300'; // 演员头像尺寸
const CACHE_TIME = 24 * 60 * 60; // 24小时缓存

// TMDB API Key 轮询索引
let tmdbApiKeyIndex = 0;

/**
 * 获取下一个可用的TMDB API Key（轮询）
 */
function getNextTMDBApiKey(config: any): string | null {
  // 优先使用多Key配置
  const apiKeys = config.SiteConfig.TMDBApiKeys?.filter((k: string) => k && k.trim()) || [];

  // 如果有多个Key，使用轮询
  if (apiKeys.length > 0) {
    const key = apiKeys[tmdbApiKeyIndex % apiKeys.length];
    tmdbApiKeyIndex = (tmdbApiKeyIndex + 1) % apiKeys.length;
    return key;
  }

  // 降级到单Key配置
  if (config.SiteConfig.TMDBApiKey) {
    return config.SiteConfig.TMDBApiKey;
  }

  return null;
}

export const runtime = 'nodejs';

interface ActorPhoto {
  name: string;
  photo: string | null;
  id: number | null;
}

/**
 * 批量获取演员图片
 * GET /api/tmdb/cast-photos?names=演员1,演员2,演员3
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const namesParam = searchParams.get('names');

  if (!namesParam?.trim()) {
    return NextResponse.json(
      { error: '缺少必要参数: names（演员名字，逗号分隔）' },
      { status: 400 }
    );
  }

  try {
    // 使用与搜索页面相同的检测逻辑
    const enabled = await isTMDBEnabled();
    console.log(`[TMDB Cast Photos] isTMDBEnabled: ${enabled}`);

    if (!enabled) {
      console.log(`[TMDB Cast Photos] 功能未启用，返回 enabled: false`);
      return NextResponse.json(
        { enabled: false, message: 'TMDB演员搜索功能未启用' },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    console.log(`[TMDB Cast Photos] 功能已启用，继续处理请求`);

    const config = await getConfig();

    const names = namesParam.split(',').map(n => n.trim()).filter(n => n);
    if (names.length === 0) {
      return NextResponse.json({ enabled: true, actors: [] });
    }

    // 限制最多查询20个演员
    const limitedNames = names.slice(0, 20);

    // 生成缓存key（保持原始顺序）
    const cacheKey = `tmdb-cast-photos-${limitedNames.join(',')}`;

    // 检查缓存（开关状态已在上面检查过，这里只缓存演员数据）
    try {
      const cachedResult = await db.getCache(cacheKey);
      if (cachedResult && cachedResult.actors) {
        console.log(`✅ [TMDB Cast Photos] 缓存命中: ${limitedNames.length} 个演员`);
        // 返回时重新设置 enabled 状态，并过滤掉没有图片的演员（兼容旧缓存）
        const actorsWithPhoto = cachedResult.actors.filter((actor: any) => actor.photo);
        return NextResponse.json({ enabled: true, actors: actorsWithPhoto });
      }
    } catch (cacheError) {
      console.warn('TMDB演员图片缓存检查失败:', cacheError);
    }

    const apiKey = getNextTMDBApiKey(config);
    const language = config.SiteConfig.TMDBLanguage || 'zh-CN';

    // 并发获取所有演员图片
    const actorPhotos: ActorPhoto[] = await Promise.all(
      limitedNames.map(async (name): Promise<ActorPhoto> => {
        try {
          const url = `${TMDB_BASE_URL}/search/person?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(name)}`;
          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }
          });

          if (!response.ok) {
            console.warn(`TMDB搜索演员失败: ${name}, status: ${response.status}`);
            return { name, photo: null, id: null };
          }

          const data = await response.json();
          if (data.results && data.results.length > 0) {
            // 优先选择：1.名字完全匹配且有头像 2.名字完全匹配 3.有头像且人气最高 4.人气最高
            const results = data.results;
            const exactMatchWithPhoto = results.find((p: any) => p.name === name && p.profile_path);
            const exactMatch = results.find((p: any) => p.name === name);
            const withPhotoSorted = results.filter((p: any) => p.profile_path).sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
            const person = exactMatchWithPhoto || exactMatch || withPhotoSorted[0] || results.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))[0];
            return {
              name,
              photo: person.profile_path ? `${TMDB_IMAGE_BASE_URL}${person.profile_path}` : null,
              id: person.id
            };
          }
          return { name, photo: null, id: null };
        } catch (error) {
          console.warn(`获取演员图片失败: ${name}`, error);
          return { name, photo: null, id: null };
        }
      })
    );

    // 过滤掉没有图片的演员
    const actorsWithPhoto = actorPhotos.filter(actor => actor.photo);

    const result = {
      enabled: true,
      actors: actorsWithPhoto
    };

    // 缓存结果
    try {
      await db.setCache(cacheKey, result, CACHE_TIME);
      console.log(`💾 TMDB演员图片已缓存: ${limitedNames.length} 个演员`);
    } catch (cacheError) {
      console.warn('TMDB演员图片缓存保存失败:', cacheError);
    }

    // 不设置浏览器缓存，因为开关状态可能随时变化
    return NextResponse.json(result);
  } catch (error) {
    console.error('[TMDB Cast Photos] 获取失败:', error);
    return NextResponse.json(
      { error: '获取演员图片失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
