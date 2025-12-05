/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const year = searchParams.get('year') || '';
    const type = searchParams.get('type') || 'tv';

    if (!title) {
      return NextResponse.json({ error: '缺少标题参数' }, { status: 400 });
    }

    const config = await getConfig();
    const apiKey = config.SiteConfig.TMDBApiKey;

    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB API Key 未配置' }, { status: 503 });
    }

    const language = config.SiteConfig.TMDBLanguage || 'zh-CN';

    // 搜索电影或电视剧
    const searchType = type === 'movie' ? 'movie' : 'tv';
    const searchUrl = `${TMDB_BASE_URL}/search/${searchType}?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`;

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 3600 }, // 缓存1小时
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'TMDB API 请求失败' }, { status: response.status });
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // 优先选择有背景图的结果
      const result = data.results.find((r: any) => r.backdrop_path) || data.results[0];

      if (result.backdrop_path) {
        return NextResponse.json({
          backdrop: `${TMDB_BACKDROP_BASE_URL}${result.backdrop_path}`,
          title: result.title || result.name,
          id: result.id,
        });
      }
    }

    return NextResponse.json({ backdrop: null });
  } catch (error) {
    console.error('获取TMDB背景图失败:', error);
    return NextResponse.json({ error: '获取背景图失败' }, { status: 500 });
  }
}
