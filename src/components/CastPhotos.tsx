/* eslint-disable @next/next/no-img-element, no-console */
'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import VideoCard from '@/components/VideoCard';

interface ActorPhoto {
  name: string;
  photo: string | null;
  id: number | null;
}

interface ActorWork {
  id: string;
  title: string;
  poster: string;
  year: string;
  rate: string;
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

  // 演员作品弹窗状态
  const [selectedActor, setSelectedActor] = useState<ActorPhoto | null>(null);
  const [actorWorks, setActorWorks] = useState<ActorWork[]>([]);
  const [worksLoading, setWorksLoading] = useState(false);
  const [worksType, setWorksType] = useState<'movie' | 'tv'>('movie');

  useEffect(() => {
    if (!cast || cast.length === 0) {
      setLoading(false);
      return;
    }

    const fetchActorPhotos = async () => {
      try {
        const names = cast.slice(0, 20).join(',');
        const response = await fetch(`/api/tmdb/cast-photos?names=${encodeURIComponent(names)}`, {
          cache: 'no-store',
        });
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

  // 获取演员作品
  const fetchActorWorks = async (actorName: string, type: 'movie' | 'tv') => {
    setWorksLoading(true);
    try {
      const params = new URLSearchParams({
        actor: actorName,
        type: type,
        sortBy: 'date',
        sortOrder: 'desc',
        limit: '12',
      });
      const response = await fetch(`/api/tmdb/actor?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (data.code === 200 && data.list) {
        setActorWorks(data.list);
      } else {
        setActorWorks([]);
      }
    } catch (error) {
      console.error('获取演员作品失败:', error);
      setActorWorks([]);
    } finally {
      setWorksLoading(false);
    }
  };

  // 点击演员头像
  const handleActorClick = (actor: ActorPhoto) => {
    setSelectedActor(actor);
    setWorksType('movie');
    fetchActorWorks(actor.name, 'movie');
  };

  // 切换作品类型
  const handleTypeChange = (type: 'movie' | 'tv') => {
    if (type !== worksType && selectedActor) {
      setWorksType(type);
      fetchActorWorks(selectedActor.name, type);
    }
  };

  // 关闭弹窗
  const closeModal = () => {
    setSelectedActor(null);
    setActorWorks([]);
  };

  // 检查滚动状态
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
    const scrollAmount = 240;
    const newScrollLeft = direction === 'left'
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;
    container.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
  };

  if (!enabled || loading || actors.length === 0) {
    return null;
  }

  const needsScroll = showLeftArrow || showRightArrow;

  return (
    <>
      <div className="mt-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          主演
        </h4>
        <div className="flex items-center gap-2">
          <div className="flex-1 overflow-hidden">
            <div ref={scrollContainerRef} className="overflow-x-auto scrollbar-hide">
              <div className="flex gap-4 pb-2 px-1" style={{ minWidth: 'max-content' }}>
                {actors.map((actor, index) => (
                  <div
                    key={`${actor.name}-${index}`}
                    className="flex-shrink-0 w-20 text-center group cursor-pointer"
                    onClick={() => handleActorClick(actor)}
                  >
                    <div className="relative w-20 h-20 mx-auto mb-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 shadow-md group-hover:shadow-lg group-hover:ring-2 group-hover:ring-blue-500 transition-all duration-300">
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
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate px-1 group-hover:text-blue-500 transition-colors" title={actor.name}>
                      {actor.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {needsScroll && (
            <div className="flex-shrink-0 flex flex-col gap-2 self-center" style={{ marginTop: '-20px' }}>
              <button
                onClick={() => scroll('left')}
                disabled={!showLeftArrow}
                className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all duration-200 ${showLeftArrow
                  ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scroll('right')}
                disabled={!showRightArrow}
                className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all duration-200 ${showRightArrow
                  ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 演员作品弹窗 */}
      {selectedActor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {selectedActor.photo && (
                  <img
                    src={selectedActor.photo}
                    alt={selectedActor.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {selectedActor.name} 的作品
                  </h3>
                  <div className="flex gap-2 mt-1">
                    {(['movie', 'tv'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => handleTypeChange(type)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${worksType === type
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                          }`}
                        disabled={worksLoading}
                      >
                        {type === 'movie' ? '电影' : '电视剧'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 100px)' }}>
              {worksLoading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="inline-block h-8 w-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></span>
                </div>
              ) : actorWorks.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {actorWorks.map((work, index) => (
                    <div key={work.id || index} className="w-full">
                      <VideoCard
                        id={work.id}
                        title={work.title}
                        poster={work.poster}
                        year={work.year}
                        rate={work.rate}
                        from="douban"
                        type={worksType}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                  暂无{worksType === 'movie' ? '电影' : '电视剧'}作品
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
