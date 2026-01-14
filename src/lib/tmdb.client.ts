/* eslint-disable @typescript-eslint/no-explicit-any */

import { getConfig } from '@/lib/config';
import { TMDB_CACHE_EXPIRE, getCacheKey, getCache, setCache } from '@/lib/tmdb-cache';
import { DEFAULT_USER_AGENT } from '@/lib/user-agent';

// TMDB API 配置
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

// TMDB API 响应类型
interface TMDBPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
}

interface TMDBPersonSearchResponse {
  page: number;
  results: TMDBPerson[];
  total_pages: number;
  total_results: number;
}

interface TMDBMovieCredit {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  character?: string;
  job?: string;
}

interface TMDBTVCredit {
  id: number;
  name: string;
  poster_path: string | null;
  first_air_date: string;
  vote_average: number;
  character?: string;
  job?: string;
}

interface TMDBMovieCreditsResponse {
  id: number;
  cast: TMDBMovieCredit[];
  crew: TMDBMovieCredit[];
}

interface TMDBTVCreditsResponse {
  id: number;
  cast: TMDBTVCredit[];
  crew: TMDBTVCredit[];
}

// 统一的返回格式，兼容现有的 DoubanItem
export interface TMDBResult {
  code: number;
  message: string;
  list: Array<{
    id: string;
    title: string;
    poster: string;
    rate: string;
    year: string;
    popularity?: number;
    vote_count?: number;
    genre_ids?: number[];
    character?: string;
    episode_count?: number;
    original_language?: string;
  }>;
  total?: number;
  source: 'tmdb';
}

// TMDB筛选排序参数
export interface TMDBFilterOptions {
  // 时间筛选
  startYear?: number;
  endYear?: number;

  // 评分筛选
  minRating?: number;
  maxRating?: number;

  // 人气筛选
  minPopularity?: number;
  maxPopularity?: number;

  // 投票数筛选
  minVoteCount?: number;

  // 类型筛选（TMDB类型ID）
  genreIds?: number[];

  // 语言筛选
  languages?: string[];

  // 参演集数筛选（TV剧用）
  minEpisodeCount?: number;

  // 只显示有评分的
  onlyRated?: boolean;

  // 排序方式
  sortBy?: 'rating' | 'date' | 'popularity' | 'vote_count' | 'title' | 'episode_count';
  sortOrder?: 'asc' | 'desc';

  // 结果限制
  limit?: number;
}

/**
 * 检查是否有可用的TMDB API Key
 */
function hasTMDBApiKey(config: any): boolean {
  const hasMultiKeys = config.SiteConfig.TMDBApiKeys?.some((k: string) => k && k.trim());
  const hasSingleKey = !!config.SiteConfig.TMDBApiKey;
  return hasMultiKeys || hasSingleKey;
}

/**
 * 检查TMDB是否已配置并启用（用于演员搜索）
 */
export async function isTMDBEnabled(): Promise<boolean> {
  const config = await getConfig();
  return !!(config.SiteConfig.EnableTMDBActorSearch && hasTMDBApiKey(config));
}

/**
 * 检查轮播图是否启用（轮播图现在基于豆瓣数据，始终启用）
 * @deprecated 轮播图不再依赖TMDB，此函数保留仅为兼容性
 */
export async function isCarouselEnabled(): Promise<boolean> {
  return true;
}

// TMDB API Key 轮询索引（内存中维护）
let tmdbApiKeyIndex = 0;

/**
 * 获取下一个可用的TMDB API Key（轮询）
 */
function getNextTMDBApiKey(config: any): string {
  // 优先使用多Key配置
  const apiKeys = config.SiteConfig.TMDBApiKeys?.filter((k: string) => k && k.trim()) || [];

  // 如果有多个Key，使用轮询
  if (apiKeys.length > 0) {
    const key = apiKeys[tmdbApiKeyIndex % apiKeys.length];
    tmdbApiKeyIndex = (tmdbApiKeyIndex + 1) % apiKeys.length;
    console.log(`[TMDB API] 使用API Key #${(tmdbApiKeyIndex === 0 ? apiKeys.length : tmdbApiKeyIndex)}/${apiKeys.length}`);
    return key;
  }

  // 降级到单Key配置
  if (config.SiteConfig.TMDBApiKey) {
    return config.SiteConfig.TMDBApiKey;
  }

  throw new Error('TMDB API Key 未配置');
}

/**
 * 通过标题搜索电影（返回单个最佳匹配结果）
 */
