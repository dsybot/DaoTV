/* eslint-disable @next/next/no-img-element, no-console */
'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import VideoCard from '@/components/VideoCard';

interface ActorPhoto {
  name: string;
  photo: string | null;
  id: number | null;
  character?: string;
}

interface TMDBCastItem {
  id: number;
  name: string;
  original_name?: string;
  character?: string;
  photo: string | null;
  order?: number;
}

interface ActorWork {
  id: string;
  title: string;
  poster: string;
  year: string;
  rate: string;
}

interface DoubanCelebrity {
  name: string;
  full_name?: string;
  name_en?: string;
  aliases?: string[];
  role: string;
  character: string;
  douban_id: string;
  order?: number;
}

const CJK_RE = /[\u3400-\u9fff]/;

function uniqueNames(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const clean = value?.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });

  return result;
}

function normalizeCompact(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[·・•]/g, '')
    .replace(/[^a-z0-9\u3400-\u9fff]/g, '');
}

function englishTokenKey(value: string): string {
  const tokens = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u3400-\u9fff]+/g, ' ')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length > 1);

  if (tokens.length < 2) return '';
  return [...tokens].sort().join(' ');
}

function reverseEnglishName(value?: string): string {
  const tokens = value?.trim().split(/\s+/).filter(Boolean) || [];
  if (tokens.length < 2 || tokens.length > 4) return '';
  return [...tokens].reverse().join(' ');
}

function extractEnglishFromFullName(value?: string): string {
  if (!value) return '';
  const withoutLeadingChinese = value.replace(/^[\u3400-\u9fff·・]+\s*/, '');
  return /[a-zA-Z]/.test(withoutLeadingChinese)
    ? withoutLeadingChinese.trim()
    : '';
}

function getDoubanAliases(celebrity: DoubanCelebrity): string[] {
  const nameEn =
    celebrity.name_en || extractEnglishFromFullName(celebrity.full_name);

  return uniqueNames([
    celebrity.name,
    celebrity.full_name,
    nameEn,
    reverseEnglishName(nameEn),
    ...(celebrity.aliases || []),
  ]);
}

function getTmdbAliases(actor: TMDBCastItem): string[] {
  return uniqueNames([actor.name, actor.original_name]);
}

function scoreNameMatch(
  actor: TMDBCastItem,
  actorIndex: number,
  celebrity: DoubanCelebrity,
  celebrityIndex: number,
): { baseScore: number; score: number } {
  const tmdbAliases = getTmdbAliases(actor);
  const doubanAliases = getDoubanAliases(celebrity);
  let baseScore = 0;

  for (const tmdbName of tmdbAliases) {
    const tmdbCompact = normalizeCompact(tmdbName);
    const tmdbHasCjk = CJK_RE.test(tmdbName);
    const tmdbTokenKey = englishTokenKey(tmdbName);

    for (const doubanName of doubanAliases) {
      const doubanCompact = normalizeCompact(doubanName);
      if (!tmdbCompact || !doubanCompact) continue;

      const doubanHasCjk = CJK_RE.test(doubanName);
      const doubanTokenKey = englishTokenKey(doubanName);

      if (tmdbCompact === doubanCompact) {
        baseScore = Math.max(
          baseScore,
          tmdbHasCjk || doubanHasCjk || tmdbCompact.length >= 5 ? 100 : 88,
        );
      }

      if (
        tmdbTokenKey &&
        doubanTokenKey &&
        tmdbTokenKey === doubanTokenKey
      ) {
        baseScore = Math.max(baseScore, 96);
      }

      if (
        tmdbHasCjk &&
        doubanHasCjk &&
        Math.min(tmdbCompact.length, doubanCompact.length) >= 2 &&
        (tmdbCompact.includes(doubanCompact) ||
          doubanCompact.includes(tmdbCompact))
      ) {
        baseScore = Math.max(baseScore, 82);
      }
    }
  }

  if (baseScore === 0) return { baseScore: 0, score: 0 };

  const tmdbOrder = actor.order ?? actorIndex;
  const doubanOrder = celebrity.order ?? celebrityIndex;
  const orderDiff = Math.abs(tmdbOrder - doubanOrder);
  let orderBonus = 0;
  if (orderDiff === 0) {
    orderBonus = 8;
  } else if (orderDiff === 1) {
    orderBonus = 6;
  } else if (orderDiff === 2) {
    orderBonus = 4;
  } else if (orderDiff <= 4) {
    orderBonus = 2;
  }

  return { baseScore, score: baseScore + orderBonus };
}

