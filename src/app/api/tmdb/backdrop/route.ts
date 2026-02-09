/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

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

/**
 * 构建 TMDB API URL（支持 Worker 代理）
 * @param config 配置对象
 * @param endpoint API 端点（如 /search/tv）
 * @param params 查询参数
 * @returns 完整的 URL 字符串
 */
function buildApiUrl(config: any, endpoint: string, params: Record<string, string>): string {
  const workerProxy = config.SiteConfig.TMDBWorkerProxy || '';

  // 如果配置了 Worker 代理，使用代理
  if (workerProxy) {
    const proxyUrl = workerProxy.replace(/\/$/, ''); // 移除末尾斜杠
    const url = new URL(`${proxyUrl}${endpoint}`);

    // 添加所有参数
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.append(key, value);
      }
    });

    return url.toString();
  }

  // 没有配置代理，直连 TMDB
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);

  // 添加所有参数
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.append(key, value);
    }
  });

  return url.toString();
}
// TMDB 图片 URL 生成（不使用代理，因为 image.tmdb.org 全球可访问）
function getTMDBImageUrl(config: any, path: string | null, size: string): string | null {
  if (!path) return null;

  // 图片 CDN 不需要代理，直接返回原始 URL
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

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

  // 去掉"第X部分"后缀（如"赛马娘 芦毛灰姑娘 第2部分" -> "赛马娘 芦毛灰姑娘"）
  const partMatch = title.match(/^(.+?)\s*第([零一二三四五六七八九十百]+|\d+)部分?$/);
  if (partMatch) {
    titles.push(partMatch[1].trim());
    const partStr = partMatch[2];
    seasonNumber = /^\d+$/.test(partStr) ? parseInt(partStr) : parseChineseNumber(partStr);
  }

  // 去掉数字后缀（如"喜人奇妙夜2" -> "喜人奇妙夜"）
  const numberMatch = title.match(/^(.+?)(\d+)$/);
  if (numberMatch && numberMatch[1].length >= 2) {
    titles.push(numberMatch[1].trim());
    seasonNumber = parseInt(numberMatch[2]) || 1;
  }

  // 去掉"数字+冒号+副标题"后缀（如"晩酌的流派4：秋冬篇" -> "晩酌的流派"）
  const numberColonMatch = title.match(/^(.+?)(\d+)[：:].+$/);
  if (numberColonMatch && numberColonMatch[1].length >= 2) {
    titles.push(numberColonMatch[1].trim());
    seasonNumber = parseInt(numberColonMatch[2]) || 1;
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

  // 去掉语言版本后缀（如"名侦探柯南 国语版" -> "名侦探柯南"）
  const langMatch = title.match(/^(.+?)\s*(国语版|粤语版|日语版|英语版|中文版|原声版|配音版)$/);
  if (langMatch && langMatch[1].length >= 2) {
    titles.push(langMatch[1].trim());
  }

  // 去掉括号内的语言/版本标记（如"九品芝麻官（粤）" -> "九品芝麻官"，"功夫(国语)" -> "功夫"）
  const bracketLangMatch = title.match(/^(.+?)[（(](粤|国|国语|粤语|日语|英语|中文|原声|配音|港版|台版|美版)[）)]$/);
  if (bracketLangMatch && bracketLangMatch[1].length >= 2) {
    titles.push(bracketLangMatch[1].trim());
  }

  // 去掉末尾的括号内容（更通用，如"XXX（YYY）" -> "XXX"）
  const bracketMatch = title.match(/^(.+?)[（(][^）)]+[）)]$/);
  if (bracketMatch && bracketMatch[1].length >= 2) {
    // 只有当括号内容较短时才添加（避免误删重要信息）
    const bracketContent = title.slice(bracketMatch[1].length);
    if (bracketContent.length <= 6) {
      titles.push(bracketMatch[1].trim());
    }
  }

  return { titles: Array.from(new Set(titles)), seasonNumber };
}

// 通过IMDb ID查找TMDB
async function findByImdbId(config: any, imdbId: string, apiKey: string, type: string, language: string): Promise<any> {
  try {
    const findUrl = buildApiUrl(config, `/find/${imdbId}`, {
      api_key: apiKey,
      external_source: 'imdb_id',
      language: language
    });

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

// 计算日期差异（天数）
function calculateDateDiff(date1: string, date2: string): number {
  if (!date1 || !date2) return Infinity;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return Infinity;
  return Math.abs(Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)));
}