export async function searchTMDBMovieByTitle(
  title: string,
  year?: string
): Promise<{ id: number; title: string; release_date: string; vote_average: number } | null> {
  try {
    // 检查缓存
    const cacheKey = getCacheKey('movie_search_by_title', { title: title.trim(), year: year || '' });
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`TMDB电影搜索缓存命中: ${title}`);
      return cached;
    }

    const params: Record<string, string> = {
      query: title.trim(),
    };
    if (year) {
      params.year = year;
    }

    const response = await fetchTMDB<any>('/search/movie', params);

    if (response.results && response.results.length > 0) {
      // 取第一个结果（最匹配的）
      const result = {
        id: response.results[0].id,
        title: response.results[0].title,
        release_date: response.results[0].release_date || '',
        vote_average: response.results[0].vote_average || 0,
      };

      // 保存到缓存
      await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.actor_search);
      console.log(`TMDB电影搜索成功: ${title} -> ID ${result.id}`);

      return result;
    }

    console.log(`TMDB电影搜索无结果: ${title}`);
    return null;
  } catch (error) {
    console.error(`搜索TMDB电影失败 (${title}):`, error);
    return null;
  }
}

/**
 * 通过标题搜索电视剧（返回单个最佳匹配结果）
 */
export async function searchTMDBTVByTitle(
  title: string,
  year?: string
): Promise<{ id: number; name: string; first_air_date: string; vote_average: number } | null> {
  try {
    // 检查缓存
    const cacheKey = getCacheKey('tv_search_by_title', { title: title.trim(), year: year || '' });
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`TMDB电视剧搜索缓存命中: ${title}`);
      return cached;
    }

    const params: Record<string, string> = {
      query: title.trim(),
    };
    if (year) {
      params.first_air_date_year = year;
    }

    const response = await fetchTMDB<any>('/search/tv', params);

    if (response.results && response.results.length > 0) {
      // 取第一个结果（最匹配的）
      const result = {
        id: response.results[0].id,
        name: response.results[0].name,
        first_air_date: response.results[0].first_air_date || '',
        vote_average: response.results[0].vote_average || 0,
      };

      // 保存到缓存
      await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.actor_search);
      console.log(`TMDB电视剧搜索成功: ${title} -> ID ${result.id}`);

      return result;
    }

    console.log(`TMDB电视剧搜索无结果: ${title}`);
    return null;
  } catch (error) {
    console.error(`搜索TMDB电视剧失败 (${title}):`, error);
    return null;
  }
}

/**
 * 调用TMDB API的通用函数
 */
async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const config = await getConfig();

  const apiKey = getNextTMDBApiKey(config);

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', apiKey);
  url.searchParams.append('language', config.SiteConfig.TMDBLanguage || 'zh-CN');

  // 添加其他参数
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  console.log(`[TMDB API] 请求: ${endpoint}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'User-Agent': DEFAULT_USER_AGENT,
    }
  });

  if (!response.ok) {
    throw new Error(`TMDB API错误: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * 搜索演员
 */
export async function searchTMDBPerson(query: string, page = 1): Promise<TMDBPersonSearchResponse> {
  // 检查缓存
  const cacheKey = getCacheKey('person_search', { query: query.trim(), page });
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log(`TMDB演员搜索缓存命中: ${query}`);
    return cached;
  }

  const result = await fetchTMDB<TMDBPersonSearchResponse>('/search/person', {
    query: query.trim(),
    page: page.toString()
  });

  // 保存到缓存
  await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.actor_search);
  console.log(`TMDB演员搜索已缓存: ${query}`);

  return result;
}

/**
 * 获取演员的电影作品
 */
export async function getTMDBPersonMovies(personId: number): Promise<TMDBMovieCreditsResponse> {
  // 检查缓存
  const cacheKey = getCacheKey('movie_credits', { personId });
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log(`TMDB演员电影作品缓存命中: ${personId}`);
    return cached;
  }

  const result = await fetchTMDB<TMDBMovieCreditsResponse>(`/person/${personId}/movie_credits`);

  // 保存到缓存
  await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.movie_credits);
  console.log(`TMDB演员电影作品已缓存: ${personId}`);

  return result;
}

/**
 * 获取演员的电视剧作品
 */
export async function getTMDBPersonTVShows(personId: number): Promise<TMDBTVCreditsResponse> {
  // 检查缓存
  const cacheKey = getCacheKey('tv_credits', { personId });
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log(`TMDB演员电视剧作品缓存命中: ${personId}`);
    return cached;
  }

  const result = await fetchTMDB<TMDBTVCreditsResponse>(`/person/${personId}/tv_credits`);

  // 保存到缓存
  await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.tv_credits);
  console.log(`TMDB演员电视剧作品已缓存: ${personId}`);

  return result;
}