function buildDoubanCharacterMap(
  tmdbCast: TMDBCastItem[],
  doubanCelebrities: DoubanCelebrity[],
): Map<number, string> {
  const candidatesByActor = new Map<
    number,
    Array<{
      actorIndex: number;
      celebrityIndex: number;
      character: string;
      baseScore: number;
      score: number;
    }>
  >();

  tmdbCast.forEach((actor, actorIndex) => {
    doubanCelebrities.forEach((celebrity, celebrityIndex) => {
      if (!celebrity.character) return;

      const match = scoreNameMatch(
        actor,
        actorIndex,
        celebrity,
        celebrityIndex,
      );

      if (match.score < 88) return;

      const candidates = candidatesByActor.get(actorIndex) || [];
      candidates.push({
        actorIndex,
        celebrityIndex,
        character: celebrity.character,
        ...match,
      });
      candidatesByActor.set(actorIndex, candidates);
    });
  });

  const accepted = Array.from(candidatesByActor.values())
    .map((candidates) => {
      const sorted = candidates.sort((a, b) => b.score - a.score);
      const [best, second] = sorted;
      if (!best) return null;

      const ambiguous =
        second && best.score - second.score < 6 && best.baseScore < 95;
      return ambiguous ? null : best;
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score);

  const usedActors = new Set<number>();
  const usedCelebrities = new Set<number>();
  const characterMap = new Map<number, string>();

  accepted.forEach((match) => {
    if (!match) return;
    if (usedActors.has(match.actorIndex)) return;
    if (usedCelebrities.has(match.celebrityIndex)) return;

    usedActors.add(match.actorIndex);
    usedCelebrities.add(match.celebrityIndex);
    characterMap.set(match.actorIndex, match.character);
  });

  return characterMap;
}

interface CastPhotosProps {
  tmdbCast?: TMDBCastItem[];  // TMDB演员数据
  doubanId?: string;          // 豆瓣ID，用于获取角色名
  onEnabledChange?: (enabled: boolean) => void;
}

export default function CastPhotos({ tmdbCast, doubanId, onEnabledChange }: CastPhotosProps) {
  const [actors, setActors] = useState<ActorPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 选中的演员和作品
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actorWorks, setActorWorks] = useState<ActorWork[]>([]);
  const [worksLoading, setWorksLoading] = useState(false);
  const [worksType, setWorksType] = useState<'movie' | 'tv'>('tv');

  // 作品列表滚动
  const worksScrollRef = useRef<HTMLDivElement>(null);
  const [showWorksLeftArrow, setShowWorksLeftArrow] = useState(false);
  const [showWorksRightArrow, setShowWorksRightArrow] = useState(false);

  // 豆瓣演员数据（用于补充角色名）
  const [doubanCelebrities, setDoubanCelebrities] = useState<DoubanCelebrity[]>([]);

  // 获取豆瓣演员表
  useEffect(() => {
    let cancelled = false;
    setDoubanCelebrities([]);

    if (!doubanId) return;

    const fetchDoubanCelebrities = async () => {
      try {
        const response = await fetch(`/api/douban/celebrities?id=${doubanId}&v=2`);
        const data = await response.json();
        if (!cancelled && data.code === 200 && data.data?.celebrities) {
          setDoubanCelebrities(data.data.celebrities);
        }
      } catch (error) {
        console.error('获取豆瓣演员表失败:', error);
      }
    };

    fetchDoubanCelebrities();

    return () => {
      cancelled = true;
    };
  }, [doubanId]);

  // 处理TMDB演员数据，豆瓣只用于在当前演员列表内保守补充角色名
  useEffect(() => {
    if (!tmdbCast || tmdbCast.length === 0) {
      setEnabled(false);
      setActors([]);
      onEnabledChange?.(false);
      setLoading(false);
      return;
    }

    const doubanCharacterMap =
      doubanCelebrities.length > 0
        ? buildDoubanCharacterMap(tmdbCast, doubanCelebrities)
        : new Map<number, string>();

    const actorsWithPhoto = tmdbCast
      .map((a, index) => ({
        name: a.name,
        photo: a.photo,
        id: a.id,
        character: doubanCharacterMap.get(index) || a.character,
      }))
      .filter((actor) => actor.photo);

    setActors(actorsWithPhoto);
    setEnabled(actorsWithPhoto.length > 0);
    onEnabledChange?.(actorsWithPhoto.length > 0);
    setLoading(false);
  }, [tmdbCast, doubanCelebrities, onEnabledChange]);

  // 获取演员作品
  const fetchActorWorks = async (actorName: string, type: 'movie' | 'tv') => {
    setWorksLoading(true);
    try {
      const params = new URLSearchParams({
        actor: actorName,
        type: type,
        sortBy: 'date',
        sortOrder: 'desc',
        limit: '50',
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

  // 当演员列表加载完成后，自动获取第一位演员的作品
  useEffect(() => {
    if (actors.length > 0 && enabled) {
      fetchActorWorks(actors[0].name, 'tv');
    }
  }, [actors, enabled]);

  // 点击演员头像
  const handleActorClick = (index: number) => {
    if (index !== selectedIndex) {
      setSelectedIndex(index);
      setActorWorks([]); // 先清空旧数据，防止混淆
      fetchActorWorks(actors[index].name, worksType);
    }
  };

  // 切换作品类型
  const handleTypeChange = (type: 'movie' | 'tv') => {
    if (type !== worksType && actors[selectedIndex]) {
      setWorksType(type);
      setActorWorks([]); // 先清空旧数据，防止混淆
      fetchActorWorks(actors[selectedIndex].name, type);
    }
  };

  // 检查演员列表滚动状态
  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
  };

  // 检查作品列表滚动状态
  const checkWorksScrollPosition = () => {
    const container = worksScrollRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowWorksLeftArrow(scrollLeft > 0);
    setShowWorksRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
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

  useEffect(() => {
    const container = worksScrollRef.current;
    if (!container) return;
    checkWorksScrollPosition();
    container.addEventListener('scroll', checkWorksScrollPosition);
    window.addEventListener('resize', checkWorksScrollPosition);
    return () => {
      container.removeEventListener('scroll', checkWorksScrollPosition);
      window.removeEventListener('resize', checkWorksScrollPosition);
    };
  }, [actorWorks]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollAmount = 240;
    const newScrollLeft = direction === 'left'
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;
    container.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
  };

  const scrollWorks = (direction: 'left' | 'right') => {
    const container = worksScrollRef.current;
    if (!container) return;
    const scrollAmount = 400;
    const newScrollLeft = direction === 'left'
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;
    container.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
  };

  if (!enabled || loading || actors.length === 0) {
    return null;
  }

  const needsScroll = showLeftArrow || showRightArrow;
  const needsWorksScroll = showWorksLeftArrow || showWorksRightArrow;
  const selectedActor = actors[selectedIndex];

  return (
    <div className="mt-4 -mx-3 md:mx-0">
      <div className="flex items-center justify-between mb-3 px-3 md:px-0">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          主演
        </h4>
        {needsScroll && (
          <div className="flex gap-1">
            <button
              onClick={() => scroll('left')}
              disabled={!showLeftArrow}
              className={`w-6 h-6 flex items-center justify-center rounded transition-all ${showLeftArrow
                ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!showRightArrow}
              className={`w-6 h-6 flex items-center justify-center rounded transition-all ${showRightArrow
                ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 演员头像列表 */}
      <div ref={scrollContainerRef} className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-4 pt-2 pb-2 px-2" style={{ minWidth: 'max-content' }}>
          {actors.map((actor, index) => (
            <div
              key={`${actor.name}-${index}`}
              className={`shrink-0 w-20 text-center cursor-pointer transition-all duration-200 ${index === selectedIndex ? 'scale-105' : 'opacity-70 hover:opacity-100'
                }`}
              onClick={() => handleActorClick(index)}
            >
              <div className={`relative w-20 h-20 mx-auto mb-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 shadow-md transition-all duration-300 ${index === selectedIndex
                ? 'ring-2 ring-blue-500 shadow-lg'
                : 'hover:shadow-lg'
                }`}>
                {actor.photo ? (
                  <img
                    src={actor.photo}
                    alt={actor.name}
                    className="w-full h-full object-cover"
                    loading="eager"
                    onError={(e) => {
                      // 图片加载失败时重试最多3次
                      const img = e.target as HTMLImageElement;
                      const retryCount = parseInt(img.dataset.retryCount || '0');
                      if (retryCount < 3 && actor.photo) {
                        img.dataset.retryCount = (retryCount + 1).toString();
                        setTimeout(() => {
                          img.src = actor.photo + `?retry=${retryCount + 1}&t=${Date.now()}`;
                        }, 1000 * (retryCount + 1));
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                    <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <p className={`text-sm truncate px-1 transition-colors ${index === selectedIndex
                ? 'text-blue-500 font-medium'
                : 'text-gray-600 dark:text-gray-400'
                }`} title={actor.name}>
                {actor.name}
              </p>
              {actor.character && /[\u4e00-\u9fa5]/.test(actor.character) && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate px-1" title={`饰 ${actor.character}`}>
                  饰 {actor.character}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 演员作品区域 */}
      <div className="mt-4 p-3 md:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl mx-3 md:mx-0">
        {/* 标题和类型切换 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedActor?.name} 的作品
            </h5>
            <div className="inline-flex p-1 rounded-xl bg-gray-200 dark:bg-gray-700">
              {(['tv', 'movie'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${worksType === type
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  disabled={worksLoading}
                >
                  {type === 'movie' ? '电影' : '电视剧'}
                </button>
              ))}
            </div>
          </div>
          {needsWorksScroll && (
            <div className="flex gap-1">
              <button
                onClick={() => scrollWorks('left')}
                disabled={!showWorksLeftArrow}
                className={`w-6 h-6 flex items-center justify-center rounded transition-all ${showWorksLeftArrow
                  ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollWorks('right')}
                disabled={!showWorksRightArrow}
                className={`w-6 h-6 flex items-center justify-center rounded transition-all ${showWorksRightArrow
                  ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* 作品列表 - 单行横向滚动，保持最小高度 */}
        <div className="relative min-h-[200px]">
          {worksLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 dark:bg-gray-800/80 z-10 rounded-lg">
              <span className="inline-block h-8 w-8 border-3 border-gray-300 border-t-blue-500 rounded-full animate-spin"></span>
            </div>
          )}
          {actorWorks.length > 0 ? (
            <div
              ref={worksScrollRef}
              className="overflow-x-auto pb-2 show-scrollbar"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
            >
              <div className="flex gap-3 pt-2 px-1" style={{ minWidth: 'max-content' }}>
                {actorWorks.map((work, index) => (
                  <div
                    key={work.id || index}
                    className="shrink-0 w-28 sm:w-32"
                  >
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
            </div>
          ) : !worksLoading ? (
            <div className="flex items-center justify-center h-[200px] text-gray-500 dark:text-gray-400 text-sm">
              暂无{worksType === 'movie' ? '电影' : '电视剧'}作品
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