// 通过标题搜索TMDB（简化版，用于降级匹配）
async function searchByTitle(config: any, searchQuery: string, year: string, type: string, apiKey: string, language: string): Promise<any> {
  const searchType = type === 'movie' ? 'movie' : 'tv';

  const params: Record<string, string> = {
    api_key: apiKey,
    language: language,
    query: searchQuery
  };

  // 如果提供了年份，添加年份参数
  if (year) {
    if (searchType === 'movie') {
      params.year = year;
    } else {
      params.first_air_date_year = year;
    }
  }

  const searchUrl = buildApiUrl(config, `/search/${searchType}`, params);

  const response = await fetch(searchUrl, {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });

  if (response.ok) {
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      // 优先选择名字完全匹配的结果
      const exactMatch = data.results.find((r: any) =>
        (r.name === searchQuery || r.title === searchQuery || r.original_name === searchQuery || r.original_title === searchQuery)
      );
      if (exactMatch) {
        return exactMatch;
      }

      // 否则返回第一个结果
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
    const airDate = searchParams.get('air_date') || ''; // 新增：开播日期参数（格式：YYYY-MM-DD）

    if (!title) {
      return NextResponse.json({ error: '缺少标题参数' }, { status: 400 });
    }

    const config = await getConfig();
    const apiKey = getNextTMDBApiKey(config);

    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB API Key 未配置' }, { status: 503 });
    }

    const language = config.SiteConfig.TMDBLanguage || 'zh-CN';
    const searchType = type === 'movie' ? 'movie' : 'tv';

    let result: any = null;
    let detectedSeason = parseInt(season) || 1;

    // 1. 优先通过IMDb ID精确匹配
    if (imdbId) {
      result = await findByImdbId(config, imdbId, apiKey, type, language);
      if (result) {
        // 对于电视剧，验证IMDb匹配的结果是否有效（检查是否有季数信息）
        if (searchType === 'tv') {
          try {
            const detailUrl = buildApiUrl(config, `/tv/${result.id}`, {
              api_key: apiKey,
              language: language
            });
            const detailResponse = await fetch(detailUrl, {
              headers: { 'Accept': 'application/json' },
              cache: 'no-store',
            });
            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              const validSeasons = (detailData.seasons || []).filter((s: any) => s.season_number > 0);
              // 如果没有有效的季数信息，可能是错误的条目，回退到标题搜索
              if (validSeasons.length === 0) {
                console.log(`[TMDB] IMDb匹配的结果 "${result.name}" 没有季数信息，回退到标题搜索`);
                result = null;
              }
            }
          } catch (e) {
            console.error('[TMDB] 验证IMDb匹配结果失败:', e);
          }
        }
      }
    }

    // 2. 如果没有IMDb ID或匹配失败或验证失败，通过标题搜索
    if (!result) {
      const { titles: titlesToTry, seasonNumber } = cleanTitle(title);
      detectedSeason = seasonNumber; // 使用从标题中检测到的季数

      // 如果提供了开播日期，使用日期匹配
      if (airDate && searchType === 'tv') {
        console.log(`[TMDB] 使用开播日期匹配: ${airDate}`);

        // 搜索所有可能的标题变体
        let allCandidates: any[] = [];
        for (const t of titlesToTry) {
          // 搜索该标题的所有结果
          const params: Record<string, string> = {
            api_key: apiKey,
            language: language,
            query: t
          };
          const searchUrl = buildApiUrl(config, `/search/tv`, params);
          const searchResponse = await fetch(searchUrl, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const searchResults = searchData.results || [];

            console.log(`[TMDB] 搜索 "${t}" 找到 ${searchResults.length} 个结果`);

            // 对每个搜索结果，获取其所有季信息（处理前10个结果以覆盖更多版本）
            for (const searchResult of searchResults.slice(0, 10)) {
              try {
                const detailUrl = buildApiUrl(config, `/tv/${searchResult.id}`, {
                  api_key: apiKey,
                  language: language
                });
                const detailResponse = await fetch(detailUrl, {
                  headers: { 'Accept': 'application/json' },
                  cache: 'no-store',
                });
                if (detailResponse.ok) {
                  const detailData = await detailResponse.json();
                  const seasons = (detailData.seasons || []).filter((s: any) => s.season_number > 0);

                  // 将每一季作为候选项
                  for (const s of seasons) {
                    allCandidates.push({
                      ...searchResult,
                      season_number: s.season_number,
                      season_name: s.name,
                      season_air_date: s.air_date,
                      tv_id: searchResult.id,
                      tv_name: searchResult.name || searchResult.title
                    });
                  }
                }
              } catch (e) {
                console.error(`[TMDB] 获取剧集 ${searchResult.id} 的季信息失败:`, e);
              }
            }
          }
        }

        // 根据开播日期选择最接近的季
        if (allCandidates.length > 0) {
          const candidatesWithDateDiff = allCandidates
            .filter(c => c.season_air_date) // 只保留有开播日期的
            .map(c => ({
              candidate: c,
              dateDiff: calculateDateDiff(airDate, c.season_air_date)
            }))
            .sort((a, b) => a.dateDiff - b.dateDiff);

          console.log(`[TMDB] 找到 ${candidatesWithDateDiff.length} 个有开播日期的候选季，前3个:`);
          candidatesWithDateDiff.slice(0, 3).forEach((item, index) => {
            console.log(`  ${index + 1}. "${item.candidate.tv_name}" - ${item.candidate.season_name} (开播: ${item.candidate.season_air_date}), 日期差异: ${item.dateDiff}天`);
          });

          if (candidatesWithDateDiff.length > 0) {
            const best = candidatesWithDateDiff[0];
            console.log(`[TMDB] 根据开播日期匹配到: "${best.candidate.tv_name}" - ${best.candidate.season_name} (第${best.candidate.season_number}季), 日期差异: ${best.dateDiff}天`);
            result = best.candidate;
            detectedSeason = best.candidate.season_number;
          }
        }
      }

      // 如果没有提供日期或日期匹配失败，使用简化的降级匹配
      if (!result) {
        for (const t of titlesToTry) {
          // 先尝试带年份搜索
          if (year) {
            result = await searchByTitle(config, t, year, type, apiKey, language);
            if (result) {
              console.log(`[TMDB] 搜索 "${t}" (年份: ${year}) 找到: ${result.name || result.title} (ID: ${result.id})`);
              break;
            }
          }

          // 不带年份搜索
          result = await searchByTitle(config, t, '', type, apiKey, language);
          if (result) {
            console.log(`[TMDB] 搜索 "${t}" 找到: ${result.name || result.title} (ID: ${result.id})`);
            break;
          }
        }
      }
    }

    if (result) {
      const mediaId = result.id;

      let backdrop = getTMDBImageUrl(config, result.backdrop_path, 'w1280');
      let logo = null;
      let providers: any[] = [];
      let episodes: any[] = [];
      let seasons: any[] = [];
      let cast: any[] = [];

      // 对于电视剧，尝试获取对应季的背景图和Logo
      if (searchType === 'tv' && detectedSeason > 0) {
        try {
          const seasonImagesUrl = buildApiUrl(config, `/tv/${mediaId}/season/${detectedSeason}/images`, {
            api_key: apiKey
          });
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
          const seasonDetailUrl = buildApiUrl(config, `/tv/${mediaId}/season/${detectedSeason}`, {
            api_key: apiKey,
            language: language,
            append_to_response: 'images'
          });
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
                logo = getTMDBImageUrl(config, selectedLogo.file_path, 'w500');
                foundSeasonLogo = true;
                console.log(`[TMDB] 使用第${detectedSeason}季的Logo`);
              }
            }
          }
        }

        // 如果没有找到季的Logo，使用剧集的Logo
        if (!foundSeasonLogo) {
          const imagesUrl = buildApiUrl(config, `/${searchType}/${mediaId}/images`, {
            api_key: apiKey
          });
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
              logo = getTMDBImageUrl(config, selectedLogo.file_path, 'w500');
            }
          }
        }
      } catch (e) { /* ignore */ }

      // 如果需要详细信息，先获取完整的详情数据
      let detailData: any = null;
      if (includeDetails) {
        try {
          const detailUrl = buildApiUrl(config, `/${searchType}/${mediaId}`, {
            api_key: apiKey,
            language: language
          });
          const detailResponse = await fetch(detailUrl, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 3600 },
          });

          if (detailResponse.ok) {
            detailData = await detailResponse.json();
            // 使用详情数据更新 result，确保数据完整
            result = {
              ...result,
              overview: detailData.overview || result.overview,
              vote_average: detailData.vote_average ?? result.vote_average,
              vote_count: detailData.vote_count ?? result.vote_count,
              genres: detailData.genres || [],
            };

            // 对于电视剧，获取季数和播出平台
            if (searchType === 'tv') {
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
                logo: getTMDBImageUrl(config, n.logo_path, 'h60'),
              }));
            }
          }
        } catch (e) {
          console.error('[TMDB] 获取详情失败:', e);
        }

        // 获取演员列表
        try {
          // 电视剧使用aggregate_credits获取所有季的演员，电影使用credits
          const creditsEndpoint = searchType === 'tv' ? 'aggregate_credits' : 'credits';
          const creditsUrl = buildApiUrl(config, `/${searchType}/${mediaId}/${creditsEndpoint}`, {
            api_key: apiKey,
            language: language
          });
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
                photo: getTMDBImageUrl(config, c.profile_path, 'w300'),
              }));
            console.log(`[TMDB] 过滤后有头像的演员: ${cast.length} 个`);
          }
        } catch (e) {
          console.error('[TMDB] 获取演员列表失败:', e);
        }

        // 获取分集信息（仅电视剧）
        if (searchType === 'tv') {
          try {

            // 获取指定季的分集
            const seasonUrl = buildApiUrl(config, `/tv/${mediaId}/season/${season}`, {
              api_key: apiKey,
              language: language
            });
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
                stillPath: getTMDBImageUrl(config, ep.still_path, 'w400'),
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
        matched_season: detectedSeason, // 新增：返回实际匹配到的季号
        // 基本信息（优先使用详情数据，降级到搜索结果）
        overview: result.overview || '',
        vote_average: result.vote_average || 0,
        vote_count: result.vote_count || 0,
        first_air_date: result.first_air_date || result.release_date || '',
        genre_ids: result.genre_ids || [],
        genres: result.genres || [],
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
