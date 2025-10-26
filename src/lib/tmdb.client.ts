/* eslint-disable @typescript-eslint/no-explicit-any */

import { getConfig } from '@/lib/config';
import { TMDB_CACHE_EXPIRE, getCacheKey, getCache, setCache } from '@/lib/tmdb-cache';

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
 * 检查TMDB是否已配置并启用（用于演员搜索）
 */
export async function isTMDBEnabled(): Promise<boolean> {
  const config = await getConfig();
  return !!(config.SiteConfig.EnableTMDBActorSearch && config.SiteConfig.TMDBApiKey);
}

/**
 * 检查轮播图是否启用
 */
export async function isCarouselEnabled(): Promise<boolean> {
  const config = await getConfig();
  return !!(config.SiteConfig.EnableTMDBCarousel && config.SiteConfig.TMDBApiKey);
}

/**
 * 调用TMDB API的通用函数
 */
async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const config = await getConfig();

  if (!config.SiteConfig.TMDBApiKey) {
    throw new Error('TMDB API Key 未配置');
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', config.SiteConfig.TMDBApiKey);
  url.searchParams.append('language', config.SiteConfig.TMDBLanguage || 'zh-CN');

  // 添加其他参数
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  console.log(`[TMDB API] 请求: ${endpoint}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

    // 2. 取最知名的演员（按人气排序）
    const person = personSearch.results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0];
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

    // 7. 转换为统一格式
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
      .filter(work => work.title); // 过滤掉没有标题的

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

// 视频信息
interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  size: number;
  type: string;
  official: boolean;
  published_at: string;
}

// 视频列表响应
interface TMDBVideosResponse {
  id: number;
  results: TMDBVideo[];
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
  trailerKey?: string; // YouTube视频key
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
 * 获取电影预告片
 */
export async function getTMDBMovieVideos(movieId: number): Promise<TMDBVideosResponse> {
  const cacheKey = getCacheKey('movie_videos', { movieId });
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log(`TMDB电影视频缓存命中: ${movieId}`);
    return cached;
  }

  const result = await fetchTMDB<TMDBVideosResponse>(`/movie/${movieId}/videos`);

  await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.movie_credits);
  console.log(`TMDB电影视频已缓存: ${movieId}`);

  return result;
}

/**
 * 获取电视剧预告片
 */
export async function getTMDBTVVideos(tvId: number): Promise<TMDBVideosResponse> {
  const cacheKey = getCacheKey('tv_videos', { tvId });
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log(`TMDB电视剧视频缓存命中: ${tvId}`);
    return cached;
  }

  const result = await fetchTMDB<TMDBVideosResponse>(`/tv/${tvId}/videos`);

  await setCache(cacheKey, result, TMDB_CACHE_EXPIRE.tv_credits);
  console.log(`TMDB电视剧视频已缓存: ${tvId}`);

  return result;
}

/**
 * 通过豆瓣电影/电视剧名称获取TMDB轮播图数据
 */
export async function getCarouselItemByTitle(
  title: string,
  type: 'movie' | 'tv'
): Promise<CarouselItem | null> {
  try {
    console.log(`[TMDB轮播] 🔍 开始搜索 ${type}: "${title}"`);

    // 1. 搜索电影或电视剧
    let searchResult: TMDBMovie | TMDBTVShow | null = null;
    let mediaId = 0;

    if (type === 'movie') {
      const movieSearch = await searchTMDBMovie(title);
      console.log(`[TMDB轮播] "${title}" 搜索结果: ${movieSearch.results.length}个匹配`);
      if (movieSearch.results.length > 0) {
        searchResult = movieSearch.results[0];
        mediaId = searchResult.id;
        console.log(`[TMDB轮播] ✅ 选择第1个: ${searchResult.title} (ID: ${mediaId})`);
      }
    } else {
      const tvSearch = await searchTMDBTV(title);
      console.log(`[TMDB轮播] "${title}" 搜索结果: ${tvSearch.results.length}个匹配`);
      if (tvSearch.results.length > 0) {
        searchResult = tvSearch.results[0];
        mediaId = searchResult.id;
        console.log(`[TMDB轮播] ✅ 选择第1个: ${searchResult.name} (ID: ${mediaId})`);
      }
    }

    if (!searchResult) {
      console.warn(`[TMDB轮播] ❌ 未找到匹配: "${title}" (${type})`);
      return null;
    }

    // 2. 获取预告片
    let trailerKey: string | undefined;
    try {
      const videos = type === 'movie' 
        ? await getTMDBMovieVideos(mediaId)
        : await getTMDBTVVideos(mediaId);

      // 优先选择官方预告片(Trailer)，其次是Teaser
      const trailer = videos.results.find(
        v => v.site === 'YouTube' && v.type === 'Trailer' && v.official
      ) || videos.results.find(
        v => v.site === 'YouTube' && v.type === 'Trailer'
      ) || videos.results.find(
        v => v.site === 'YouTube' && v.type === 'Teaser'
      );

      if (trailer) {
        trailerKey = trailer.key;
        console.log(`[TMDB轮播] 找到预告片: ${title} - ${trailerKey}`);
      }
    } catch (error) {
      console.warn(`[TMDB轮播] 获取预告片失败: ${title}`, error);
    }

    // 3. 构建轮播图项
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
      trailerKey
    };

    console.log(`[TMDB轮播] 📸 海报情况: backdrop=${!!carouselItem.backdrop}, poster=${!!carouselItem.poster}, trailer=${!!carouselItem.trailerKey}`);
    
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