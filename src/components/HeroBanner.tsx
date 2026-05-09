/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { ChevronLeft, ChevronRight, Info, Play, Volume2, VolumeX } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import {
  useClearTrailerUrlMutation,
  useRefreshedTrailerUrlsQuery,
  useRefreshTrailerUrlMutation,
} from '@/hooks/useHeroBannerQueries';

import { useAutoplay } from './hooks/useAutoplay';
import { useSwipeGesture } from './hooks/useSwipeGesture';

interface BannerItem {
  id: string | number;
  title: string;
  description?: string;
  poster: string;
  backdrop?: string;
  year?: string;
  rate?: string;
  douban_id?: number;
  type?: string;
  trailerUrl?: string;
}

interface HeroBannerProps {
  items: BannerItem[];
  autoPlayInterval?: number;
  showControls?: boolean;
  showIndicators?: boolean;
  enableVideo?: boolean;
}

function HeroBanner({
  items,
  autoPlayInterval = 8000,
  showControls = true,
  showIndicators = true,
  enableVideo = false,
}: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoErrorTimesRef = useRef<Record<string, number>>({});
  const requestedTrailerIdsRef = useRef<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);

  const FORCE_REFRESH_COOLDOWN = 60 * 1000;
  const FORCE_REFRESH_STORAGE_KEY = 'hero-banner-force-refresh-times';

  const { data: refreshedTrailerUrls = {} } = useRefreshedTrailerUrlsQuery();
  const refreshTrailerMutation = useRefreshTrailerUrlMutation();
  const clearTrailerMutation = useClearTrailerUrlMutation();

  const getProxiedImageUrl = (url: string) => {
    if (url?.includes('douban') || url?.includes('doubanio')) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  const getHDBackdrop = (url?: string) => {
    if (!url) return url;
    return url
      .replace('/view/photo/s/', '/view/photo/l/')
      .replace('/view/photo/m/', '/view/photo/l/')
      .replace('/view/photo/sqxs/', '/view/photo/l/')
      .replace('/s_ratio_poster/', '/l_ratio_poster/')
      .replace('/m_ratio_poster/', '/l_ratio_poster/');
  };

  const getLastForceRefreshTime = (doubanId: string): number => {
    if (typeof window === 'undefined') return 0;
    try {
      const stored = localStorage.getItem(FORCE_REFRESH_STORAGE_KEY);
      if (stored) {
        const times = JSON.parse(stored) as Record<string, number>;
        return times[doubanId] || 0;
      }
    } catch (error) {
      console.error('[HeroBanner] 读取强制刷新时间失败:', error);
    }
    return 0;
  };

  const setLastForceRefreshTime = (doubanId: string, time: number): void => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(FORCE_REFRESH_STORAGE_KEY);
      const times = stored ? JSON.parse(stored) : {};
      times[doubanId] = time;
      localStorage.setItem(FORCE_REFRESH_STORAGE_KEY, JSON.stringify(times));
    } catch (error) {
      console.error('[HeroBanner] 保存强制刷新时间失败:', error);
    }
  };

  const getProxiedVideoUrl = (url: string, doubanId?: string | number) => {
    if (url?.startsWith('/api/video-proxy')) {
      return url;
    }
    if (url?.includes('douban') || url?.includes('doubanio')) {
      const proxyUrl = `/api/video-proxy?url=${encodeURIComponent(url)}`;
      if (doubanId) {
        return `${proxyUrl}&douban_id=${doubanId}`;
      }
      return proxyUrl;
    }
    return url;
  };

  const refreshTrailerUrl = useCallback(
    async (doubanId: number | string, force = false) => {
      return refreshTrailerMutation.mutateAsync({ doubanId, force });
    },
    [refreshTrailerMutation],
  );

  const getEffectiveTrailerUrl = useCallback(
    (item: BannerItem) => {
      if (item.douban_id && refreshedTrailerUrls[item.douban_id]) {
        const cachedUrl = refreshedTrailerUrls[item.douban_id];
        if (
          cachedUrl.startsWith('NO_TRAILER_') ||
          cachedUrl.startsWith('FAILED_')
        ) {
          return null;
        }
        return cachedUrl;
      }
      return item.trailerUrl;
    },
    [refreshedTrailerUrls],
  );

  const handleNext = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setVideoLoaded(false);
    setCurrentIndex((prev) => (prev + 1) % items.length);
    setTimeout(() => setIsTransitioning(false), 800);
  }, [isTransitioning, items.length]);

  const handlePrev = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setVideoLoaded(false);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    setTimeout(() => setIsTransitioning(false), 800);
  }, [isTransitioning, items.length]);

  const handleIndicatorClick = (index: number) => {
    if (isTransitioning || index === currentIndex) {
      return;
    }
    setIsTransitioning(true);
    setVideoLoaded(false);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 800);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  useAutoplay({
    currentIndex,
    isHovered,
    autoPlayInterval,
    itemsLength: items.length,
    onNext: handleNext,
  });

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrev,
  });

  // 预加载背景图片（只预加载当前和后一个，优化性能）
  useEffect(() => {
    // 预加载当前、后一张
    if (typeof window === 'undefined') return; // SSR环境跳过
    if (!items || items.length === 0) return;

    const indicesToPreload = [
      currentIndex,
      (currentIndex + 1) % items.length,
    ];

    indicesToPreload.forEach((index) => {
      const item = items[index];
      if (item) {
        const img = new window.Image();
        const imageUrl = getHDBackdrop(item.backdrop) || item.poster;
        img.src = getProxiedImageUrl(imageUrl);
      }
    });
  }, [items, currentIndex]);

  useEffect(() => {
    if (!enableVideo || !items || items.length === 0) {
      return;
    }

    const checkAndRefreshVisibleTrailers = async () => {
      const RETRY_COOLDOWN = 5 * 60 * 1000;
      const NO_TRAILER_COOLDOWN = 24 * 60 * 60 * 1000;

      const indicesToLoad = [
        currentIndex,
        (currentIndex + 1) % items.length,
      ];

      for (const index of indicesToLoad) {
        const item = items[index];
        if (!item || !item.douban_id) {
          continue;
        }
        const doubanId = item.douban_id;
        const doubanIdStr = doubanId.toString();

        if (requestedTrailerIdsRef.current.has(doubanIdStr)) {
          continue;
        }

        const cachedValue = refreshedTrailerUrls[doubanId];

        if (!cachedValue) {
          console.log('[HeroBanner] 延迟加载 trailer:', item.title);
          requestedTrailerIdsRef.current.add(doubanIdStr);
          await refreshTrailerUrl(doubanId);
        } else if (cachedValue?.startsWith('NO_TRAILER_')) {
          const parts = cachedValue.split('_');
          const markedTime = parseInt(parts[parts.length - 1], 10);
          const now = Date.now();
          if (now - markedTime > NO_TRAILER_COOLDOWN) {
            console.log(
              '[HeroBanner] 无预告片标记已过期（24小时），重新尝试:',
              item.title,
            );
            requestedTrailerIdsRef.current.add(doubanIdStr);
            await refreshTrailerUrl(doubanId);
          }
        } else if (cachedValue?.startsWith('FAILED_')) {
          const parts = cachedValue.split('_');
          const failedTime = parseInt(parts[parts.length - 1], 10);
          const now = Date.now();
          if (now - failedTime > RETRY_COOLDOWN) {
            console.log('[HeroBanner] 失败冷却期已过，重新尝试:', item.title);
            requestedTrailerIdsRef.current.add(doubanIdStr);
            await refreshTrailerUrl(doubanId);
          }
        }
      }
    };

    const timer = setTimeout(checkAndRefreshVisibleTrailers, 1000);
    return () => clearTimeout(timer);
  }, [items, currentIndex, refreshedTrailerUrls, refreshTrailerUrl, enableVideo]);

  if (!items || items.length === 0) {
    return null;
  }

  const currentItem = items[currentIndex];

  console.log('[HeroBanner] 当前项目:', {
    title: currentItem.title,
    hasBackdrop: !!currentItem.backdrop,
    hasTrailer: !!currentItem.trailerUrl,
    trailerUrl: currentItem.trailerUrl,
    enableVideo,
  });

  return (
    <div
      className='dao-hero-banner relative w-full aspect-[16/9] overflow-hidden bg-black group rounded-xl sm:rounded-2xl md:left-1/2 md:w-screen md:max-w-none md:-translate-x-1/2 md:aspect-auto md:h-[72vh] md:min-h-[560px] md:max-h-[820px] md:rounded-none'
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...swipeHandlers}
    >
      <div className='absolute inset-0 bg-black'>
        {items.map((item, index) => {
          const prevIndex = (currentIndex - 1 + items.length) % items.length;
          const nextIndex = (currentIndex + 1) % items.length;
          const shouldRender =
            index === currentIndex ||
            index === prevIndex ||
            index === nextIndex;

          if (!shouldRender) return null;

          const imageUrl = getHDBackdrop(item.backdrop) || item.poster;

          return (
            <div
              key={item.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentIndex ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <Image
                src={getProxiedImageUrl(imageUrl)}
                alt={item.title}
                fill
                className='object-cover object-center'
                priority={index === 0}
                quality={100}
                sizes='100vw'
                unoptimized={
                  item.backdrop?.includes('/l/') ||
                  item.backdrop?.includes('/l_ratio_poster/') ||
                  false
                }
              />

              {enableVideo && getEffectiveTrailerUrl(item) && index === currentIndex && (
                <video
                  key={`video-${item.id}-${currentIndex}`}
                  ref={videoRef}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                    videoLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  autoPlay
                  muted={isMuted}
                  loop
                  playsInline
                  preload='metadata'
                  onError={async (event) => {
                    const video = event.currentTarget;
                    const error = (video as any).error;
                    const errorCode = error?.code;
                    const errorMessage = error?.message;
                    const networkState = video.networkState;
                    const readyState = video.readyState;
                    const errorType =
                      errorCode === 1
                        ? 'ABORTED'
                        : errorCode === 2
                          ? 'NETWORK'
                          : errorCode === 3
                            ? 'DECODE'
                            : errorCode === 4
                              ? 'SRC_NOT_SUPPORTED'
                              : 'UNKNOWN';

                    const errorData = {
                      title: item.title,
                      douban_id: item.douban_id,
                      trailerUrl: item.trailerUrl,
                      effectiveUrl: getEffectiveTrailerUrl(item),
                      errorCode,
                      errorMessage,
                      networkState,
                      readyState,
                      errorType,
                      failedAt: new Date().toISOString(),
                    };

                    console.error('[HeroBanner] 视频加载失败:', errorData);

                    fetch('/api/client-log', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        level: 'error',
                        message: `视频加载失败: ${item.title} (douban_id: ${item.douban_id})`,
                        data: errorData,
                        timestamp: Date.now(),
                      }),
                    }).catch(() => {});

                    if (item.douban_id) {
                      const doubanIdStr = item.douban_id.toString();
                      const now = Date.now();
                      const lastErrorTime =
                        videoErrorTimesRef.current[doubanIdStr] || 0;

                      if (now - lastErrorTime < 5000) {
                        console.warn(
                          `[HeroBanner] 影片 ${item.title} onError 触发过于频繁，忽略`,
                        );
                        return;
                      }
                      videoErrorTimesRef.current[doubanIdStr] = now;

                      if (errorCode !== 2) {
                        console.warn(
                          `[HeroBanner] 影片 ${item.title} 非网络错误（code=${errorCode}），不触发强制刷新`,
                        );
                        return;
                      }

                      const lastRefreshTime =
                        getLastForceRefreshTime(doubanIdStr);
                      const timeSinceLastRefresh = now - lastRefreshTime;

                      if (timeSinceLastRefresh < FORCE_REFRESH_COOLDOWN) {
                        const remainingSeconds = Math.ceil(
                          (FORCE_REFRESH_COOLDOWN - timeSinceLastRefresh) /
                            1000,
                        );
                        console.warn(
                          `[HeroBanner] 影片 ${item.title} 强制刷新冷却中，${remainingSeconds}秒后可重试`,
                        );
                        return;
                      }

                      setLastForceRefreshTime(doubanIdStr, now);

                      if (refreshedTrailerUrls[item.douban_id]) {
                        clearTrailerMutation.mutate({
                          doubanId: item.douban_id,
                        });
                      }

                      requestedTrailerIdsRef.current.delete(doubanIdStr);

                      console.log(
                        `[HeroBanner] 强制刷新 trailer URL: ${item.title}`,
                      );
                      const newUrl = await refreshTrailerUrl(
                        item.douban_id,
                        true,
                      );
                      if (newUrl) {
                        video.load();
                      }
                    }
                  }}
                  onLoadedData={(event) => {
                    console.log('[HeroBanner] 视频加载成功:', item.title);
                    setVideoLoaded(true);
                    event.currentTarget.play().catch((error) => {
                      console.error('[HeroBanner] 视频自动播放失败:', error);
                    });
                  }}
                >
                  <source
                    src={getProxiedVideoUrl(
                      getEffectiveTrailerUrl(item) || '',
                      item.douban_id,
                    )}
                    type='video/mp4'
                  />
                </video>
              )}
            </div>
          );
        })}

        <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20' />
        <div className='absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent' />
        <div className='absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/80 to-transparent md:h-56' />
        <div className='absolute inset-y-0 left-0 w-[31%] bg-gradient-to-r from-black/75 via-black/25 to-transparent' />
        <div className='absolute inset-y-0 right-0 w-[18%] bg-gradient-to-l from-black/45 to-transparent' />
      </div>

      <div className='dao-hero-content absolute bottom-0 left-0 right-0 px-4 pb-10 sm:px-8 sm:pb-16 md:pb-24'>
        <div className='max-w-2xl space-y-3 sm:space-y-4 md:space-y-5'>
          <h1 className='line-clamp-1 text-3xl font-bold leading-tight text-white drop-shadow-2xl sm:text-5xl md:line-clamp-2 md:text-6xl xl:text-7xl'>
            {currentItem.title}
          </h1>

          <div className='flex flex-wrap items-center gap-2 text-xs sm:gap-3 sm:text-base'>
            {currentItem.rate && (
              <div className='flex items-center gap-1 rounded bg-yellow-500/95 px-2 py-1 text-white shadow-lg'>
                <span className='font-bold'>★</span>
                <span className='font-bold'>{currentItem.rate}</span>
              </div>
            )}
            {currentItem.year && (
              <span className='font-semibold text-white/90 drop-shadow-md'>
                {currentItem.year}
              </span>
            )}
            {currentItem.type && (
              <span className='rounded border border-white/25 bg-white/20 px-2.5 py-1 font-medium text-white/90 backdrop-blur-[8px]'>
                {currentItem.type === 'movie'
                  ? '电影'
                  : currentItem.type === 'tv'
                    ? '剧集'
                    : currentItem.type === 'variety'
                      ? '综艺'
                      : currentItem.type === 'shortdrama'
                        ? '短剧'
                        : currentItem.type === 'anime'
                          ? '动漫'
                          : '剧集'}
              </span>
            )}
          </div>

          {currentItem.description && (
            <p className='line-clamp-2 max-w-xl text-sm leading-6 text-white/90 drop-shadow-lg sm:text-base md:line-clamp-3'>
              {currentItem.description}
            </p>
          )}

          <div className='flex gap-2 pt-1 sm:gap-3 sm:pt-2'>
            <Link
              href={
                currentItem.type === 'shortdrama'
                  ? `/play?title=${encodeURIComponent(currentItem.title)}&shortdrama_id=${currentItem.id}`
                  : `/play?title=${encodeURIComponent(currentItem.title)}${
                      currentItem.year ? `&year=${currentItem.year}` : ''
                    }${currentItem.douban_id ? `&douban_id=${currentItem.douban_id}` : ''}${
                      currentItem.type ? `&stype=${currentItem.type}` : ''
                    }`
              }
              className='flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-bold text-black shadow-xl transition-all hover:bg-white active:scale-95 sm:px-8 sm:py-3 sm:text-base'
            >
              <Play className='h-5 w-5' fill='currentColor' />
              <span>立即播放</span>
            </Link>
            <Link
              href={
                currentItem.type === 'shortdrama'
                  ? '/shortdrama'
                  : `/douban?type=${
                      currentItem.type === 'variety'
                        ? 'show'
                        : currentItem.type || 'movie'
                    }`
              }
              className='flex items-center gap-2 rounded-full border border-white/25 bg-white/20 px-5 py-2.5 text-sm font-bold text-white shadow-xl backdrop-blur-[12px] transition-all hover:bg-white/25 active:scale-95 sm:px-8 sm:py-3 sm:text-base'
            >
              <Info className='h-5 w-5' />
              <span>详情</span>
            </Link>
          </div>
        </div>
      </div>

      {enableVideo && getEffectiveTrailerUrl(currentItem) && (
        <button
          type='button'
          onClick={toggleMute}
          className='absolute bottom-12 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/50 text-white transition-all hover:bg-black/60 sm:bottom-28 sm:right-8 sm:h-12 sm:w-12 md:right-14'
          aria-label={isMuted ? '取消静音' : '静音'}
        >
          {isMuted ? (
            <VolumeX className='h-4 w-4 sm:h-6 sm:w-6' />
          ) : (
            <Volume2 className='h-4 w-4 sm:h-6 sm:w-6' />
          )}
        </button>
      )}

      {showControls && items.length > 1 && (
        <>
          <button
            type='button'
            onClick={handlePrev}
            className='dao-hero-prev hidden absolute top-1/2 h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white opacity-0 transition-all hover:bg-black/60 group-hover:opacity-100 md:flex'
            aria-label='上一张'
          >
            <ChevronLeft className='h-7 w-7' />
          </button>
          <button
            type='button'
            onClick={handleNext}
            className='hidden absolute right-8 top-1/2 h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white opacity-0 transition-all hover:bg-black/60 group-hover:opacity-100 md:flex lg:right-10'
            aria-label='下一张'
          >
            <ChevronRight className='h-7 w-7' />
          </button>
        </>
      )}

      {showIndicators && items.length > 1 && (
        <div className='absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-6'>
          {items.map((_, index) => (
            <button
              key={index}
              type='button'
              onClick={() => handleIndicatorClick(index)}
              className={`h-1 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'w-10 bg-white shadow-lg'
                  : 'w-2 bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`跳转到第 ${index + 1} 张`}
            />
          ))}
        </div>
      )}

      <div className='absolute top-3 right-3 md:hidden'>
        <div className='rounded border border-white/60 bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white'>
          {currentIndex + 1} / {items.length}
        </div>
      </div>
    </div>
  );
}

export default memo(HeroBanner);
