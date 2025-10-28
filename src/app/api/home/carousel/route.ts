import { NextResponse } from 'next/server';

import { getCachedCarousel } from '@/lib/carousel-cache';
import { isCarouselEnabled } from '@/lib/tmdb.client';
import { generateCarouselData } from '@/lib/carousel-generator';

export const runtime = 'nodejs';

/**
 * 获取首页轮播图数据
 * 
 * 新策略（简化版）：
 * 1. 优先返回服务器缓存（定时任务每小时更新）
 * 2. 如果缓存不存在，实时生成（降级机制）
 * 3. 用户永远获得快速响应
 * 
 * 优点：
 * - 用户访问极快（直接读缓存）
 * - 数据始终最新（定时任务更新）
 * - 逻辑简单（无复杂的bypass参数）
 */
export async function GET() {
  try {
    // 检查轮播图是否启用
    const carouselEnabled = await isCarouselEnabled();
    if (!carouselEnabled) {
      return NextResponse.json(
        {
          code: 503,
          message: 'TMDB轮播图功能未启用',
          list: []
        },
        { status: 503 }
      );
    }

    console.log('[轮播API] ===== 获取轮播图数据 =====');

    // 步骤1：尝试从服务器缓存获取
    const cached = await getCachedCarousel();

    if (cached && cached.list.length > 0) {
      const ageMinutes = Math.floor((Date.now() - new Date(cached.generatedAt).getTime()) / 1000 / 60);
      console.log(`[轮播API] ✅ 返回服务器缓存（${cached.list.length}项，${ageMinutes}分钟前生成）`);

      return NextResponse.json(
        {
          code: 200,
          message: '获取成功',
          list: cached.list,
          meta: {
            source: 'cache',
            generatedAt: cached.generatedAt,
            ageMinutes,
          }
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=300', // 5分钟浏览器缓存
            'X-Cache-Status': 'HIT',
            'X-Generated-At': cached.generatedAt,
          },
        }
      );
    }

    // 步骤2：缓存不存在，降级为实时生成
    console.log('[轮播API] ⚠️  缓存未命中，开始实时生成（可能较慢）...');

    const carouselList = await generateCarouselData();

    if (carouselList.length === 0) {
      console.error('[轮播API] ❌ 生成失败，未获取到数据');
      return NextResponse.json({
        code: 200,
        message: '暂无轮播数据',
        list: [],
      });
    }

    console.log(`[轮播API] ✅ 实时生成成功（${carouselList.length}项）`);

    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        list: carouselList,
        meta: {
          source: 'realtime',
          generatedAt: new Date().toISOString(),
        }
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300', // 5分钟浏览器缓存
          'X-Cache-Status': 'MISS',
        },
      }
    );

  } catch (error) {
    console.error('[轮播API] ❌ 获取失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取轮播数据失败',
        details: (error as Error).message,
        list: [],
      },
      { status: 500 }
    );
  }
}
