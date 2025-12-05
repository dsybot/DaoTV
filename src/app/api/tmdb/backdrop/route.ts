/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';
const TMDB_LOGO_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_STILL_BASE_URL = 'https://image.tmdb.org/t/p/w400';
const TMDB_NETWORK_LOGO_URL = 'https://image.tmdb.org/t/p/h60';
const TMDB_PROFILE_BASE_URL = 'https://image.tmdb.org/t/p/w300';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const year = searchParams.get('year') || '';
    const type = searchParams.get('type') || 'tv';
    const season = searchParams.get('season') || '1';
    const includeDetails = searchParams.get('details') === 'true';

    if (!title) {
      return NextResponse.json({ error: '缺少标题参数' }, { status: 400 });
    }

    const config = await getConfig();
    const apiKey = config.SiteConfig.TMDBApiKey;

    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB API Key 未配置' }, { status: 503 });
    }

    const language = config.SiteConfig.TMDBLanguage || 'zh-CN';
    const searchType = type === 'movie' ? 'movie' : 'tv';

    // 搜索电影或电视剧
    const searchUrl = `${TMDB_BASE_URL}/search/${searchType}?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`;
    const response = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'TMDB API 请求失败' }, { status: response.status });
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results.find((r: any) => r.backdrop_path) || data.results[0];
      const mediaId = result.id;
      console.log(`[TMDB] 搜索 "${title}" 找到: ${result.name || result.title} (ID: ${mediaId}), 共 ${data.results.length} 个结果`);

      let backdrop = result.backdrop_path ? `${TMDB_BACKDROP_BASE_URL}${result.backdrop_path}` : null;
      let logo = null;
      let providers: any[] = [];
      let episodes: any[] = [];
      let seasons: any[] = [];
      let cast: any[] = [];

      // 获取Logo图片
      try {
        const imagesUrl = `${TMDB_BASE_URL}/${searchType}/${mediaId}/images?api_key=${apiKey}`;
        const imagesResponse = await fetch(imagesUrl, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 3600 },
        });

        if (imagesResponse.ok) {
          const imagesData = await imagesResponse.json();
          const logos = imagesData.logos || [];
          const selectedLogo = logos.find((l: any) => l.iso_639_1 === 'zh') ||
            logos.find((l: any) => l.iso_639_1 === 'en') ||
            logos[0];
          if (selectedLogo?.file_path) {
            logo = `${TMDB_LOGO_BASE_URL}${selectedLogo.file_path}`;
          }
        }
      } catch (e) { /* ignore */ }

      // 如果需要详细信息
      if (includeDetails) {
        // 获取演员列表
        try {
          // 电视剧使用aggregate_credits获取所有季的演员，电影使用credits
          const creditsEndpoint = searchType === 'tv' ? 'aggregate_credits' : 'credits';
          const creditsUrl = `${TMDB_BASE_URL}/${searchType}/${mediaId}/${creditsEndpoint}?api_key=${apiKey}&language=${language}`;
          const creditsResponse = await fetch(creditsUrl, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
          });

          if (creditsResponse.ok) {
            const creditsData = await creditsResponse.json();
            console.log(`[TMDB] ${creditsEndpoint} API返回 ${(creditsData.cast || []).length} 个演员`);
            // 获取前30个有头像的演员
            cast = (creditsData.cast || [])
              .filter((c: any) => c.profile_path)
              .slice(0, 30)
              .map((c: any) => ({
                id: c.id,
                name: c.name,
                character: searchType === 'tv' ? (c.roles?.[0]?.character || '') : c.character,
                photo: `${TMDB_PROFILE_BASE_URL}${c.profile_path}`,
              }));
            console.log(`[TMDB] 过滤后有头像的演员: ${cast.length} 个`);
          }
        } catch (e) {
          console.error('[TMDB] 获取演员列表失败:', e);
        }

        // 获取分集信息（仅电视剧）
        if (searchType === 'tv') {
          try {
            // 先获取剧集详情以获取季数
            const detailUrl = `${TMDB_BASE_URL}/tv/${mediaId}?api_key=${apiKey}&language=${language}`;
            const detailResponse = await fetch(detailUrl, {
              headers: { 'Accept': 'application/json' },
              next: { revalidate: 3600 },
            });

            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              seasons = (detailData.seasons || [])
                .filter((s: any) => s.season_number > 0)
                .map((s: any) => ({
                  seasonNumber: s.season_number,
                  name: s.name,
                  episodeCount: s.episode_count,
                }));
              // 获取播出平台（networks）
              const networks = detailData.networks || [];
              providers = networks.slice(0, 3).map((n: any) => ({
                id: n.id,
                name: n.name,
                logo: n.logo_path ? `${TMDB_NETWORK_LOGO_URL}${n.logo_path}` : null,
              }));
            }

            // 获取指定季的分集
            const seasonUrl = `${TMDB_BASE_URL}/tv/${mediaId}/season/${season}?api_key=${apiKey}&language=${language}`;
            const seasonResponse = await fetch(seasonUrl, {
              headers: { 'Accept': 'application/json' },
              next: { revalidate: 3600 },
            });

            if (seasonResponse.ok) {
              const seasonData = await seasonResponse.json();
              episodes = (seasonData.episodes || []).map((ep: any) => ({
                episodeNumber: ep.episode_number,
                name: ep.name,
                overview: ep.overview,
                stillPath: ep.still_path ? `${TMDB_STILL_BASE_URL}${ep.still_path}` : null,
                airDate: ep.air_date,
                runtime: ep.runtime,
              }));
            }
          } catch (e) { /* ignore */ }
        }
      }

      return NextResponse.json({
        backdrop,
        logo,
        title: result.title || result.name,
        id: mediaId,
        providers: includeDetails ? providers : undefined,
        episodes: includeDetails ? episodes : undefined,
        seasons: includeDetails ? seasons : undefined,
        cast: includeDetails ? cast : undefined,
      });
    }

    return NextResponse.json({ backdrop: null, logo: null });
  } catch (error) {
    console.error('获取TMDB信息失败:', error);
    return NextResponse.json({ error: '获取信息失败' }, { status: 500 });
  }
}
