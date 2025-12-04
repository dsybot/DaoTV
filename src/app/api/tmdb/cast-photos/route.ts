/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w185'; // 使用较小的图片尺寸
const CACHE_TIME = 24 * 60 * 60; // 24小时缓存

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
    const config = await getConfig();

    // 检查TMDB是否启用
    if (!config.SiteConfig.EnableTMDBActorSearch || !config.SiteConfig.TMDBApiKey) {
      return NextResponse.json(
        { enabled: false, message: 'TMDB演员搜索功能未启用' },
        { status: 200 }
      );
    }

    const names = namesParam.split(',').map(n => n.trim()).filter(n => n);
    if (names.length === 0) {
      return NextResponse.json({ enabled: true, actors: [] });
    }

    // 限制最多查询20个演员
    const limitedNames = names.slice(0, 20);

    // 生成缓存key
    const cacheKey = `tmdb-cast-photos-${limitedNames.sort().join(',')}`;

    // 检查缓存
    try {
      const cachedResult = await db.getCache(cacheKey);
      if (cachedResult) {
        console.log(`✅ [TMDB Cast Photos] 缓存命中: ${limitedNames.length} 个演员`);
        return NextResponse.json(cachedResult);
      }
    } catch (cacheError) {
      console.warn('TMDB演员图片缓存检查失败:', cacheError);
    }

    const apiKey = config.SiteConfig.TMDBApiKey;
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
            // 取人气最高的结果
            const person = data.results.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))[0];
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

    const result = {
      enabled: true,
      actors: actorPhotos
    };

    // 缓存结果
    try {
      await db.setCache(cacheKey, result, CACHE_TIME);
      console.log(`💾 TMDB演员图片已缓存: ${limitedNames.length} 个演员`);
    } catch (cacheError) {
      console.warn('TMDB演员图片缓存保存失败:', cacheError);
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': `public, max-age=${CACHE_TIME}, s-maxage=${CACHE_TIME}`,
      },
    });
  } catch (error) {
    console.error('[TMDB Cast Photos] 获取失败:', error);
    return NextResponse.json(
      { error: '获取演员图片失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
