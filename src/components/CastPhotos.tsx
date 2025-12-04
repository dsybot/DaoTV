/* eslint-disable @next/next/no-img-element, no-console */
'use client';

import { useEffect, useState } from 'react';

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

  // 如果功能未启用、正在加载或没有演员数据，不显示
  if (!enabled || loading || actors.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        主演
      </h4>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
          {actors.map((actor, index) => (
            <div
              key={`${actor.name}-${index}`}
              className="flex-shrink-0 w-16 text-center group"
            >
              <div className="relative w-16 h-16 mx-auto mb-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 shadow-md group-hover:shadow-lg transition-shadow duration-300">
                {actor.photo ? (
                  <img
                    src={actor.photo}
                    alt={actor.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate px-1" title={actor.name}>
                {actor.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
