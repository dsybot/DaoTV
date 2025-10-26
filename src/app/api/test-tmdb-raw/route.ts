import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

/**
 * 测试原始TMDB API调用 - 不经过任何封装
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || '死亡竞走';
    const type = searchParams.get('type') || 'movie';

    const config = await getConfig();
    const apiKey = config.SiteConfig.TMDBApiKey;
    const language = config.SiteConfig.TMDBLanguage || 'zh-CN';

    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB API Key未配置' }, { status: 500 });
    }

    // 直接调用TMDB API
    const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';
    const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(title)}`;
    
    console.log('[原始TMDB测试] URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));

    const response = await fetch(url);
    const data = await response.json();

    return NextResponse.json({
      searchQuery: title,
      type,
      language,
      endpoint,
      responseStatus: response.status,
      totalResults: data.total_results || 0,
      results: data.results?.map((r: any) => ({
        id: r.id,
        title: r.title || r.name,
        original_title: r.original_title || r.original_name,
        release_date: r.release_date || r.first_air_date,
        backdrop_path: r.backdrop_path,
        poster_path: r.poster_path,
      })) || [],
      rawResponse: data
    });
  } catch (error) {
    console.error('[原始TMDB测试] 错误:', error);
    return NextResponse.json(
      { error: (error as Error).message, stack: (error as Error).stack },
      { status: 500 }
    );
  }
}
