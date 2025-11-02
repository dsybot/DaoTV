import { NextResponse } from 'next/server';
import { getCarouselItemByTitle } from '@/lib/tmdb.client';

export const runtime = 'nodejs';

/**
 * 测试TMDB搜索API - 测试完整的轮播搜索流程
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || '死亡竞走';
    const type = (searchParams.get('type') || 'movie') as 'movie' | 'tv';

    console.log(`[TMDB测试] 测试轮播搜索: ${title} (${type})`);

    const result = await getCarouselItemByTitle(title, type);

    if (result) {
      return NextResponse.json({
        success: true,
        query: title,
        type,
        result: {
          id: result.id,
          title: result.title,
          overview: result.overview?.substring(0, 100),
          backdrop: result.backdrop,
          poster: result.poster,
          rate: result.rate,
          year: result.year,
          hasBackdrop: !!result.backdrop,
          hasPoster: !!result.poster
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        query: title,
        type,
        message: '未找到匹配结果'
      });
    }
  } catch (error) {
    console.error('[TMDB测试] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        stack: (error as Error).stack
      },
      { status: 500 }
    );
  }
}