/**
 * 获取电影详情（包含keywords和similar）
 */
export async function getTMDBMovieDetails(movieId: number): Promise<{
  id: number;
  title: string;
  original_title: string;
  overview: string;
  vote_average: number;
  vote_count: number;
  genres: Array<{ id: number; name: string }>;
  keywords: Array<{ id: number; name: string }>;
  similar: Array<{
    id: number;
    title: string;
    vote_average: number;
    release_date: string;
  }>;
} | null> {
  try {
    // 检查缓存
    const cacheKey = getCacheKey('movie_details', { movieId });
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`TMDB电影详情缓存命中: ${movieId}`);
      return cached;
    }

    // 并行获取详情、keywords、similar
    const [details, keywordsData, similarData] = await Promise.all([
      fetchTMDB(`/movie/${movieId}`, {}),
      fetchTMDB(`/movie/${movieId}/keywords`, {}),
      fetchTMDB(`/movie/${movieId}/similar`, {})
    ]);

    const result = {
      ...(details as any),
      keywords: (keywordsData as any).keywords || [],
      similar: ((similarData as any).results || []).slice(0, 5) // 只取前5个相似影片
    };

    // 保存到缓存
    await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.movie_details);
    console.log(`TMDB电影详情已缓存: ${movieId}`);

    return result;
  } catch (error) {
    console.error(`获取TMDB电影详情失败 (ID: ${movieId}):`, error);
    return null;
  }
}

/**
 * 获取电视剧详情（包含keywords和similar）
 */
export async function getTMDBTVDetails(tvId: number): Promise<{
  id: number;
  name: string;
  original_name: string;
  overview: string;
  vote_average: number;
  vote_count: number;
  genres: Array<{ id: number; name: string }>;
  keywords: Array<{ id: number; name: string }>;
  similar: Array<{
    id: number;
    name: string;
    vote_average: number;
    first_air_date: string;
  }>;
} | null> {
  try {
    // 检查缓存
    const cacheKey = getCacheKey('tv_details', { tvId });
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`TMDB电视剧详情缓存命中: ${tvId}`);
      return cached;
    }

    // 并行获取详情、keywords、similar
    const [details, keywordsData, similarData] = await Promise.all([
      fetchTMDB(`/tv/${tvId}`, {}),
      fetchTMDB(`/tv/${tvId}/keywords`, {}),
      fetchTMDB(`/tv/${tvId}/similar`, {})
    ]);

    const result = {
      ...(details as any),
      keywords: ((keywordsData as any).results || []),
      similar: ((similarData as any).results || []).slice(0, 5) // 只取前5个相似影片
    };

    // 保存到缓存
    await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.tv_details);
    console.log(`TMDB电视剧详情已缓存: ${tvId}`);

    return result;
  } catch (error) {
    console.error(`获取TMDB电视剧详情失败 (ID: ${tvId}):`, error);
    return null;
  }
}

/**
 * 按演员名字搜索相关作品（主要功能）
 */
