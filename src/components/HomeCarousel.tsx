/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Play, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { processImageUrl } from '@/lib/utils';

import { ImagePlaceholder } from '@/components/ImagePlaceholder';

interface CarouselItem {
  id: number;
  title: string;
  overview: string;
  backdrop: string;
  poster: string;
  rate: number;
  year: string;
  type: 'movie' | 'tv';
  source?: 'movie' | 'tv' | 'variety'; // 豆瓣来源：电影、剧集、综艺
  genres?: string[]; // 豆瓣分类
  first_aired?: string; // 首播日期
}

interface CarouselResponse {
  code: number;
  message: string;
  list: CarouselItem[];
}

function getCarouselPosterUrl(url: string): string {
  return processImageUrl(url);
}

export default function HomeCarousel() {
  const router = useRouter();
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const resumeAutoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [thumbnailLoadedMap, setThumbnailLoadedMap] = useState<Record<number, boolean>>({});

  // 获取轮播数据
  useEffect(() => {
    const fetchCarousel = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/home/carousel');
        const data: CarouselResponse = await response.json();

        if (data.code === 200 && data.list.length > 0) {
          // 在客户端进行随机打乱，确保每次访问都有不同的排列
          const shuffledList = [...data.list].sort(() => Math.random() - 0.5);

          // 打印数据检查（调试用）
          console.log('[轮播图] 收到数据:', shuffledList.length, '项');
          console.log('[轮播图] 前3项示例:', shuffledList.slice(0, 3).map(item => ({
            title: item.title,
            hasGenres: !!item.genres && item.genres.length > 0,
            hasFirstAired: !!item.first_aired,
            genres: item.genres,
            first_aired: item.first_aired
          })));

          setItems(shuffledList);
          setError(null);
        } else if (data.code === 503) {
          setError('TMDB功能未启用');
        } else {
          setError(data.message || '暂无轮播数据');
        }
      } catch (err) {
        setError('加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchCarousel();
  }, []);

  // 暂停自动播放并在5秒后恢复
  const pauseAutoPlayTemporarily = useCallback(() => {
    setIsAutoPlaying(false);

    // 清除之前的定时器
    if (resumeAutoPlayTimerRef.current) {
      clearTimeout(resumeAutoPlayTimerRef.current);
    }

    // 5秒后恢复自动播放
    resumeAutoPlayTimerRef.current = setTimeout(() => {
      setIsAutoPlaying(true);
    }, 5000);
  }, []);

  // 切换到下一个
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  // 切换到上一个
  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  // 自动播放
  useEffect(() => {
    if (!isAutoPlaying || items.length === 0) return;

    const interval = setInterval(() => {
      goToNext();
    }, 5000); // 每5秒切换

    return () => clearInterval(interval);
  }, [isAutoPlaying, items.length, goToNext]);

  // 移动端：自动滚动当前缩略图到中央
  useEffect(() => {
    if (!thumbnailContainerRef.current || items.length === 0) return;

    const container = thumbnailContainerRef.current;
    const thumbnail = thumbnailRefs.current[currentIndex];

    if (!thumbnail) return; // null检查

    // 如果是第一个或最后一个，不强制居中
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === items.length - 1;

    if (isFirst || isLast) {
      // 边界项：滚动到边界即可
      if (isFirst) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
      }
    } else {
      // 中间项：居中显示
      const thumbnailLeft = thumbnail.offsetLeft;
      const thumbnailWidth = thumbnail.offsetWidth;
      const containerWidth = container.clientWidth;

      const targetScroll = thumbnailLeft + thumbnailWidth / 2 - containerWidth / 2;
      container.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  }, [currentIndex, items.length]);

  // 处理播放点击
  const handlePlay = useCallback((item: CarouselItem) => {
    const doubanIdParam = item.id ? `&douban_id=${item.id}` : '';
    const stypeParam = item.type ? `&stype=${item.type}` : '';
    const url = `/play?title=${encodeURIComponent(item.title)}${item.year ? `&year=${item.year}` : ''}${doubanIdParam}${stypeParam}`;
    router.push(url);
  }, [router]);

  const containerClass = "w-full h-[300px] sm:h-[400px] md:h-[500px] rounded-2xl";

  // 加载状态
  if (loading) {
    return (
      <div className={`${containerClass} bg-linear-to-r from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 animate-pulse flex items-center justify-center`}>
        <div className="text-gray-500 dark:text-gray-400 text-lg">正在加载精彩内容...</div>
      </div>
    );
  }

  // 无数据或错误处理
  if (error || items.length === 0) {
    return (
      <div className={`${containerClass} bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center p-6`}>
        <div className="text-center">
          <div className="text-6xl mb-4">🎬</div>
          <div className="text-gray-600 dark:text-gray-300 text-lg font-medium mb-2">
            精彩内容即将呈现
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            {error || '正在为您准备热门影视内容...'}
          </div>
        </div>
      </div>
    );
  }

  const currentItem = items[currentIndex];

  // 处理鼠标悬停事件
  const handleMouseEnter = () => {
    setIsAutoPlaying(false);
  };

  const handleMouseLeave = () => {
    setIsAutoPlaying(true);
  };

  return (
    <div
      className={`relative ${containerClass} overflow-hidden group`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 背景图片层 - 渲染所有图片实现交叉淡入淡出 */}
      {items.map((item, index) => (
        <img
          key={item.id}
          src={item.backdrop}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ease-in-out"
          style={{
            opacity: index === currentIndex ? 1 : 0,
            zIndex: index === currentIndex ? 1 : 0
          }}
        />
      ))}
      <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/50 to-transparent z-2" />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent z-2" />

      {/* 内容区域 - 底部留出空间给缩略图导航 */}
      <div className="relative z-10 h-full flex flex-col justify-end px-6 sm:px-8 md:px-12 pt-6 sm:pt-8 md:pt-12 pb-32 sm:pb-36">
        <div className="max-w-2xl">
          {/* 标题 - 移动端单行截断，桌面端最多两行 */}
          <h2 className="text-xl sm:text-3xl md:text-5xl font-bold text-white mb-2 sm:mb-4 drop-shadow-lg line-clamp-1 sm:line-clamp-2">
            {currentItem.title}
          </h2>

          {/* 元信息 - 两行布局 */}
          <div className="space-y-2 mb-3 sm:mb-4">
            {/* 第一行：评分 + 首播时间 + 类型 */}
            <div className="flex items-center gap-3 text-sm sm:text-base">
              {currentItem.rate > 0 && (
                <div className="flex items-center gap-1 text-yellow-400">
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  <span className="font-semibold">{currentItem.rate.toFixed(1)}</span>
                </div>
              )}
              {currentItem.first_aired && (
                <span className="text-gray-300">
                  {currentItem.first_aired.replace(/-/g, '/')}
                </span>
              )}
              <span className="px-2 py-0.5 bg-blue-500/80 text-white text-xs sm:text-sm rounded">
                {currentItem.source === 'movie' ? '电影' : currentItem.source === 'variety' ? '综艺' : '电视剧'}
              </span>
            </div>

            {/* 第二行：分类标签 */}
            {currentItem.genres && currentItem.genres.length > 0 && (
              <div className="text-sm sm:text-base text-gray-300">
                {currentItem.genres.slice(0, 3).join(' · ')}
              </div>
            )}
          </div>

          {/* 简介 */}
          {currentItem.overview && (
            <p className="text-gray-200 text-sm sm:text-base line-clamp-3 sm:line-clamp-5 max-w-xl">
              {currentItem.overview}
            </p>
          )}
        </div>
      </div>

      {/* 底部导航区域 - 移动端和桌面端不同布局 */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        {/* 移动端：所有缩略图 + 播放按钮 */}
        <div className="md:hidden flex items-end gap-3 px-4 pb-4">
          {items.length > 1 && (
            <>
              {/* 左侧：缩略图横向滚动区域 - 显示所有缩略图 */}
              <div
                ref={thumbnailContainerRef}
                className="flex-1 overflow-x-auto overflow-y-visible scrollbar-hide"
                onTouchStart={pauseAutoPlayTemporarily}
                onMouseDown={pauseAutoPlayTemporarily}
              >
                <div className="flex gap-2 pl-1 py-2" style={{ marginRight: '68px' }}>
                  {items.map((item, index) => {
                    const isActive = index === currentIndex;
                    const isLoaded = thumbnailLoadedMap[item.id];

                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          thumbnailRefs.current[index] = el;
                        }}
                        onClick={() => {
                          setCurrentIndex(index);
                          pauseAutoPlayTemporarily();
                        }}
                        className={`shrink-0 transition-all duration-300 rounded-lg overflow-hidden ${isActive
                          ? 'ring-2 ring-white shadow-2xl scale-105'
                          : 'ring-1 ring-white/50'
                          }`}
                      >
                        <div className="relative w-14 h-20">
                          {!isLoaded && (
                            <ImagePlaceholder aspectRatio="h-full" />
                          )}
                          <img
                            src={getCarouselPosterUrl(item.poster)}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'
                              }`}
                            onLoad={() => {
                              setThumbnailLoadedMap((prev) => ({
                                ...prev,
                                [item.id]: true,
                              }));
                            }}
                            onError={() => {
                              setThumbnailLoadedMap((prev) => ({
                                ...prev,
                                [item.id]: true,
                              }));
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                  {/* 占位元素，为最后一个缩略图的边框和放大效果留出空间 */}
                  <div className="shrink-0 w-2" aria-hidden="true" />
                </div>
              </div>

              {/* 右侧：圆形播放按钮 - 固定在右下角 */}
              <div className="shrink-0">
                <button
                  onClick={() => handlePlay(currentItem)}
                  className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 border border-white/30 flex items-center justify-center transition-all duration-300 shadow-2xl"
                  aria-label="播放"
                >
                  <Play className="w-6 h-6 text-white fill-current ml-0.5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* 桌面端：左侧缩略图 + 右侧播放按钮 */}
        <div className="hidden md:flex items-center justify-between px-6 md:px-8 pb-4 sm:pb-6">
          {/* 左侧：封面缩略图导航 */}
          {items.length > 1 && (
            <div className="relative flex-1 flex-initial">
              {/* 缩略图滚动容器 */}
              <div className="flex gap-3 overflow-visible">
                {items.map((item, index) => {
                  const isLoaded = thumbnailLoadedMap[item.id];

                  return (
                    <button
                      key={index}
                      onMouseEnter={() => {
                        setCurrentIndex(index);
                        setIsAutoPlaying(false);
                      }}
                      onClick={() => {
                        setCurrentIndex(index);
                        setIsAutoPlaying(false);
                      }}
                      className={`shrink-0 transition-all duration-300 rounded-lg overflow-hidden bg-gray-800 ${index === currentIndex
                        ? 'ring-2 ring-white shadow-2xl scale-105'
                        : 'ring-1 ring-white/50'
                        }`}
                      aria-label={`切换到 ${item.title}`}
                    >
                      <div className="relative w-16 h-24">
                        {!isLoaded && (
                          <ImagePlaceholder aspectRatio="h-full" />
                        )}
                        <img
                          src={getCarouselPosterUrl(item.poster)}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'
                            }`}
                          onLoad={() => {
                            setThumbnailLoadedMap((prev) => ({
                              ...prev,
                              [item.id]: true,
                            }));
                          }}
                          onError={() => {
                            setThumbnailLoadedMap((prev) => ({
                              ...prev,
                              [item.id]: true,
                            }));
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 右侧：圆形播放按钮 - 模糊背景 */}
          <div className="shrink-0 ml-4">
            <button
              onClick={() => handlePlay(currentItem)}
              className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 border border-white/30 flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-2xl"
              aria-label="播放"
            >
              <Play className="w-7 h-7 text-white fill-current ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
