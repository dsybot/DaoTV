/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';
const TMDB_LOGO_BASE_URL = 'https://image.tmdb.org/t/p/w500';

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
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'TMDB API 请求失败' }, { status: response.status });
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results.find((r: any) => r.backdrop_path) || data.results[0];
      const mediaId = result.id;

      let backdrop = null;
      let logo = null;

      if (result.backdrop_path) {
        backdrop = `${TMDB_BACKDROP_BASE_URL}${result.backdrop_path}`;
      }

      // 获取Logo图片（标题艺术字）
      try {
        const imagesUrl = `${TMDB_BASE_URL}/${searchType}/${mediaId}/images?api_key=${apiKey}`;
        const imagesResponse = await fetch(imagesUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          next: { revalidate: 3600 },
        });

        if (imagesResponse.ok) {
          const imagesData = await imagesResponse.json();
          // 优先选择中文Logo，其次英文，最后任意语言
          const logos = imagesData.logos || [];
          const chineseLogo = logos.find((l: any) => l.iso_639_1 === 'zh');
          const englishLogo = logos.find((l: any) => l.iso_639_1 === 'en');
          const anyLogo = logos[0];

          const selectedLogo = chineseLogo || englishLogo || anyLogo;
          if (selectedLogo?.file_path) {
            logo = `${TMDB_LOGO_BASE_URL}${selectedLogo.file_path}`;
          }
        }
      } catch (logoError) {
        console.error('获取Logo失败:', logoError);
      }

      return NextResponse.json({
        backdrop,
        logo,
        title: result.title || result.name,
        id: mediaId,
      });
    }

    return NextResponse.json({ backdrop: null, logo: null });
  } catch (error) {
    console.error('获取TMDB背景图失败:', error);
    return NextResponse.json({ error: '获取背景图失败' }, { status: 500 });
  }
}