export async function searchTMDBActorWorks(
  actorName: string,
  type: 'movie' | 'tv' = 'movie',
  filterOptions: TMDBFilterOptions = {}
): Promise<TMDBResult> {
  console.log(`🚀 [TMDB] searchTMDBActorWorks 开始执行: ${actorName}, type=${type}`);

  try {
    console.log(`🔍 [TMDB] 检查是否启用...`);
    // 检查是否启用
    if (!(await isTMDBEnabled())) {
      console.log(`❌ [TMDB] TMDB功能未启用`);
      return {
        code: 500,
        message: 'TMDB演员搜索功能未启用或API Key未配置',
        list: [],
        source: 'tmdb'
      } as TMDBResult;
    }

    console.log(`✅ [TMDB] TMDB功能已启用`);
    // 检查缓存 - 为整个搜索结果缓存
    const cacheKey = getCacheKey('actor_works', { actorName, type, ...filterOptions });
    console.log(`🔑 [TMDB] 缓存Key: ${cacheKey}`);

    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`✅ [TMDB] 缓存命中: ${actorName}/${type}`);
      return cached;
    }
    console.log(`❌ [TMDB] 缓存未命中，开始搜索...`);

    console.log(`[TMDB演员搜索] 搜索演员: ${actorName}, 类型: ${type}`);

    // 1. 先搜索演员
    const personSearch = await searchTMDBPerson(actorName);

    if (personSearch.results.length === 0) {
      const result: TMDBResult = {
        code: 200,
        message: '未找到相关演员',
        list: [],
        total: 0,
        source: 'tmdb'
      };
      // 缓存空结果，避免重复请求
      await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.actor_search);
      return result;
    }

    // 2. 优先选择名字完全匹配且有头像的演员，其次名字匹配，最后按人气排序
    const results = personSearch.results;
    const exactMatchWithPhoto = results.find(p => p.name === actorName && p.profile_path);
    const exactMatch = results.find(p => p.name === actorName);
    const withPhotoSorted = results.filter(p => p.profile_path).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const person = exactMatchWithPhoto || exactMatch || withPhotoSorted[0] || results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0];
    console.log(`[TMDB演员搜索] 找到演员: ${person.name} (ID: ${person.id})`);

    // 3. 获取该演员的作品
    let works: any[] = [];
    if (type === 'movie') {
      const movieCredits = await getTMDBPersonMovies(person.id);
      works = movieCredits.cast; // 主要关注演员作品，不是幕后工作
    } else {
      const tvCredits = await getTMDBPersonTVShows(person.id);
      works = tvCredits.cast;
    }

    // 4. 应用筛选条件
    let filteredWorks = works.filter((work: any) => {
      const releaseDate = work.release_date || work.first_air_date || '';
      const year = releaseDate ? new Date(releaseDate).getFullYear() : 0;
      const rating = work.vote_average || 0;
      const popularity = work.popularity || 0;
      const voteCount = work.vote_count || 0;
      const episodeCount = work.episode_count || 0;
      const language = work.original_language || '';
      const genreIds = work.genre_ids || [];

      // 时间筛选
      if (filterOptions.startYear && year && year < filterOptions.startYear) return false;
      if (filterOptions.endYear && year && year > filterOptions.endYear) return false;

      // 评分筛选
      if (filterOptions.minRating && rating < filterOptions.minRating) return false;
      if (filterOptions.maxRating && rating > filterOptions.maxRating) return false;

      // 人气筛选
      if (filterOptions.minPopularity && popularity < filterOptions.minPopularity) return false;
      if (filterOptions.maxPopularity && popularity > filterOptions.maxPopularity) return false;

      // 投票数筛选
      if (filterOptions.minVoteCount && voteCount < filterOptions.minVoteCount) return false;

      // 参演集数筛选（TV剧）
      if (filterOptions.minEpisodeCount && type === 'tv' && episodeCount < filterOptions.minEpisodeCount) return false;

      // 只显示有评分的
      if (filterOptions.onlyRated && rating === 0) return false;

      // 类型筛选
      if (filterOptions.genreIds && filterOptions.genreIds.length > 0) {
        const hasMatchingGenre = filterOptions.genreIds.some(id => genreIds.includes(id));
        if (!hasMatchingGenre) return false;
      }

      // 语言筛选
      if (filterOptions.languages && filterOptions.languages.length > 0) {
        if (!filterOptions.languages.includes(language)) return false;
      }

      return true;
    });

    // 5. 排序
    const sortBy = filterOptions.sortBy || 'date';
    const sortOrder = filterOptions.sortOrder || 'desc';
    const orderMultiplier = sortOrder === 'asc' ? -1 : 1;

    filteredWorks.sort((a: any, b: any) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'rating':
          compareValue = ((b.vote_average || 0) - (a.vote_average || 0)) * orderMultiplier;
          break;
        case 'date': {
          const dateA = new Date(a.release_date || a.first_air_date || '1900-01-01');
          const dateB = new Date(b.release_date || b.first_air_date || '1900-01-01');
          compareValue = (dateB.getTime() - dateA.getTime()) * orderMultiplier;
          break;
        }
        case 'popularity':
          compareValue = ((b.popularity || 0) - (a.popularity || 0)) * orderMultiplier;
          break;
        case 'vote_count':
          compareValue = ((b.vote_count || 0) - (a.vote_count || 0)) * orderMultiplier;
          break;
        case 'title': {
          const titleA = (a.title || a.name || '').toLowerCase();
          const titleB = (b.title || b.name || '').toLowerCase();
          compareValue = titleA.localeCompare(titleB) * orderMultiplier;
          break;
        }
        case 'episode_count':
          if (type === 'tv') {
            compareValue = ((b.episode_count || 0) - (a.episode_count || 0)) * orderMultiplier;
          }
          break;
      }

      // 如果主要排序字段相同，使用次要排序（评分 + 时间）
      if (compareValue === 0 && sortBy !== 'rating') {
        const ratingDiff = (b.vote_average || 0) - (a.vote_average || 0);
        if (ratingDiff !== 0) return ratingDiff;

        const dateA = new Date(a.release_date || a.first_air_date || '1900-01-01');
        const dateB = new Date(b.release_date || b.first_air_date || '1900-01-01');
        compareValue = dateB.getTime() - dateA.getTime();
      }

      return compareValue;
    });

    // 6. 应用结果限制
    if (filterOptions.limit && filterOptions.limit > 0) {
      filteredWorks = filteredWorks.slice(0, filterOptions.limit);
    }

    // 7. 转换为统一格式并去重
    const seenIds = new Set<string>();
    const list = filteredWorks
      .map((work: any) => {
        const releaseDate = work.release_date || work.first_air_date || '';
        const year = releaseDate ? new Date(releaseDate).getFullYear().toString() : '';

        return {
          id: work.id.toString(),
          title: work.title || work.name || '',
          poster: work.poster_path ? `${TMDB_IMAGE_BASE_URL}${work.poster_path}` : '',
          rate: work.vote_average ? work.vote_average.toFixed(1) : '',
          year: year,
          popularity: work.popularity,
          vote_count: work.vote_count,
          genre_ids: work.genre_ids,
          character: work.character,
          episode_count: work.episode_count,
          original_language: work.original_language
        };
      })
      .filter(work => {
        // 过滤掉没有标题的和重复的
        if (!work.title) return false;
        if (seenIds.has(work.id)) return false;
        seenIds.add(work.id);
        return true;
      });

    console.log(`[TMDB演员搜索] 筛选后找到 ${list.length} 个${type === 'movie' ? '电影' : '电视剧'}作品（原始: ${works.length}）`);

    const result: TMDBResult = {
      code: 200,
      message: '获取成功',
      list: list,
      total: list.length,
      source: 'tmdb'
    };

    // 保存到缓存
    await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.actor_search);
    console.log(`TMDB演员作品搜索已缓存: ${actorName}/${type}`);

    return result;

  } catch (error) {
    console.error(`[TMDB演员搜索] 搜索失败:`, error);
    return {
      code: 500,
      message: `搜索失败: ${(error as Error).message}`,
      list: [],
      source: 'tmdb'
    } as TMDBResult;
  }
}

