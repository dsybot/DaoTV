/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { ArrowLeft, Heart, Play, ExternalLink, ChevronDown, Check } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, useRef } from 'react';

import {
  deleteFavorite,
  generateStorageKey,
  isFavorited,
  saveFavorite,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanDetails } from '@/lib/douban.client';
import { processImageUrl } from '@/lib/utils';

import CastPhotos from '@/components/CastPhotos';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import PageLayout from '@/components/PageLayout';

interface TMDBProvider {
  id: number;
  name: string;
  logo: string | null;
}

interface TMDBEpisode {
  episodeNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  airDate: string;
  runtime: number;
}

interface TMDBSeason {
  seasonNumber: number;
  name: string;
  episodeCount: number;
}

interface TMDBCast {
  id: number;
  name: string;
  character: string;
  photo: string | null;
}

interface TMDBData {
  backdrop: string | null;
  logo: string | null;
  providers: TMDBProvider[];
  episodes: TMDBEpisode[];
  seasons: TMDBSeason[];
  cast: TMDBCast[];
}

// 季数选择器组件
function SeasonSelector({
  seasons,
  currentSeason,
  onChange,
}: {
  seasons: TMDBSeason[];
  currentSeason: number;
  onChange: (season: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSeason = seasons.find((s) => s.seasonNumber === currentSeason);

  return (
    <div className="relative ml-auto" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span>{selectedSeason?.name || `第${currentSeason}季`}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 min-w-[140px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden animate-scaleIn">
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {seasons.map((s) => (
              <button
                key={s.seasonNumber}
                type="button"
                onClick={() => {
                  onChange(s.seasonNumber);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-all duration-150 ${s.seasonNumber === currentSeason
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20'
                  }`}
              >
                <div className="flex items-center gap-2">
                  {s.seasonNumber === currentSeason && <Check className="w-4 h-4 flex-shrink-0" />}
                  <span className={s.seasonNumber === currentSeason ? '' : 'ml-6'}>{s.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// TMDB背景图、Logo和详情获取
async function getTMDBData(title: string, year: string, type: string, season: number = 1, imdbId?: string): Promise<TMDBData> {
  try {
    const imdbParam = imdbId ? `&imdb_id=${imdbId}` : '';
    const response = await fetch(`/api/tmdb/backdrop?title=${encodeURIComponent(title)}&year=${year}&type=${type}&season=${season}&details=true${imdbParam}`);
    if (response.ok) {
      const data = await response.json();
      return {
        backdrop: data.backdrop || null,
        logo: data.logo || null,
        providers: data.providers || [],
        episodes: data.episodes || [],
        seasons: data.seasons || [],
        cast: data.cast || [],
      };
    }
  } catch (error) {
    console.error('获取TMDB数据失败:', error);
  }
  return { backdrop: null, logo: null, providers: [], episodes: [], seasons: [], cast: [] };
}

function DetailPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 从URL参数获取基本信息
  const title = searchParams.get('title') || '';
  const year = searchParams.get('year') || '';
  const poster = searchParams.get('poster') || '';
  const source = searchParams.get('source') || '';
  const id = searchParams.get('id') || '';
  const doubanId = parseInt(searchParams.get('douban_id') || '0') || 0;
  const stype = searchParams.get('stype') || '';
  const stitle = searchParams.get('stitle') || '';

  // 状态
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [providers, setProviders] = useState<TMDBProvider[]>([]);
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([]);
  const [seasons, setSeasons] = useState<TMDBSeason[]>([]);
  const [tmdbCast, setTmdbCast] = useState<TMDBCast[]>([]);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [episodePage, setEpisodePage] = useState(0);
  const [movieDetails, setMovieDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tmdbLoading, setTmdbLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // 获取豆瓣详情
  useEffect(() => {
    const fetchDetails = async () => {
      if (doubanId && doubanId > 0) {
        try {
          const response = await getDoubanDetails(doubanId.toString());
          if (response.code === 200 && response.data) {
            setMovieDetails(response.data);
          }
        } catch (error) {
          console.error('获取豆瓣详情失败:', error);
        }
      }
      setLoading(false);
    };
    fetchDetails();
  }, [doubanId]);

  // 获取TMDB数据（等待豆瓣详情获取IMDb ID后再请求）
  useEffect(() => {
    const fetchData = async () => {
      if (title) {
        setTmdbLoading(true);
        const imdbId = movieDetails?.imdb_id;
        const data = await getTMDBData(title, year, stype || 'tv', currentSeason, imdbId);
        setBackdrop(data.backdrop);
        setLogo(data.logo);
        setProviders(data.providers);
        setEpisodes(data.episodes);
        setSeasons(data.seasons);
        setTmdbCast(data.cast);
        setTmdbLoading(false);
      }
    };
    fetchData();
  }, [title, year, stype, currentSeason, movieDetails?.imdb_id]);

  // 检查收藏状态
  useEffect(() => {
    const checkFavorite = async () => {
      if (source && id) {
        try {
          const fav = await isFavorited(source, id);
          setFavorited(fav);
        } catch (error) {
          console.error('检查收藏状态失败:', error);
        }
      }
    };
    checkFavorite();

    if (source && id) {
      const storageKey = generateStorageKey(source, id);
      const unsubscribe = subscribeToDataUpdates(
        'favoritesUpdated',
        (newFavorites: Record<string, any>) => {
          const isNowFavorited = !!newFavorites[storageKey];
          setFavorited(isNowFavorited);
        }
      );
      return unsubscribe;
    }
  }, [source, id]);

  // 切换收藏
  const handleToggleFavorite = useCallback(async () => {
    if (!source || !id) return;
    try {
      if (favorited) {
        await deleteFavorite(source, id);
        setFavorited(false);
      } else {
        await saveFavorite(source, id, {
          title: title,
          source_name: source,
          year: year,
          cover: poster,
          total_episodes: movieDetails?.episodes || 1,
          save_time: Date.now(),
          search_title: stitle || title,
        });
        setFavorited(true);
      }
    } catch (error) {
      console.error('切换收藏状态失败:', error);
    }
  }, [favorited, source, id, title, year, poster, movieDetails, stitle]);

  // 跳转到播放页
  const handlePlay = useCallback(() => {
    const doubanIdParam = doubanId > 0 ? `&douban_id=${doubanId}` : '';
    const stypeParam = stype ? `&stype=${stype}` : '';
    const stitleParam = stitle ? `&stitle=${encodeURIComponent(stitle)}` : '';

    if (source && id) {
      const url = `/play?source=${source}&id=${id}&title=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}${doubanIdParam}${stypeParam}${stitleParam}`;
      router.push(url);
    } else {
      const url = `/play?title=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}${doubanIdParam}${stypeParam}${stitleParam}&prefer=true`;
      router.push(url);
    }
  }, [router, source, id, title, year, doubanId, stype, stitle]);

  // 跳转到豆瓣
  const handleOpenDouban = useCallback(() => {
    if (doubanId > 0) {
      window.open(`https://movie.douban.com/subject/${doubanId}`, '_blank', 'noopener,noreferrer');
    }
  }, [doubanId]);

  const displayPoster = movieDetails?.cover || poster;
  const rate = movieDetails?.rate || '';
  const firstAired = movieDetails?.first_aired || '';
  const genres = movieDetails?.genres || [];
  const description = movieDetails?.plot_summary || '';
  const cast = movieDetails?.cast || [];

  return (
    <PageLayout>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 -mt-12 md:-mt-24">
        {/* 背景图区域 - 至少填满视口高度 */}
        <div className="relative w-full min-h-screen overflow-hidden">
          {/* 背景图 - 手机端用豆瓣海报，桌面端用TMDB横版背景 */}
          {/* 手机端背景（豆瓣海报） */}
          {displayPoster && (
            <img
              src={processImageUrl(displayPoster)}
              alt={title}
              className="md:hidden absolute inset-0 w-full h-full object-cover object-top blur-sm scale-105"
            />
          )}
          {/* 桌面端背景（TMDB横版） */}
          {backdrop ? (
            <img src={backdrop} alt={title} className="hidden md:block absolute inset-0 w-full h-full object-cover object-center" />
          ) : displayPoster ? (
            <img src={processImageUrl(displayPoster)} alt={title} className="hidden md:block absolute inset-0 w-full h-full object-cover object-center blur-xl scale-110" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
          )}
          {/* 手机端无海报时的默认背景 */}
          {!displayPoster && (
            <div className="md:hidden absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
          )}
          {/* 渐变遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          {/* 底部渐变虚化 - 过渡到下方内容区域 */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-100 dark:from-gray-900 to-transparent" />

          {/* 返回按钮 */}
          <button
            onClick={() => router.back()}
            className="absolute top-16 md:top-28 left-4 z-20 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* 内容区域 - 底部对齐 */}
          <div className="absolute bottom-8 left-0 right-0 px-4 sm:px-6 md:px-8 lg:px-12">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-end">
                {/* 左侧：封面卡片和按钮 */}
                <div className="flex-shrink-0 w-36 sm:w-44 md:w-52 mx-auto md:mx-0">
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl bg-gray-800 ring-1 ring-white/10">
                    {!imageLoaded && <ImagePlaceholder aspectRatio="aspect-[2/3]" />}
                    {displayPoster && (
                      <Image
                        src={processImageUrl(displayPoster)}
                        alt={title}
                        fill
                        className={`object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => setImageLoaded(true)}
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  {/* 按钮组 */}
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      onClick={handlePlay}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>播放</span>
                    </button>
                    <div className="flex gap-2">
                      {doubanId > 0 && (
                        <button
                          onClick={handleOpenDouban}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>豆瓣</span>
                        </button>
                      )}
                      {source && id && (
                        <button
                          onClick={handleToggleFavorite}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-all ${favorited ? 'bg-red-500/20 text-red-400' : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${favorited ? 'fill-current' : ''}`} />
                          <span>{favorited ? '已收藏' : '收藏'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 右侧：详情信息 */}
                <div className="flex-1 w-full text-white pb-2">
                  {/* 标题 - 优先使用Logo图片，水平居中 */}
                  <div className="flex justify-center items-center mb-4 min-h-[6rem] sm:min-h-[8rem] md:min-h-[10rem]">
                    {logo ? (
                      <img
                        src={logo}
                        alt={title}
                        className="h-24 sm:h-32 md:h-40 max-w-full object-contain drop-shadow-2xl"
                      />
                    ) : (
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold drop-shadow-lg text-center">{title}</h1>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3 mb-3 text-sm">
                    {firstAired && <span className="text-gray-300">{firstAired}</span>}
                    {stype && (
                      <span className="px-2 py-0.5 bg-blue-500/80 text-white text-xs rounded">
                        {stype === 'movie' ? '电影' : '电视剧'}
                      </span>
                    )}
                    {genres.length > 0 && <span className="text-gray-300">{genres.slice(0, 3).join(' · ')}</span>}
                    {rate && rate !== '0' && parseFloat(rate) > 0 && (
                      <span className="px-2 py-0.5 bg-green-500/80 text-white text-xs rounded font-semibold">{rate}</span>
                    )}
                  </div>
                  {description && (
                    <p className="text-gray-300 text-sm leading-relaxed line-clamp-4 text-center md:text-left">{description}</p>
                  )}
                  {loading && (
                    <div className="flex items-center justify-center md:justify-start gap-2 text-gray-400 text-sm mt-2">
                      <div className="w-3 h-3 border-2 border-gray-500 border-t-blue-400 rounded-full animate-spin" />
                      <span>加载详情中...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 下方扩展区域 */}
        <div className="bg-gray-100 dark:bg-gray-900 px-4 sm:px-6 md:px-8 lg:px-12 py-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* 播出平台 */}
            {providers.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {providers.map((provider) =>
                  provider.logo ? (
                    <img
                      key={provider.id}
                      src={provider.logo}
                      alt={provider.name}
                      className="h-10 object-contain"
                    />
                  ) : null
                )}
              </div>
            )}

            {/* 剧集列表（仅电视剧） */}
            {stype !== 'movie' && episodes.length > 0 && (
              <div>
                <div className="flex items-center gap-4 mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">剧集列表</h2>
                  {/* 分页切换 */}
                  <div className="flex items-center gap-1 text-sm">
                    {Array.from({ length: Math.ceil(episodes.length / 20) }, (_, i) => {
                      const start = i * 20 + 1;
                      const end = Math.min((i + 1) * 20, episodes.length);
                      return (
                        <button
                          key={i}
                          onClick={() => setEpisodePage(i)}
                          className={`px-2 py-1 rounded transition-colors ${episodePage === i
                            ? 'text-gray-900 dark:text-white font-semibold'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                          {start}-{end}
                        </button>
                      );
                    })}
                  </div>
                  {seasons.length > 1 && (
                    <SeasonSelector
                      seasons={seasons}
                      currentSeason={currentSeason}
                      onChange={(season) => {
                        setCurrentSeason(season);
                        setEpisodePage(0);
                      }}
                    />
                  )}
                </div>
                {tmdbLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                    <span>加载剧集信息...</span>
                  </div>
                ) : (
                  <div className="episode-list overflow-x-auto pb-2">
                    <div className="flex gap-3" style={{ width: 'max-content' }}>
                      {episodes.slice(episodePage * 20, (episodePage + 1) * 20).map((ep) => (
                        <div
                          key={ep.episodeNumber}
                          className="group cursor-pointer flex-shrink-0 w-40 sm:w-44"
                          onClick={() => {
                            const doubanIdParam = doubanId > 0 ? `&douban_id=${doubanId}` : '';
                            const stypeParam = stype ? `&stype=${stype}` : '';
                            const stitleParam = stitle ? `&stitle=${encodeURIComponent(stitle)}` : '';
                            const episodeParam = `&episode=${ep.episodeNumber}`;
                            if (source && id) {
                              router.push(`/play?source=${source}&id=${id}&title=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}${doubanIdParam}${stypeParam}${stitleParam}${episodeParam}`);
                            } else {
                              router.push(`/play?title=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}${doubanIdParam}${stypeParam}${stitleParam}&prefer=true${episodeParam}`);
                            }
                          }}
                        >
                          <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                            {ep.stillPath ? (
                              <img src={ep.stillPath} alt={ep.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center">
                                <span className="text-lg font-bold text-gray-400 dark:text-gray-500">E{ep.episodeNumber}</span>
                              </div>
                            )}
                            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-green-500 text-white text-xs font-medium rounded">
                              第 {ep.episodeNumber} 集
                            </div>
                            {/* 播放按钮悬浮 */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                                <Play className="w-5 h-5 text-gray-900 fill-current ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                            {ep.name || `第${ep.episodeNumber}集`}
                          </h3>
                          {ep.overview && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{ep.overview}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 主演照片和作品 */}
            {tmdbCast.length > 0 && (
              <CastPhotos tmdbCast={tmdbCast} />
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function DetailPage() {
  return (
    <Suspense fallback={
      <PageLayout>
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-gray-500">加载中...</div>
        </div>
      </PageLayout>
    }>
      <DetailPageClient />
    </Suspense>
  );
}
