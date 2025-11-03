/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { ChevronLeft, ChevronRight, Play, Star } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-[2]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-[2]" />

      {/* 内容区域 */}
      <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-8 md:p-12">
        <div className="max-w-2xl">
          {/* 标题 */}
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-2 sm:mb-4 drop-shadow-lg line-clamp-2">
            {currentItem.title}
          </h2>

          {/* 元信息 */}
          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 text-sm sm:text-base">
            {currentItem.rate > 0 && (
              <div className="flex items-center gap-1 text-yellow-400">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                <span className="font-semibold">{currentItem.rate.toFixed(1)}</span>
              </div>
            )}
            <span className="text-gray-300">{currentItem.year}</span>
            <span className="px-2 py-0.5 bg-blue-500/80 text-white text-xs sm:text-sm rounded">
              {currentItem.source === 'movie' ? '电影' : currentItem.source === 'variety' ? '综艺' : '电视剧'}
            </span>
          </div>

          {/* 简介 */}
          {currentItem.overview && (
            <p className="text-gray-200 text-sm sm:text-base mb-4 sm:mb-6 line-clamp-2 sm:line-clamp-3 max-w-xl">
              {currentItem.overview}
            </p>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handlePlay(currentItem)}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-lg"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <span className="text-sm sm:text-base font-medium">立即播放</span>
            </button>
            <Link
              href={`/douban?type=${currentItem.source === 'variety' ? 'show' : currentItem.source === 'movie' ? 'movie' : 'tv'}`}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-lg transition-colors"
            >
              <span className="text-sm sm:text-base font-medium">了解更多</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 左右切换按钮 */}
      {items.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all opacity-0 group-hover:opacity-100"
            aria-label="上一个"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all opacity-0 group-hover:opacity-100"
            aria-label="下一个"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </>
      )}

      {/* 指示器 */}
      {items.length > 1 && (
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                setIsAutoPlaying(false);
              }}
              className={`h-1 sm:h-1.5 rounded-full transition-all ${index === currentIndex
                ? 'w-8 sm:w-12 bg-white'
                : 'w-4 sm:w-6 bg-white/50 hover:bg-white/70'
                }`}
              aria-label={`切换到第 ${index + 1} 个`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