// ============ 轮播图相关接口和函数 ============

// 电影搜索响应
interface TMDBMovieSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

// 电视剧搜索响应
interface TMDBTVSearchResponse {
  page: number;
  results: TMDBTVShow[];
  total_pages: number;
  total_results: number;
}

// 电影详情
interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
}

// 电视剧详情
interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
}

// 轮播图项目
export interface CarouselItem {
  id: number;
  title: string;
  overview: string;
  backdrop: string;
  poster: string;
  rate: number;
  year: string;
  type: 'movie' | 'tv';
}

/**
 * 获取TMDB热门电影
 */
export async function getTMDBTrendingMovies(): Promise<TMDBMovieSearchResponse> {
  const cacheKey = getCacheKey('trending_movies', {});
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log(`TMDB热门电影缓存命中 (${cached.results.length}条结果)`);
    return cached;
  }

  const result = await fetchTMDB<TMDBMovieSearchResponse>('/trending/movie/week');

  await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.actor_search);
  console.log(`TMDB热门电影已缓存 (${result.results.length}条结果)`);

  return result;
}

/**
 * 获取TMDB热门电视剧
 */
export async function getTMDBTrendingTV(): Promise<TMDBTVSearchResponse> {
  const cacheKey = getCacheKey('trending_tv', {});
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log(`TMDB热门电视剧缓存命中 (${cached.results.length}条结果)`);
    return cached;
  }

  const result = await fetchTMDB<TMDBTVSearchResponse>('/trending/tv/week');

  await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.actor_search);
  console.log(`TMDB热门电视剧已缓存 (${result.results.length}条结果)`);

  return result;
}

/**
 * 搜索电影
 */
export async function searchTMDBMovie(query: string, page = 1): Promise<TMDBMovieSearchResponse> {
  const cacheKey = getCacheKey('movie_search', { query: query.trim(), page });
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log(`TMDB电影搜索缓存命中: ${query} (${cached.results.length}条结果)`);
    return cached;
  }

  const result = await fetchTMDB<TMDBMovieSearchResponse>('/search/movie', {
    query: query.trim(),
    page: page.toString()
  });

  await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.actor_search);
  console.log(`TMDB电影搜索已缓存: ${query} (${result.results.length}条结果)`);

  return result;
}

