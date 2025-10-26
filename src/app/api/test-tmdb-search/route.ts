import { NextResponse } from 'next/server';
import { searchTMDBMovie, searchTMDBTV } from '@/lib/tmdb.client';

export const runtime = 'nodejs';

/**
 * 测试TMDB搜索API - 用于调试中文标题搜索
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || '死亡竞走';
    const type = searchParams.get('type') || 'movie';

    console.log(`[TMDB测试] 搜索: ${title} (${type})`);

    let results;
    if (type === 'movie') {
      const response = await searchTMDBMovie(title);
      results = response.results.map(r => ({
        id: r.id,
        title: r.title,
        original_title: r.original_title,
        release_date: r.release_date,
        backdrop_path: r.backdrop_path,
        poster_path: r.poster_path,
        overview: r.overview?.substring(0, 100),
      }));
    } else {
      const response = await searchTMDBTV(title);
      results = response.results.map(r => ({
        id: r.id,
        name: r.name,
        original_name: r.original_name,
        first_air_date: r.first_air_date,
        backdrop_path: r.backdrop_path,
        poster_path: r.poster_path,
        overview: r.overview?.substring(0, 100),
      }));
    }

    return NextResponse.json({
      query: title,
      type,
      resultCount: results.length,
      results
    });
  } catch (error) {
    console.error('[TMDB测试] 错误:', error);
    return NextResponse.json(
      {
        error: (error as Error).message
      },
      { status: 500 }
    );
  }
}
