/* eslint-disable @next/next/no-img-element, no-console */
'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ActorPhoto {
  name: string;
  photo: string | null;
  id: number | null;
}

interface CastPhotosProps {
  cast: string[];
}

export default function CastPhotos({ cast }: CastPhotosProps) {
  const [actors, setActors] = useState<ActorPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cast || cast.length === 0) {
      setLoading(false);
      return;
    }

    const fetchActorPhotos = async () => {
      try {
        const names = cast.slice(0, 20).join(',');
        const response = await fetch(`/api/tmdb/cast-photos?names=${encodeURIComponent(names)}`);
        const data = await response.json();

        if (data.enabled) {
          setEnabled(true);
          setActors(data.actors || []);
        } else {
          setEnabled(false);
        }
      } catch (error) {
        console.error('获取演员图片失败:', error);
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    fetchActorPhotos();
  }, [cast]);

  // 检查滚动状态，决定是否显示箭头
  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollPosition();
    container.addEventListener('scroll', checkScrollPosition);
    window.addEventListener('resize', checkScrollPosition);

    return () => {
      container.removeEventListener('scroll', checkScrollPosition);
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [actors]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 240; // 滚动3个头像的距离
    const newScrollLeft = direction === 'left'
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  // 如果功能未启用、正在加载或没有演员数据，不显示
  if (!enabled || loading || actors.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        主演
      </h4>
      <div className="relative group/cast">
        {/* 左箭头 */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 opacity-0 group-hover/cast:opacity-100"
            style={{ marginTop: '-12px' }}
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        )}

        {/* 右箭头 */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 opacity-0 group-hover/cast:opacity-100"
            style={{ marginTop: '-12px' }}
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-hide"
        >
          <div className="flex gap-4 pb-2 px-1" style={{ minWidth: 'max-content' }}>
            {actors.map((actor, index) => (
              <div
                key={`${actor.name}-${index}`}
                className="flex-shrink-0 w-20 text-center group"
              >
                <div className="relative w-20 h-20 mx-auto mb-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 shadow-md group-hover:shadow-lg transition-shadow duration-300">
                  {actor.photo ? (
                    <img
                      src={actor.photo}
                      alt={actor.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                      <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate px-1" title={actor.name}>
                  {actor.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