/**
 * 搜索电视剧
 */
export async function searchTMDBTV(query: string, page = 1): Promise<TMDBTVSearchResponse> {
  const cacheKey = getCacheKey('tv_search', { query: query.trim(), page });
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log(`TMDB电视剧搜索缓存命中: ${query} (${cached.results.length}条结果)`);
    return cached;
  }

  const result = await fetchTMDB<TMDBTVSearchResponse>('/search/tv', {
    query: query.trim(),
    page: page.toString()
  });

  await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.actor_search);
  console.log(`TMDB电视剧搜索已缓存: ${query} (${result.results.length}条结果)`);

  return result;
}

/**
 * 生成搜索标题的多种变体，提高TMDB搜索命中率
 */
function generateTitleVariants(title: string): string[] {
  const variants: string[] = [];
  const trimmed = title.trim();
  variants.push(trimmed);

  // 去掉季数后缀
  const seasonPatterns = [
    /\s*第[0-9一二三四五六七八九十百]+季$/u,
    /\s*第[0-9一二三四五六七八九十百]+部$/u,
    /\s*第[0-9一二三四五六七八九十百]+期$/u,
    /\s*第[0-9一二三四五六七八九十百]+部分?$/u,
    /\s+S[0-9]+$/i,
    /\s+Season\s+[0-9]+$/i,
  ];
  let withoutSeason = trimmed;
  for (const pattern of seasonPatterns) {
    if (pattern.test(withoutSeason)) {
      withoutSeason = withoutSeason.replace(pattern, '').trim();
    }
  }
  if (withoutSeason !== trimmed && withoutSeason.length >= 2) {
    variants.push(withoutSeason);
  }

  // 去掉数字后缀
  const numberMatch = trimmed.match(/^(.+?)(\d+)$/);
  if (numberMatch && numberMatch[1].length >= 2) {
    const withoutNumber = numberMatch[1].trim();
    if (!variants.includes(withoutNumber)) variants.push(withoutNumber);
  }

  // 去掉"数字+冒号+副标题"
  const numberColonMatch = trimmed.match(/^(.+?)(\d+)[：:].+$/);
  if (numberColonMatch && numberColonMatch[1].length >= 2) {
    const mainTitle = numberColonMatch[1].trim();
    if (!variants.includes(mainTitle)) variants.push(mainTitle);
  }

  // 中文冒号变体
  if (trimmed.includes('：')) {
    const withSpace = trimmed.replace(/：/g, ' ');
    if (!variants.includes(withSpace)) variants.push(withSpace);
    const noColon = trimmed.replace(/：/g, '');
    if (!variants.includes(noColon)) variants.push(noColon);
    const englishColon = trimmed.replace(/：/g, ':');
    if (!variants.includes(englishColon)) variants.push(englishColon);
    const beforeColon = trimmed.split('：')[0].trim();
    if (beforeColon && beforeColon.length >= 2 && !variants.includes(beforeColon)) variants.push(beforeColon);
  }

  // 英文冒号变体
  if (trimmed.includes(':')) {
    const withSpace = trimmed.replace(/:/g, ' ');
    if (!variants.includes(withSpace)) variants.push(withSpace);
    const noColon = trimmed.replace(/:/g, '');
    if (!variants.includes(noColon)) variants.push(noColon);
    const beforeColon = trimmed.split(':')[0].trim();
    if (beforeColon && beforeColon.length >= 2 && !variants.includes(beforeColon)) variants.push(beforeColon);
  }

  // 去掉"之XXX"后缀
  const suffixMatch = trimmed.match(/^(.+?)之.+$/);
  if (suffixMatch && suffixMatch[1].length >= 2) {
    const mainTitle = suffixMatch[1].trim();
    if (!variants.includes(mainTitle)) variants.push(mainTitle);
  }

  // 去掉中间点后的内容
  const dotMatch = trimmed.match(/^(.+?)[].+$/);
  if (dotMatch && dotMatch[1].length >= 2) {
    const mainTitle = dotMatch[1].trim();
    if (!variants.includes(mainTitle)) variants.push(mainTitle);
  }

  // 去掉语言版本后缀
  const langMatch = trimmed.match(/^(.+?)\s*(国语版|粤语版|日语版|英语版|中文版|原声版|配音版)$/);
  if (langMatch && langMatch[1].length >= 2) {
    const mainTitle = langMatch[1].trim();
    if (!variants.includes(mainTitle)) variants.push(mainTitle);
  }

  // 去掉括号内的语言/版本标记
  const bracketLangMatch = trimmed.match(/^(.+?)[（(](粤|国|国语|粤语|日语|英语|中文|原声|配音|港版|台版|美版)[）)]$/);
  if (bracketLangMatch && bracketLangMatch[1].length >= 2) {
    const mainTitle = bracketLangMatch[1].trim();
    if (!variants.includes(mainTitle)) variants.push(mainTitle);
  }

  // 去掉末尾的括号内容
  const bracketMatch = trimmed.match(/^(.+?)[（(][^）)]+[）)]$/);
  if (bracketMatch && bracketMatch[1].length >= 2) {
    const bracketContent = trimmed.slice(bracketMatch[1].length);
    if (bracketContent.length <= 6) {
      const mainTitle = bracketMatch[1].trim();
      if (!variants.includes(mainTitle)) variants.push(mainTitle);
    }
  }

  // 空格变体
  if (trimmed.includes(' ')) {
    const noSpaces = trimmed.replace(/\s+/g, '');
    if (!variants.includes(noSpaces)) variants.push(noSpaces);
    const withChineseColon = trimmed.replace(/\s+/g, '：');
    if (!variants.includes(withChineseColon)) variants.push(withChineseColon);
    const withEnglishColon = trimmed.replace(/\s+/g, ':');
    if (!variants.includes(withEnglishColon)) variants.push(withEnglishColon);
  }

  // 去除所有标点符号的变体
  const noPunctuation = trimmed.replace(/[：；，。！？、""''（）【】《》:;,.!?"'()[\]<>\s]/g, '');
  if (noPunctuation !== trimmed && noPunctuation.length >= 2 && !variants.includes(noPunctuation)) {
    variants.push(noPunctuation);
  }

  return variants;
}
// TMDB Find API 响应类型
interface TMDBFindResponse {
  movie_results: TMDBMovie[];
  tv_results: TMDBTVShow[];
}

/**
 * 通过 IMDB ID 在 TMDB 查找影视作品
 */
export async function findByIMDBId(imdbId: string): Promise<TMDBFindResponse> {
  const cacheKey = getCacheKey('find_imdb', { imdbId });
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log(`[TMDB] IMDB查找缓存命中: ${imdbId}`);
    return cached;
  }

  const result = await fetchTMDB<TMDBFindResponse>(`/find/${imdbId}`, {
    external_source: 'imdb_id'
  });

  await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.actor_search);
  console.log(`[TMDB] IMDB查找已缓存: ${imdbId} (电影:${result.movie_results.length}, 电视剧:${result.tv_results.length})`);

  return result;
}

