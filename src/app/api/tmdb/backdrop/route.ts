/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';
const TMDB_LOGO_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_STILL_BASE_URL = 'https://image.tmdb.org/t/p/w400';
const TMDB_NETWORK_LOGO_URL = 'https://image.tmdb.org/t/p/h60';
const TMDB_PROFILE_BASE_URL = 'https://image.tmdb.org/t/p/w300';

// 解析中文数字（支持一到九百九十九）
function parseChineseNumber(str: string): number {
  const digits: Record<string, number> = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  const units: Record<string, number> = { '十': 10, '百': 100 };

  let result = 0;
  let temp = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (digits[char] !== undefined) {
      temp = digits[char];
    } else if (units[char] !== undefined) {
      if (temp === 0 && char === '十') temp = 1; // 处理"十"开头的情况
      result += temp * units[char];
      temp = 0;
    }
  }
  result += temp; // 加上最后的个位数

  return result || 1;
}

// 清理标题，去掉季数后缀，返回标题列表和可能的季数
function cleanTitle(title: string): { titles: string[]; seasonNumber: number } {
  const titles: string[] = [title];
  let seasonNumber = 1;

  // 去掉"第X季"后缀（支持空格分隔，如"老大哥(美版) 第二十七季" -> "老大哥(美版)"）
  const seasonMatch = title.match(/^(.+?)\s*第([零一二三四五六七八九十百]+|\d+)季$/);
  if (seasonMatch) {
    titles.push(seasonMatch[1].trim());
    const seasonStr = seasonMatch[2];
    seasonNumber = /^\d+$/.test(seasonStr) ? parseInt(seasonStr) : parseChineseNumber(seasonStr);
  }

  // 去掉数字后缀（如"喜人奇妙夜2" -> "喜人奇妙夜"）
  const numberMatch = title.match(/^(.+?)(\d+)$/);
  if (numberMatch && numberMatch[1].length >= 2) {
    titles.push(numberMatch[1].trim());
    seasonNumber = parseInt(numberMatch[2]) || 1;
  }

  // 去掉"之XXX"后缀（如"诡事录之长安" -> "诡事录"）
  const suffixMatch = title.match(/^(.+?)之.+$/);
  if (suffixMatch && suffixMatch[1].length >= 2) {
    titles.push(suffixMatch[1].trim());
  }

  // 去掉冒号后的内容（如"出差十五夜: STARSHIP秋季郊游会2" -> "出差十五夜"，"大逃脱：故事模式" -> "大逃脱"）
  const colonMatch = title.match(/^(.+?)[：:].+$/);
  if (colonMatch && colonMatch[1].length >= 2) {
    titles.push(colonMatch[1].trim());
  }

  // 去掉中间点后的内容（如"初入职场·中医季" -> "初入职场"）
  const dotMatch = title.match(/^(.+?)[·•].+$/);
  if (dotMatch && dotMatch[1].length >= 2) {
    titles.push(dotMatch[1].trim());
  }

  return { titles: Array.from(new Set(titles)), seasonNumber };
}

