/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Play, Star, Heart, ExternalLink, PlayCircle, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo, useEffect, useState, useCallback } from 'react';

import { useLongPress } from '@/hooks/useLongPress';
import { isAIRecommendFeatureDisabled } from '@/lib/ai-recommend.client';
import {
  isFavorited,
  saveFavorite,
  deleteFavorite,
  generateStorageKey,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import {
  SHORTDRAMA_CACHE_EXPIRE,
  getCacheKey,
  getCache,
  setCache,
} from '@/lib/shortdrama-cache';
import { ShortDramaItem } from '@/lib/types';

import AIRecommendModal from '@/components/AIRecommendModal';
import MobileActionSheet from '@/components/MobileActionSheet';

interface ShortDramaCardProps {
  drama: ShortDramaItem;
  showDescription?: boolean;
  className?: string;
  aiEnabled?: boolean; // AI功能是否启用
}

function ShortDramaCard({
  drama,
  showDescription = false,
  className = '',
  aiEnabled: aiEnabledProp,
}: ShortDramaCardProps) {
  const router = useRouter();
  const [realEpisodeCount, setRealEpisodeCount] = useState<number>(drama.episode_count);
  const [showEpisodeCount, setShowEpisodeCount] = useState(drama.episode_count > 1); // 是否显示集数标签
  const [imageLoaded, setImageLoaded] = useState(false); // 图片加载状态
  const [favorited, setFavorited] = useState(false); // 收藏状态
  const [showMobileActions, setShowMobileActions] = useState(false); // 移动端操作面板
  const [showAIChat, setShowAIChat] = useState(false); // AI问片弹窗

  // AI功能状态：优先使用父组件传递的值，否则自己检测
  const [aiEnabledLocal, setAiEnabledLocal] = useState(false);
  const [aiCheckCompleteLocal, setAiCheckCompleteLocal] = useState(false);

  // 实际使用的AI状态（优先父组件prop）
  const aiEnabled = aiEnabledProp !== undefined ? aiEnabledProp : aiEnabledLocal;

  // 短剧的source固定为shortdrama
  const source = 'shortdrama';
  const id = drama.id.toString();

  // 检查收藏状态
  useEffect(() => {
    const fetchFavoriteStatus = async () => {
      try {
        const fav = await isFavorited(source, id);
        setFavorited(fav);
      } catch (err) {
        console.error('检查收藏状态失败:', err);
      }
    };

    fetchFavoriteStatus();

    // 监听收藏状态更新事件
    const storageKey = generateStorageKey(source, id);
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        const isNowFavorited = !!newFavorites[storageKey];
        setFavorited(isNowFavorited);
      }
    );

    return unsubscribe;
  }, [source, id]);

  // 检查AI功能是否启用 - 只在没有父组件传递时才执行
  useEffect(() => {
    // 如果父组件已传递aiEnabled，跳过本地检测
    if (aiEnabledProp !== undefined) {
      return;
    }

    if (isAIRecommendFeatureDisabled()) {
      setAiEnabledLocal(false);
      setAiCheckCompleteLocal(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/ai-recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        if (!cancelled) {
          setAiEnabledLocal(response.status !== 403);
          setAiCheckCompleteLocal(true);
        }
      } catch (error) {
        if (!cancelled) {
          setAiEnabledLocal(false);
          setAiCheckCompleteLocal(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [aiEnabledProp]);

  // 获取真实集数（优先使用备用API）
  useEffect(() => {
    const fetchEpisodeCount = async () => {
      const cacheKey = getCacheKey('episodes', { id: drama.id });

      // 检查统一缓存
      const cached = await getCache(cacheKey);
      if (cached && typeof cached === 'number') {
        if (cached > 1) {
          setRealEpisodeCount(cached);
          setShowEpisodeCount(true);
        } else {
          setShowEpisodeCount(false);
        }
        return;
      }

      try {
        // 优先尝试使用备用API（通过剧名获取集数，更快更可靠）
        const episodeCountResponse = await fetch(
          `/api/shortdrama/episode-count?name=${encodeURIComponent(drama.name)}`
        );

        if (episodeCountResponse.ok) {
          const episodeCountData = await episodeCountResponse.json();
          if (episodeCountData.episodeCount > 1) {
            setRealEpisodeCount(episodeCountData.episodeCount);
            setShowEpisodeCount(true);
            // 使用统一缓存系统缓存结果
            await setCache(cacheKey, episodeCountData.episodeCount, SHORTDRAMA_CACHE_EXPIRE.episodes);
            return; // 成功获取，直接返回
          }
        }

        // 备用API失败，fallback到主API解析方式
        console.log('备用API获取集数失败，尝试主API...');

        // 先尝试第1集（episode=0）
        let response = await fetch(`/api/shortdrama/parse?id=${drama.id}&episode=0&name=${encodeURIComponent(drama.name)}`);
        let result = null;

        if (response.ok) {
          result = await response.json();
        }

        // 如果第1集失败，尝试第2集（episode=1）
        if (!result || !result.totalEpisodes) {
          response = await fetch(`/api/shortdrama/parse?id=${drama.id}&episode=1&name=${encodeURIComponent(drama.name)}`);
          if (response.ok) {
            result = await response.json();
          }
        }

        if (result && result.totalEpisodes > 1) {
          setRealEpisodeCount(result.totalEpisodes);
          setShowEpisodeCount(true);
          // 使用统一缓存系统缓存结果
          await setCache(cacheKey, result.totalEpisodes, SHORTDRAMA_CACHE_EXPIRE.episodes);
        } else {
          // 如果解析失败或集数<=1，不显示集数标签，缓存0避免重复请求
          setShowEpisodeCount(false);
          await setCache(cacheKey, 0, SHORTDRAMA_CACHE_EXPIRE.episodes / 24); // 1小时后重试
        }
      } catch (error) {
        console.error('获取集数失败:', error);
        // 网络错误时不显示集数标签
        setShowEpisodeCount(false);
        await setCache(cacheKey, 0, SHORTDRAMA_CACHE_EXPIRE.episodes / 24); // 1小时后重试
      }
    };

    // 只有当前集数为1（默认值）时才尝试获取真实集数
    if (drama.episode_count === 1) {
      fetchEpisodeCount();
    }
  }, [drama.id, drama.episode_count, drama.name]);

  // 处理收藏切换
  const handleToggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        if (favorited) {
          // 取消收藏
          await deleteFavorite(source, id);
          setFavorited(false);
        } else {
          // 添加收藏
          await saveFavorite(source, id, {
            title: drama.name,
            source_name: '短剧',
            year: '',
            cover: drama.cover,
            total_episodes: realEpisodeCount,
            save_time: Date.now(),
            search_title: drama.name,
            origin: 'shortdrama', // 短剧来源
          });
          setFavorited(true);
        }
      } catch (err) {
        console.error('切换收藏状态失败:', err);
      }
    },
    [favorited, source, id, drama.name, drama.cover, realEpisodeCount]
  );

  // 处理长按事件
  const handleLongPress = useCallback(() => {
    setShowMobileActions(true);
  }, []);

  // 处理点击事件（跳转到播放页面）
  const handleClick = useCallback(() => {
    router.push(`/play?title=${encodeURIComponent(drama.name)}&shortdrama_id=${drama.id}`);
  }, [router, drama.name, drama.id]);

  // 处理播放（在操作面板中使用）
  const handlePlay = useCallback(() => {
    window.location.href = `/play?title=${encodeURIComponent(drama.name)}&shortdrama_id=${drama.id}`;
  }, [drama.name, drama.id]);

  // 处理新标签页播放
  const handlePlayInNewTab = useCallback(() => {
    window.open(`/play?title=${encodeURIComponent(drama.name)}&shortdrama_id=${drama.id}`, '_blank', 'noopener,noreferrer');
  }, [drama.name, drama.id]);

  // 配置长按功能
  const longPressProps = useLongPress({
    onLongPress: handleLongPress,
    onClick: handleClick,
    longPressDelay: 500,
  });

  const formatScore = (score: number) => {
    return score > 0 ? score.toFixed(1) : '--';
  };

  const formatUpdateTime = (updateTime: string) => {
    try {
      const date = new Date(updateTime);
      return date.toLocaleDateString('zh-CN');
    } catch {
      return updateTime;
    }
  };

  // 根据评分获取徽章样式（与 VideoCard 保持一致）
  const getRatingBadgeStyle = useCallback((score: number) => {
    if (score >= 8.5) {
      // 高分：金色 + 发光
      return {
        bgColor: 'bg-linear-to-br from-yellow-400 via-amber-500 to-yellow-600',
        ringColor: 'ring-2 ring-yellow-400/50',
        shadowColor: 'shadow-lg shadow-yellow-500/50',
        textColor: 'text-white',
        glowClass: 'group-hover:shadow-yellow-500/70',
      };
    } else if (score >= 7.0) {
      // 中高分：蓝色
      return {
        bgColor: 'bg-linear-to-br from-blue-500 via-blue-600 to-blue-700',
        ringColor: 'ring-2 ring-blue-400/40',
        shadowColor: 'shadow-md shadow-blue-500/30',
        textColor: 'text-white',
        glowClass: 'group-hover:shadow-blue-500/50',
      };
    } else if (score >= 6.0) {
      // 中分：绿色
      return {
        bgColor: 'bg-linear-to-br from-green-500 via-green-600 to-green-700',
        ringColor: 'ring-2 ring-green-400/40',
        shadowColor: 'shadow-md shadow-green-500/30',
        textColor: 'text-white',
        glowClass: 'group-hover:shadow-green-500/50',
      };
    } else {
      // 低分：灰色
      return {
        bgColor: 'bg-linear-to-br from-gray-500 via-gray-600 to-gray-700',
        ringColor: 'ring-2 ring-gray-400/40',
        shadowColor: 'shadow-md shadow-gray-500/30',
        textColor: 'text-white',
        glowClass: 'group-hover:shadow-gray-500/50',
      };
    }
  }, []);

  return (
    <>
      <div
        className={`group relative ${className} transition-all duration-300 ease-in-out hover:scale-[1.05] hover:z-500 cursor-pointer`}
        onClick={handleClick}
        {...longPressProps}
        style={{
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          pointerEvents: 'auto',
        } as React.CSSProperties}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMobileActions(true);
          return false;
        }}
        onDragStart={(e) => {
          e.preventDefault();
          return false;
        }}
      >
        {/* 封面图片 */}
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800">
          {/* 渐变光泽动画层 - 循环扫过效果 */}
          <div
            className='absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10'
            style={{
              background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.15) 55%, transparent 70%)',
              backgroundSize: '200% 100%',
              animation: 'cover-shimmer 2.5s ease-in-out infinite',
            }}
          />

          <img
            src={drama.cover}
            alt={drama.name}
            className={`h-full w-full object-cover transition-all duration-700 ease-out ${imageLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-md scale-105'
              }`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder-cover.jpg';
              setImageLoaded(true);
            }}
          />

          {/* 悬浮播放按钮 - 优化：移除模糊效果 */}
          <div className="absolute inset-0 flex items-center justify-center bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-all duration-300 group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform group-hover:scale-110">
              <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
            </div>
          </div>

          {/* 集数标识 - Netflix 统一风格 - 只在集数>1时显示 */}
          {showEpisodeCount && (
            <div className="absolute top-2 left-2 flex items-center overflow-hidden rounded-md shadow-lg transition-all duration-300 ease-out group-hover:scale-105 bg-black/70 backdrop-blur-sm px-2 py-0.5">
              <span className="flex items-center text-[10px] font-medium text-white/80">
                {realEpisodeCount} 集
              </span>
            </div>
          )}

          {/* 评分徽章 - 动态颜色（右上角倾斜丝带，与 VideoCard 保持一致） */}
          {drama.score > 0 && (() => {
            const badgeStyle = getRatingBadgeStyle(drama.score);
            return (
              <div
                className={`absolute top-[10px] right-[-35px] z-30 w-[120px] ${badgeStyle.bgColor} ${badgeStyle.ringColor} ${badgeStyle.shadowColor} ${badgeStyle.textColor} ${badgeStyle.glowClass} text-[10px] font-bold py-0.5 sm:py-1 flex items-center justify-center gap-0.5 sm:gap-1 transition-all duration-300 ease-out group-hover:scale-105 rotate-45 pointer-events-none`}
                style={{
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties}
              >
                <Star size={10} className="fill-current" />
                <span className="font-extrabold leading-none">{formatScore(drama.score)}</span>
              </div>
            );
          })()}

          {/* 更新时间标签 */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/30 dark:bg-white/20 px-2.5 py-1 text-[10px] text-white dark:text-gray-900 backdrop-blur-sm">
            <svg className="w-3 h-3 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span className="font-medium">{formatUpdateTime(drama.update_time)}</span>
          </div>

          {/* 收藏按钮 - 右下角 */}
          <button
            onClick={handleToggleFavorite}
            className="absolute bottom-2 right-2 h-8 w-8 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm opacity-0 transition-all duration-300 group-hover:opacity-100 hover:scale-110 hover:bg-black/70 z-20"
            aria-label={favorited ? '取消收藏' : '添加收藏'}
          >
            <Heart
              className={`h-4 w-4 transition-all duration-300 ${favorited
                ? 'fill-red-500 text-red-500 scale-110'
                : 'text-white hover:text-red-400'
                }`}
            />
          </button>

          {/* AI问片按钮 - 桌面端hover显示 */}
          {aiEnabled && (
            <div
              className="
                hidden md:block absolute
                bottom-2 left-2
                opacity-0 group-hover:opacity-100
                transition-all duration-300 ease-out
                z-20
              "
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAIChat(true);
                }}
                className='
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                  bg-black/60 backdrop-blur-md
                  hover:bg-black/80 hover:scale-105 hover:shadow-[0_0_12px_rgba(168,85,247,0.4)]
                  transition-all duration-300 ease-out
                  border border-white/10'
                aria-label='AI问片'
                style={{
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties}
              >
                <Sparkles size={14} className='text-purple-400' />
                <span className='text-xs font-medium whitespace-nowrap text-white'>AI问片</span>
              </button>
            </div>
          )}
        </div>

        {/* 信息区域 */}
        <div className="mt-2 space-y-1.5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-linear-to-r group-hover:from-blue-600 group-hover:to-purple-600 dark:group-hover:from-blue-400 dark:group-hover:to-purple-400 transition-all duration-300">
            {drama.name}
          </h3>

          {/* 描述信息（可选） */}
          {showDescription && drama.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
              {drama.description}
            </p>
          )}
        </div>
      </div>

      {/* 移动端操作面板 */}
      <MobileActionSheet
        isOpen={showMobileActions}
        onClose={() => setShowMobileActions(false)}
        title={drama.name}
        poster={drama.cover}
        actions={[
          {
            id: 'play',
            label: '播放',
            icon: <PlayCircle size={20} />,
            onClick: handlePlay,
            color: 'primary' as const,
          },
          {
            id: 'play-new-tab',
            label: '新标签页播放',
            icon: <ExternalLink size={20} />,
            onClick: handlePlayInNewTab,
            color: 'default' as const,
          },
          {
            id: 'favorite',
            label: favorited ? '取消收藏' : '添加收藏',
            icon: favorited ? (
              <Heart size={20} className="fill-red-600 stroke-red-600" />
            ) : (
              <Heart size={20} className="fill-transparent stroke-red-500" />
            ),
            onClick: async () => {
              try {
                if (favorited) {
                  await deleteFavorite(source, id);
                  setFavorited(false);
                } else {
                  await saveFavorite(source, id, {
                    title: drama.name,
                    source_name: '短剧',
                    year: '',
                    cover: drama.cover,
                    total_episodes: realEpisodeCount,
                    save_time: Date.now(),
                    search_title: drama.name,
                  });
                  setFavorited(true);
                }
              } catch (err) {
                console.error('切换收藏状态失败:', err);
              }
            },
            color: favorited ? ('danger' as const) : ('default' as const),
          },
          ...(aiEnabled ? [{
            id: 'ai-chat',
            label: 'AI问片',
            icon: <Sparkles size={20} />,
            onClick: () => {
              setShowMobileActions(false);
              setShowAIChat(true);
            },
            color: 'default' as const,
          }] : []),
        ]}
      />

      {/* AI问片弹窗 */}
      {aiEnabled && showAIChat && (
        <AIRecommendModal
          isOpen={showAIChat}
          onClose={() => setShowAIChat(false)}
          context={{
            title: drama.name,
            type: 'tv',
          }}
          welcomeMessage={`想了解《${drama.name}》的更多信息吗？我可以帮你查询剧情、演员、评价等。`}
        />
      )}
    </>
  );
}

export default memo(ShortDramaCard);