/**
 * 通过 IMDB ID 获取 TMDB 轮播图数据（精确匹配）
 */
export async function getCarouselItemByIMDB(
  imdbId: string,
  type: 'movie' | 'tv'
): Promise<CarouselItem | null> {
  try {
    console.log(`[TMDB轮播] 🎯 通过IMDB精确查找: ${imdbId} (${type})`);

    const findResult = await findByIMDBId(imdbId);

    let searchResult: TMDBMovie | TMDBTVShow | null = null;

    if (type === 'movie' && findResult.movie_results.length > 0) {
      searchResult = findResult.movie_results[0];
      console.log(`[TMDB轮播] ✅ IMDB匹配成功: ${(searchResult as TMDBMovie).title}`);
    } else if (type === 'tv' && findResult.tv_results.length > 0) {
      searchResult = findResult.tv_results[0];
      console.log(`[TMDB轮播] ✅ IMDB匹配成功: ${(searchResult as TMDBTVShow).name}`);
    }

    if (!searchResult) {
      console.warn(`[TMDB轮播] ❌ IMDB未找到匹配: ${imdbId} (${type})`);
      return null;
    }

    const carouselItem: CarouselItem = {
      id: searchResult.id,
      title: type === 'movie' ? (searchResult as TMDBMovie).title : (searchResult as TMDBTVShow).name,
      overview: searchResult.overview || '',
      backdrop: searchResult.backdrop_path ? `${TMDB_BACKDROP_BASE_URL}${searchResult.backdrop_path}` : '',
      poster: searchResult.poster_path ? `${TMDB_IMAGE_BASE_URL}${searchResult.poster_path}` : '',
      rate: searchResult.vote_average || 0,
      year: type === 'movie'
        ? ((searchResult as TMDBMovie).release_date?.split('-')[0] || '')
        : ((searchResult as TMDBTVShow).first_air_date?.split('-')[0] || ''),
      type,
    };

    console.log(`[TMDB轮播] 📸 IMDB匹配海报: backdrop=${!!carouselItem.backdrop}, poster=${!!carouselItem.poster}`);

    return carouselItem;
  } catch (error) {
    console.error(`[TMDB轮播] IMDB查找失败: ${imdbId}`, error);
    return null;
  }
}

