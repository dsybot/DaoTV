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

// TMDB背景图获取
async function getTMDBBackdrop(title: string, year: string, type: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/tmdb/backdrop?title=${encodeURIComponent(title)}&year=${year}&type=${type}`);
    if (response.ok) {
      const data = await response.json();
      return data.backdrop || null;
    }
  } catch (error) {
    console.error('获取TMDB背景图失败:', error);
  }
  return null;
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
  const stype = searchParams.get('stype') || ''; // movie 或 tv
  const stitle = searchParams.get('stitle') || ''; // 搜索标题

  // 状态
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [movieDetails, setMovieDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // 获取TMDB背景图
  useEffect(() => {
    const fetchBackdrop = async () => {
      if (title) {
        const bg = await getTMDBBackdrop(title, year, stype || 'tv');
        setBackdrop(bg);
      }
    };
    fetchBackdrop();
  }, [title, year, stype]);

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

    // 监听收藏状态更新
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
      // 有具体源和ID
      const url = `/play?source=${source}&id=${id}&title=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}${doubanIdParam}${stypeParam}${stitleParam}`;
      router.push(url);
    } else {
      // 只有标题，需要搜索
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

  // 获取显示的封面
  const displayPoster = movieDetails?.cover || poster;

  // 获取详情信息
  const rate = movieDetails?.rate || '';
  const firstAired = movieDetails?.first_aired || '';
  const genres = movieDetails?.genres || [];
  const description = movieDetails?.plot_summary || '';

  return (
    <PageLayout>
      {/* 使用负margin抵消PageLayout的顶部margin，让背景图从最顶部开始 */}
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 -mt-12 md:-mt-24">
        {/* 顶部背景区域 - 可滚动，高度包含被抵消的margin */}
        <div className="relative w-full h-[calc(50vh+3rem)] sm:h-[calc(55vh+3rem)] md:h-[calc(60vh+6rem)]">
          {/* 返回按钮 - 位置需要考虑被抵消的margin */}
          <button
            onClick={() => router.back()}
            className="absolute top-16 md:top-28 left-4 z-20 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* 背景图 */}
          {backdrop ? (
            <img
              src={backdrop}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : displayPoster ? (
            <img
              src={processImageUrl(displayPoster)}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover object-center blur-xl scale-110"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
          )}

          {/* 渐变遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-100 dark:from-gray-900 via-transparent to-transparent" />
        </div>

        {/* 内容区域 - 向上偏移覆盖背景图底部 */}
        <div className="relative -mt-32 sm:-mt-40 md:-mt-48 px-4 sm:px-6 md:px-8 lg:px-12 pb-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-end">
              {/* 左侧：封面卡片和按钮 */}
              <div className="flex-shrink-0 w-40 sm:w-48 md:w-56 mx-auto md:mx-0">
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
                <div className="mt-4 flex flex-col gap-3">
                  {/* 播放按钮 */}
                  <button
                    onClick={handlePlay}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>播放</span>
                  </button>

                  {/* 透明按钮组 */}
                  <div className="flex gap-3">
                    {/* 豆瓣按钮 */}
                    {doubanId > 0 && (
                      <button
                        onClick={handleOpenDouban}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg transition-all duration-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="text-sm">豆瓣</span>
                      </button>
                    )}

                    {/* 收藏按钮 */}
                    {source && id && (
                      <button
                        onClick={handleToggleFavorite}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ${favorited
                          ? 'bg-red-100 hover:bg-red-200 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-500'
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white'
                          }`}
                      >
                        <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
                        <span className="text-sm">{favorited ? '已收藏' : '收藏'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 右侧：详情信息 - 底部对齐 */}
              <div className="flex-1 pb-2">
                {/* 标题 */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 text-gray-900 dark:text-white">
                  {title}
                </h1>

                {/* 元信息行 */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 text-sm">
                  {/* 首播日期 */}
                  {firstAired && (
                    <span className="text-gray-600 dark:text-gray-400">
                      {firstAired}
                    </span>
                  )}

                  {/* 类型标签 */}
                  {stype && (
                    <span className="px-2 py-0.5 bg-blue-500/80 text-white text-xs rounded">
                      {stype === 'movie' ? '电影' : '电视剧'}
                    </span>
                  )}

                  {/* 分类 */}
                  {genres.length > 0 && (
                    <span className="text-gray-600 dark:text-gray-400">
                      {genres.slice(0, 3).join(' · ')}
                    </span>
                  )}

                  {/* 豆瓣评分 */}
                  {rate && rate !== '0' && parseFloat(rate) > 0 && (
                    <span className="px-2 py-0.5 bg-green-500/80 text-white text-xs rounded font-semibold">
                      {rate}
                    </span>
                  )}
                </div>

                {/* 简介 */}
                {description && (
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {description}
                  </p>
                )}

                {/* 加载状态 */}
                {loading && (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-400 rounded-full animate-spin" />
                    <span>加载详情中...</span>
                  </div>
                )}
              </div>
            </div>

            {/* 下方可扩展区域 - 预留给后续内容 */}
            <div className="mt-8">
              {/* 这里可以添加更多内容，如相关推荐、演员列表等 */}
            </div>
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
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-gray-500">加载中...</div>
        </div>
      </PageLayout>
    }>
      <DetailPageClient />
    </Suspense>
  );
}