// 通过IMDb ID查找TMDB
async function findByImdbId(imdbId: string, apiKey: string, type: string): Promise<any> {
  try {
    const findUrl = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`;
    const response = await fetch(findUrl, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      const results = type === 'movie' ? data.movie_results : data.tv_results;
      if (results && results.length > 0) {
        console.log(`[TMDB] 通过IMDb ID "${imdbId}" 找到: ${results[0].name || results[0].title}`);
        return results[0];
      }
    }
  } catch (e) {
    console.error('[TMDB] IMDb查找失败:', e);
  }
  return null;
}

// 通过标题搜索TMDB
async function searchByTitle(searchQuery: string, year: string, type: string, apiKey: string, language: string): Promise<any> {
  const searchType = type === 'movie' ? 'movie' : 'tv';
  const searchUrl = `${TMDB_BASE_URL}/search/${searchType}?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(searchQuery)}${year ? `&year=${year}` : ''}`;
  const response = await fetch(searchUrl, {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  if (response.ok) {
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      // 优先选择名字与搜索关键词完全匹配的结果
      const exactMatch = data.results.find((r: any) =>
        (r.name === searchQuery || r.title === searchQuery || r.original_name === searchQuery || r.original_title === searchQuery)
      );
      if (exactMatch) {
        console.log(`[TMDB] 找到完全匹配: "${exactMatch.name || exactMatch.title}" (搜索: "${searchQuery}")`);
        return exactMatch;
      }

      // 其次选择有背景图的结果
      const withBackdrop = data.results.find((r: any) => r.backdrop_path);
      if (withBackdrop) {
        return withBackdrop;
      }

      // 最后返回第一个结果
      return data.results[0];
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const year = searchParams.get('year') || '';
    const type = searchParams.get('type') || 'tv';
    const season = searchParams.get('season') || '1';
    const includeDetails = searchParams.get('details') === 'true';
    const imdbId = searchParams.get('imdb_id') || '';

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

    let result: any = null;
    let detectedSeason = parseInt(season) || 1;

    // 1. 优先通过IMDb ID精确匹配
    if (imdbId) {
      result = await findByImdbId(imdbId, apiKey, type);
    }

    // 2. 如果没有IMDb ID或匹配失败，通过标题搜索
    if (!result) {
      const { titles: titlesToTry, seasonNumber } = cleanTitle(title);
      detectedSeason = seasonNumber; // 使用从标题中检测到的季数
      for (const t of titlesToTry) {
        // 用当前搜索关键词匹配，优先选择名字完全一致的结果
        result = await searchByTitle(t, year, type, apiKey, language);
        if (result) {
          console.log(`[TMDB] 搜索 "${t}" 找到: ${result.name || result.title} (ID: ${result.id}), 检测季数: ${detectedSeason}`);
          break;
        }
        // 如果带年份搜索不到，尝试不带年份
        if (year && !result) {
          result = await searchByTitle(t, '', type, apiKey, language);
          if (result) {
            console.log(`[TMDB] 搜索 "${t}" (无年份) 找到: ${result.name || result.title} (ID: ${result.id}), 检测季数: ${detectedSeason}`);
            break;
          }
        }
        // 如果指定类型搜索不到，尝试另一种类型
        if (!result) {
          const alternateType = type === 'movie' ? 'tv' : 'movie';
          result = await searchByTitle(t, year, alternateType, apiKey, language);
          if (result) {
            console.log(`[TMDB] 搜索 "${t}" (类型: ${alternateType}) 找到: ${result.name || result.title} (ID: ${result.id})`);
            break;
          }
          // 不带年份再试一次
          if (year && !result) {
            result = await searchByTitle(t, '', alternateType, apiKey, language);
            if (result) {
              console.log(`[TMDB] 搜索 "${t}" (类型: ${alternateType}, 无年份) 找到: ${result.name || result.title} (ID: ${result.id})`);
              break;
            }
          }
        }
      }
    }

    if (result) {
      const mediaId = result.id;

      let backdrop = result.backdrop_path ? `${TMDB_BACKDROP_BASE_URL}${result.backdrop_path}` : null;
      let logo = null;
      let providers: any[] = [];
      let episodes: any[] = [];
      let seasons: any[] = [];
      let cast: any[] = [];

      // 对于电视剧，尝试获取对应季的背景图和Logo
      if (searchType === 'tv' && detectedSeason > 0) {
        try {
          const seasonImagesUrl = `${TMDB_BASE_URL}/tv/${mediaId}/season/${detectedSeason}/images?api_key=${apiKey}`;
          const seasonImagesResponse = await fetch(seasonImagesUrl, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
          });
          if (seasonImagesResponse.ok) {
            const seasonImagesData = await seasonImagesResponse.json();
            // 获取季的海报作为背景（如果有）
            const seasonPosters = seasonImagesData.posters || [];
            if (seasonPosters.length > 0) {
              // 季的海报通常是竖版的，不太适合做背景，跳过
            }
          }
        } catch (e) { /* ignore */ }
      }

      // 获取Logo图片（优先获取对应季的Logo）
      try {
        // 先尝试获取对应季的Logo
        let foundSeasonLogo = false;
        if (searchType === 'tv' && detectedSeason > 0) {
          const seasonDetailUrl = `${TMDB_BASE_URL}/tv/${mediaId}/season/${detectedSeason}?api_key=${apiKey}&language=${language}&append_to_response=images`;
          const seasonDetailResponse = await fetch(seasonDetailUrl, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
          });
          if (seasonDetailResponse.ok) {
            const seasonDetailData = await seasonDetailResponse.json();
            // 使用季的名称作为标题（如果需要的话）
            // 获取季的图片
            const seasonImages = seasonDetailData.images || {};
            const seasonLogos = seasonImages.logos || [];
            if (seasonLogos.length > 0) {
              const selectedLogo = seasonLogos.find((l: any) => l.iso_639_1 === 'zh') ||
                seasonLogos.find((l: any) => l.iso_639_1 === 'en') ||
                seasonLogos[0];
              if (selectedLogo?.file_path) {
                logo = `${TMDB_LOGO_BASE_URL}${selectedLogo.file_path}`;
                foundSeasonLogo = true;
                console.log(`[TMDB] 使用第${detectedSeason}季的Logo`);
              }
            }
          }
        }

        // 如果没有找到季的Logo，使用剧集的Logo
        if (!foundSeasonLogo) {
          const imagesUrl = `${TMDB_BASE_URL}/${searchType}/${mediaId}/images?api_key=${apiKey}`;
          const imagesResponse = await fetch(imagesUrl, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
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

      // 构建基本响应
      const response: any = {
        backdrop,
        logo,
        title: result.title || result.name,
        id: mediaId,
        // 基本信息（从搜索结果中获取）
        overview: result.overview || '',
        vote_average: result.vote_average || 0,
        first_air_date: result.first_air_date || result.release_date || '',
        genre_ids: result.genre_ids || [],
      };

      // 详细信息
      if (includeDetails) {
        response.providers = providers;
        response.episodes = episodes;
        response.seasons = seasons;
        response.cast = cast;
      }

      return NextResponse.json(response);
    }

    return NextResponse.json({ backdrop: null, logo: null });
  } catch (error) {
    console.error('获取TMDB信息失败:', error);
    return NextResponse.json({ error: '获取信息失败' }, { status: 500 });
  }
}