/**
 * 通过豆瓣电影/电视剧名称获取TMDB轮播图数据（标题搜索，作为降级方案）
 */
export async function getCarouselItemByTitle(
  title: string,
  type: 'movie' | 'tv'
): Promise<CarouselItem | null> {
  try {
    console.log(`[TMDB轮播] 🔍 标题搜索 ${type}: "${title}"`);

    // 生成搜索变体
    const titleVariants = generateTitleVariants(title);
    console.log(`[TMDB轮播] 生成 ${titleVariants.length} 个搜索变体:`, titleVariants.slice(0, 5));

    // 1. 搜索电影或电视剧
    let searchResult: TMDBMovie | TMDBTVShow | null = null;
    let mediaId = 0;

    if (type === 'movie') {
      // 尝试所有变体直到找到结果
      for (const variant of titleVariants) {
        const movieSearch = await searchTMDBMovie(variant);
        console.log(`[TMDB轮播] 电影变体 "${variant}" 搜索结果: ${movieSearch.results.length}个匹配`);
        if (movieSearch.results.length > 0) {
          // 优先选择有海报的结果
          searchResult = movieSearch.results.find(r => r.backdrop_path || r.poster_path) || movieSearch.results[0];
          mediaId = searchResult.id;
          const selectedIndex = movieSearch.results.indexOf(searchResult);
          console.log(`[TMDB轮播] ✅ 选择第${selectedIndex + 1}个: ${searchResult.title} (ID: ${mediaId}, 有海报: ${!!(searchResult.backdrop_path || searchResult.poster_path)})`);
          break;
        }
      }
    } else {
      // 尝试所有变体直到找到结果
      for (const variant of titleVariants) {
        const tvSearch = await searchTMDBTV(variant);
        console.log(`[TMDB轮播] 电视剧变体 "${variant}" 搜索结果: ${tvSearch.results.length}个匹配`);
        if (tvSearch.results.length > 0) {
          // 优先选择有海报的结果
          searchResult = tvSearch.results.find(r => r.backdrop_path || r.poster_path) || tvSearch.results[0];
          mediaId = searchResult.id;
          const selectedIndex = tvSearch.results.indexOf(searchResult);
          console.log(`[TMDB轮播] ✅ 选择第${selectedIndex + 1}个: ${searchResult.name} (ID: ${mediaId}, 有海报: ${!!(searchResult.backdrop_path || searchResult.poster_path)})`);
          break;
        }
      }
    }

    if (!searchResult) {
      console.warn(`[TMDB轮播] ❌ 未找到匹配: "${title}" (${type})`);
      return null;
    }

    // 2. 构建轮播图项（移除预告片获取，提升性能）
    const carouselItem: CarouselItem = {
      id: searchResult.id,
      title: type === 'movie' ? (searchResult as TMDBMovie).title : (searchResult as TMDBTVShow).name,
      overview: searchResult.overview || '',
      backdrop: searchResult.backdrop_path ? `${TMDB_BACKDROP_BASE_URL}${searchResult.backdrop_path}` : '',
      poster: searchResult.poster_path ? `${TMDB_IMAGE_BASE_URL}${searchResult.poster_path}` : '',
      rate: searchResult.vote_average || 0,
      year: type === 'movie'
        ? ((searchResult as TMDBMovie).release_date?.split('-')[0] || '')
        : ((searchResult as TMDBTVShow).first_air_date?.split('-')[0] || ''),
      type,
    };

    console.log(`[TMDB轮播] 📸 海报情况: backdrop=${!!carouselItem.backdrop}, poster=${!!carouselItem.poster}`);

    if (!carouselItem.backdrop && !carouselItem.poster) {
      console.warn(`[TMDB轮播] ⚠️  ${title} 缺少所有海报，将被过滤`);
    } else if (!carouselItem.backdrop) {
      console.log(`[TMDB轮播] ℹ️  ${title} 使用竖版海报代替横屏`);
    }

    return carouselItem;
  } catch (error) {
    console.error(`[TMDB轮播] 处理失败: ${title}`, error);
    return null;
  }
}