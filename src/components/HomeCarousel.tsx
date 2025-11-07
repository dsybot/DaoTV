/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { ChevronLeft, ChevronRight, Play, Star } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { processImageUrl } from '@/lib/utils';

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

export default function HomeCarousel() {
  const router = useRouter();
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

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

  // 环形索引辅助函数：获取实际索引
  const getCircularIndex = useCallback((index: number) => {
    if (items.length === 0) return 0;
    return ((index % items.length) + items.length) % items.length;
  }, [items.length]);

  // 触摸手势处理
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setIsAutoPlaying(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      setCurrentIndex(prev => prev + 1); // 索引可以无限增长
    } else if (isRightSwipe) {
      setCurrentIndex(prev => prev - 1); // 索引可以是负数
    }
    
    setTouchStart(0);
    setTouchEnd(0);
  };

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
      <div className={`${containerClass} bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 animate-pulse flex items-center justify-center`}>
        <div className="text-gray-500 dark:text-gray-400 text-lg">正在加载精彩内容...</div>
      </div>
    );
  }

  // 无数据或错误处理
  if (error || items.length === 0) {
    return (
      <div className={`${containerClass} bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center p-6`}>
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

  const currentItem = items[getCircularIndex(currentIndex)];

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
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-[2]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-[2]" />

      {/* 内容区域 - 底部留出空间给缩略图导航 */}
      <div className="relative z-10 h-full flex flex-col justify-end px-6 sm:px-8 md:px-12 pt-6 sm:pt-8 md:pt-12 pb-32 sm:pb-36">
        <div className="max-w-2xl">
          {/* 标题 */}
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-2 sm:mb-4 drop-shadow-lg line-clamp-2">
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
            <p className="text-gray-200 text-sm sm:text-base line-clamp-2 sm:line-clamp-3 max-w-xl">
              {currentItem.overview}
            </p>
          )}
        </div>
      </div>

      {/* 底部导航区域 - 移动端和桌面端不同布局 */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        {/* 移动端：左右布局 - 缩略图 + 播放按钮 */}
        <div className="md:hidden flex items-end justify-between px-4 pb-4 gap-3">
          {items.length > 1 && (
            <>
              {/* 左侧：缩略图区域 - 固定显示5个（环形） */}
              <div 
                className="relative flex-1 overflow-hidden py-4"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* 左侧渐隐遮罩 */}
                <div className="absolute top-0 left-0 bottom-0 w-12 bg-gradient-to-r from-black/80 to-transparent pointer-events-none z-10"></div>

                {/* 右侧渐隐遮罩 */}
                <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-black/80 to-transparent pointer-events-none z-10"></div>

                {/* 缩略图固定显示5个（当前项前后各2个） */}
                <div className="flex gap-2 justify-center items-center">
                  {[-2, -1, 0, 1, 2].map((offset) => {
                    const actualIndex = getCircularIndex(currentIndex + offset);
                    const item = items[actualIndex];
                    const isCurrent = offset === 0; // 中间那个是当前项

                    return (
                      <button
                        key={offset}
                        onClick={() => {
                          setCurrentIndex(prev => prev + offset);
                          setIsAutoPlaying(false);
                        }}
                        className={`flex-shrink-0 transition-all duration-300 rounded-lg overflow-hidden bg-gray-800 ${
                          isCurrent
                            ? 'ring-2 ring-white shadow-2xl scale-125'
                            : 'ring-1 ring-white/50 opacity-60 scale-100'
                        }`}
                        aria-label={`切换到 ${item?.title || ''}`}
                      >
                        <img
                          src={item ? processImageUrl(item.poster) : ''}
                          alt={item?.title || ''}
                          className="w-14 h-20 object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 右侧：圆形播放按钮 */}
              <div className="flex-shrink-0">
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
                {items.map((item, index) => (
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
                    className={`flex-shrink-0 transition-all duration-300 rounded-lg overflow-hidden bg-gray-800 ${index === currentIndex
                      ? 'ring-2 ring-white shadow-2xl scale-105'
                      : 'ring-1 ring-white/50'
                      }`}
                    aria-label={`切换到 ${item.title}`}
                  >
                    <img
                      src={processImageUrl(item.poster)}
                      alt={item.title}
                      className="w-16 h-24 object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 右侧：圆形播放按钮 - 模糊背景 */}
          <div className="flex-shrink-0 ml-4">
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
