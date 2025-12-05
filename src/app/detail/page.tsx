/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { ArrowLeft, Heart, Play, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import {
  deleteFavorite,
  generateStorageKey,
  isFavorited,
  saveFavorite,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanDetails } from '@/lib/douban.client';
import { processImageUrl } from '@/lib/utils';

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

interface TMDBData {
  backdrop: string | null;
  logo: string | null;
  providers: TMDBProvider[];
  episodes: TMDBEpisode[];
  seasons: TMDBSeason[];
}

// TMDB背景图、Logo和详情获取
async function getTMDBData(title: string, year: string, type: string, season: number = 1): Promise<TMDBData> {
  try {
    const response = await fetch(`/api/tmdb/backdrop?title=${encodeURIComponent(title)}&year=${year}&type=${type}&season=${season}&details=true`);
    if (response.ok) {
      const data = await response.json();
      return {
        backdrop: data.backdrop || null,
        logo: data.logo || null,
        providers: data.providers || [],
        episodes: data.episodes || [],
        seasons: data.seasons || [],
      };
    }
  } catch (error) {
    console.error('获取TMDB数据失败:', error);
  }
  return { backdrop: null, logo: null, providers: [], episodes: [], seasons: [] };
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
  const [currentSeason, setCurrentSeason] = useState(1);
  const [movieDetails, setMovieDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tmdbLoading, setTmdbLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // 获取TMDB数据
  useEffect(() => {
    const fetchData = async () => {
      if (title) {
        setTmdbLoading(true);
        const data = await getTMDBData(title, year, stype || 'tv', currentSeason);
        setBackdrop(data.backdrop);
        setLogo(data.logo);
        setProviders(data.providers);
        setEpisodes(data.episodes);
        setSeasons(data.seasons);
        setTmdbLoading(false);
      }
    };
    fetchData();
  }, [title, year, stype, currentSeason]);

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

  return (
    <PageLayout>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 -mt-12 md:-mt-24">
        {/* 背景图区域 - 至少填满视口高度 */}
        <div className="relative w-full min-h-screen overflow-hidden">
          {/* 背景图 */}
          {backdrop ? (
            <img src={backdrop} alt={title} className="absolute inset-0 w-full h-full object-cover object-top" />
          ) : displayPoster ? (
            <img src={processImageUrl(displayPoster)} alt={title} className="absolute inset-0 w-full h-full object-cover object-center blur-xl scale-110" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
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
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-end">
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
                <div className="flex-1 text-white pb-2">
                  {/* 标题 - 优先使用Logo图片，水平居中 */}
                  <div className="flex justify-center mb-4">
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
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 text-sm">
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
                    <p className="text-gray-300 text-sm leading-relaxed line-clamp-4">{description}</p>
                  )}
                  {loading && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm mt-2">
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

            {/* 分集列表（仅电视剧） */}
            {stype !== 'movie' && episodes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">分集</h2>
                  {seasons.length > 1 && (
                    <select
                      value={currentSeason}
                      onChange={(e) => setCurrentSeason(Number(e.target.value))}
                      className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {seasons.map((s) => (
                        <option key={s.seasonNumber} value={s.seasonNumber}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {tmdbLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                    <span>加载分集信息...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {episodes.map((ep) => (
                      <div
                        key={ep.episodeNumber}
                        className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          // 跳转到播放页并指定集数
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
                        {ep.stillPath ? (
                          <div className="relative aspect-video bg-gray-200 dark:bg-gray-700">
                            <img src={ep.stillPath} alt={ep.name} className="w-full h-full object-cover" />
                            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded">
                              第{ep.episodeNumber}集
                            </div>
                          </div>
                        ) : (
                          <div className="relative aspect-video bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                            <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">E{ep.episodeNumber}</span>
                          </div>
                        )}
                        <div className="p-3">
                          <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-1">
                            {ep.name || `第${ep.episodeNumber}集`}
                          </h3>
                          {ep.overview && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{ep.overview}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                            {ep.airDate && <span>{ep.airDate}</span>}
                            {ep.runtime && <span>{ep.runtime}分钟</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
