/* eslint-disable @next/next/no-img-element */

import { useRouter } from 'next/navigation';
import { Gauge, RefreshCw, Wifi } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import { createPortal } from 'react-dom';

import { SearchResult } from '@/lib/types';
import {
  getVideoResolutionFromM3u8,
  processImageUrl,
  VideoSourceTestResult,
} from '@/lib/utils';

type VideoInfo = VideoSourceTestResult;

// TMDB 分集信息类型
export interface TMDBEpisodeInfo {
  episodeNumber: number;
  name: string;
  overview?: string;
  stillPath?: string | null;
  airDate?: string;
  runtime?: number;
}

// 集数按钮组件（带 fixed tooltip）
interface EpisodeButtonProps {
  episodeNumber: number;
  isActive: boolean;
  title?: string;
  tmdbEpisodeName?: string;
  onClick: () => void;
  portalContainer?: HTMLElement | null;
}

const EpisodeButton: React.FC<EpisodeButtonProps> = ({
  episodeNumber,
  isActive,
  title,
  tmdbEpisodeName,
  onClick,
  portalContainer,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [showAbove, setShowAbove] = useState(true);
  const [mounted, setMounted] = useState(false);

  // 确保在客户端渲染
  useEffect(() => {
    setMounted(true);
  }, []);

  const updateTooltipPosition = useCallback(() => {
    if (!buttonRef.current || !tmdbEpisodeName) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const tooltipWidth = Math.min(window.innerWidth * 0.9, 200);
    const tooltipHeight = 50; // 估算高度

    // 判断上方是否有足够空间
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldShowAbove = spaceAbove > tooltipHeight + 10 || spaceAbove > spaceBelow;
    setShowAbove(shouldShowAbove);

    // 计算水平位置，确保不超出屏幕
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (left < 8) left = 8;
    if (left + tooltipWidth > window.innerWidth - 8) {
      left = window.innerWidth - tooltipWidth - 8;
    }

    // 计算箭头位置
    const arrowLeft = rect.left + rect.width / 2 - left - 6;

    if (shouldShowAbove) {
      setTooltipStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${rect.top - 8}px`,
        transform: 'translateY(-100%)',
        width: `${tooltipWidth}px`,
      });
      setArrowStyle({
        left: `${arrowLeft}px`,
      });
    } else {
      setTooltipStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${rect.bottom + 8}px`,
        width: `${tooltipWidth}px`,
      });
      setArrowStyle({
        left: `${arrowLeft}px`,
      });
    }
  }, [tmdbEpisodeName]);

  const handleMouseEnter = () => {
    if (tmdbEpisodeName) {
      updateTooltipPosition();
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  // 显示的文字
  const displayText = (() => {
    if (!title) return episodeNumber;
    const match = title.match(/(?:第)?(\d+)(?:集|话)/);
    if (match) return match[1];
    return title;
  })();

  // Tooltip 内容
  const tooltipContent = tmdbEpisodeName && showTooltip && mounted ? (
    <div
      className='fixed px-3 py-2 bg-linear-to-br from-gray-800 to-gray-900 text-white text-xs rounded-lg shadow-xl border border-white/10 pointer-events-none backdrop-blur-sm'
      style={{
        ...tooltipStyle,
        zIndex: 2147483647,
        maxWidth: 'min(90vw, 200px)',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      }}
    >
      <span className='font-medium leading-relaxed block text-center' style={{ textWrap: 'balance' } as React.CSSProperties}>
        {tmdbEpisodeName}
      </span>
      {/* 箭头 */}
      <div
        className={`absolute w-0 h-0 border-l-[6px] border-r-[6px] border-transparent ${showAbove ? 'top-full border-t-[6px] border-t-gray-800' : 'bottom-full border-b-[6px] border-b-gray-800'}`}
        style={arrowStyle}
      ></div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] px-2 sm:px-3 py-2 flex items-center justify-center text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap font-mono relative overflow-hidden active:scale-95
          ${isActive
            ? 'bg-linear-to-r from-green-500 via-emerald-500 to-teal-500 text-white shadow-lg shadow-green-500/30 dark:from-green-600 dark:via-emerald-600 dark:to-teal-600 dark:shadow-green-500/20 scale-105'
            : 'bg-linear-to-r from-gray-200 to-gray-100 text-gray-700 hover:from-gray-300 hover:to-gray-200 hover:scale-105 hover:shadow-md dark:from-white/10 dark:to-white/5 dark:text-gray-300 dark:hover:from-white/20 dark:hover:to-white/15'
          }`.trim()}
      >
        {isActive && (
          <div className='absolute inset-0 bg-linear-to-r from-green-400 via-emerald-400 to-teal-400 opacity-30 blur'></div>
        )}
        {!isActive && (
          <div className='absolute inset-0 bg-linear-to-r from-transparent via-white/0 to-transparent hover:via-white/20 dark:hover:via-white/10 transition-all duration-300'></div>
        )}
        <span className='relative z-10'>{displayText}</span>
      </button>

      {/* 使用 Portal 将 Tooltip 渲染到指定容器，避免被父容器的 transform 影响 */}
      {mounted && tooltipContent && createPortal(tooltipContent, portalContainer || document.body)}
    </>
  );
};

interface EpisodeSelectorProps {
  /** 总集数 */
  totalEpisodes: number;
  /** 剧集标题 */
  episodes_titles: string[];
  /** 每页显示多少集，默认 50 */
  episodesPerPage?: number;
  /** 当前选中的集数（1 开始） */
  value?: number;
  /** 用户点击选集后的回调 */
  onChange?: (episodeNumber: number) => void;
  /** 换源相关 */
  onSourceChange?: (source: string, id: string, title: string) => void;
  currentSource?: string;
  currentId?: string;
  videoTitle?: string;
  videoYear?: string;
  availableSources?: SearchResult[];
  sourceSearchLoading?: boolean;
  sourceSearchError?: string | null;
  /** 预计算的测速结果，避免重复测速 */
  precomputedVideoInfo?: Map<string, VideoInfo>;
  /** 刷新搜索源 */
  onRefreshSources?: () => void;
  /** 是否在弹窗模式中使用（用于调整overflow和padding避免hover裁切） */
  inModal?: boolean;
  /** TMDB 分集信息（用于显示分集标题 tooltip） */
  tmdbEpisodes?: TMDBEpisodeInfo[];
  /** Portal 容器（用于 tooltip 渲染，全屏时需要传入全屏元素） */
  portalContainer?: HTMLElement | null;
}

/**
 * 选集组件，支持分页、自动滚动聚焦当前分页标签，以及换源功能。
 */
const EpisodeSelector: React.FC<EpisodeSelectorProps> = ({
  totalEpisodes,
  episodes_titles,
  episodesPerPage = 50,
  value = 1,
  onChange,
  onSourceChange,
  currentSource,
  currentId,
  videoTitle,
  availableSources = [],
  sourceSearchLoading = false,
  sourceSearchError = null,
  precomputedVideoInfo,
  onRefreshSources,
  inModal = false,
  tmdbEpisodes = [],
  portalContainer,
}) => {
  const router = useRouter();
  const pageCount = Math.ceil(totalEpisodes / episodesPerPage);

  // 存储每个源的视频信息
  const [videoInfoMap, setVideoInfoMap] = useState<Map<string, VideoInfo>>(
    new Map()
  );
  const [attemptedSources, setAttemptedSources] = useState<Set<string>>(
    new Set()
  );
  const [manualTesting, setManualTesting] = useState(false);
  const [manualProgress, setManualProgress] = useState({ done: 0, total: 0 });
  const [testingSourceKeys, setTestingSourceKeys] = useState<Set<string>>(
    new Set(),
  );

  // 使用 ref 来避免闭包问题
  const attemptedSourcesRef = useRef<Set<string>>(new Set());
  const videoInfoMapRef = useRef<Map<string, VideoInfo>>(new Map());

  // 同步状态到 ref
  useEffect(() => {
    attemptedSourcesRef.current = attemptedSources;
  }, [attemptedSources]);

  useEffect(() => {
    videoInfoMapRef.current = videoInfoMap;
  }, [videoInfoMap]);

  // 主要的 tab 状态：'episodes' 或 'sources'
  // 当只有一集时默认展示 "换源"，并隐藏 "选集" 标签
  const [activeTab, setActiveTab] = useState<'episodes' | 'sources'>(
    totalEpisodes > 1 ? 'episodes' : 'sources'
  );

  // 当前分页索引（0 开始）
  const initialPage = Math.floor((value - 1) / episodesPerPage);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  // 是否倒序显示
  const [descending, setDescending] = useState<boolean>(false);

  // 根据 descending 状态计算实际显示的分页索引
  const displayPage = useMemo(() => {
    if (descending) {
      return pageCount - 1 - currentPage;
    }
    return currentPage;
  }, [currentPage, descending, pageCount]);

  // 获取视频信息的函数 - 移除 attemptedSources 依赖避免不必要的重新创建
  const getVideoInfo = useCallback(async (source: SearchResult) => {
    const sourceKey = `${source.source}-${source.id}`;

    // 使用 ref 获取最新的状态，避免闭包问题
    if (attemptedSourcesRef.current.has(sourceKey)) {
      return;
    }

    // 获取第一集的URL
    if (!source.episodes || source.episodes.length === 0) {
      return;
    }
    const episodeUrl =
      source.episodes.length > 1 ? source.episodes[1] : source.episodes[0];

    // 标记为已尝试
    setAttemptedSources((prev) => new Set(prev).add(sourceKey));

    try {
      const info = await getVideoResolutionFromM3u8(episodeUrl);
      setVideoInfoMap((prev) => new Map(prev).set(sourceKey, info));
    } catch (error) {
      // 失败时保存错误状态
      setVideoInfoMap((prev) =>
        new Map(prev).set(sourceKey, {
          quality: '错误',
          loadSpeed: '未知',
          pingTime: 0,
          hasError: true,
          status: 'failed',
          message: error instanceof Error ? error.message : '测速失败',
          playable: false,
          testedAt: Date.now(),
        })
      );
    }
  }, []);

  // 批量测速所有播放源
  const testAllSources = useCallback(async () => {
    if (availableSources.length === 0 || manualTesting) return;

    setManualTesting(true);
    setManualProgress({ done: 0, total: availableSources.length });
    setTestingSourceKeys(new Set());
    setVideoInfoMap(new Map());
    videoInfoMapRef.current = new Map();

    // 清除所有已测试标记，强制重新测速
    setAttemptedSources(new Set());
    attemptedSourcesRef.current = new Set();

    const batchSize = 3;
    let completed = 0;

    for (let start = 0; start < availableSources.length; start += batchSize) {
      const batch = availableSources.slice(start, start + batchSize);
      batch.forEach((source) => {
        const sourceKey = `${source.source}-${source.id}`;
        setTestingSourceKeys((prev) => new Set(prev).add(sourceKey));
      });

      await Promise.all(
        batch.map(async (source) => {
          const sourceKey = `${source.source}-${source.id}`;
          try {
            await getVideoInfo(source);
          } finally {
            completed += 1;
            setManualProgress({
              done: completed,
              total: availableSources.length,
            });
            setTestingSourceKeys((prev) => {
              const next = new Set(prev);
              next.delete(sourceKey);
              return next;
            });
          }
        }),
      );
    }

    setManualTesting(false);
    setTestingSourceKeys(new Set());
  }, [availableSources, getVideoInfo, manualTesting]);

  // 当有预计算结果时，先合并到videoInfoMap中
  useEffect(() => {
    if (precomputedVideoInfo && precomputedVideoInfo.size > 0) {
      // 原子性地更新两个状态，避免时序问题
      setVideoInfoMap((prev) => {
        const newMap = new Map(prev);
        precomputedVideoInfo.forEach((value, key) => {
          newMap.set(key, value);
        });
        return newMap;
      });

      setAttemptedSources((prev) => {
        const newSet = new Set(prev);
        precomputedVideoInfo.forEach((info, key) => {
          if (!info.hasError) {
            newSet.add(key);
          }
        });
        return newSet;
      });

      // 同步更新 ref，确保 getVideoInfo 能立即看到更新
      precomputedVideoInfo.forEach((info, key) => {
        if (!info.hasError) {
          attemptedSourcesRef.current.add(key);
        }
      });
    }
  }, [precomputedVideoInfo]);

  // 读取本地"优选和测速"开关，默认开启
  const [optimizationEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enableOptimization');
      if (saved !== null) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return false;
  });

  // 当切换到换源tab并且有源数据时，异步获取视频信息 - 移除 attemptedSources 依赖避免循环触发
  useEffect(() => {
    const fetchVideoInfosInBatches = async () => {
      if (
        !optimizationEnabled || // 若关闭测速则直接退出
        activeTab !== 'sources' ||
        availableSources.length === 0
      )
        return;

      // 筛选出尚未测速的播放源
      const pendingSources = availableSources.filter((source) => {
        const sourceKey = `${source.source}-${source.id}`;
        return !attemptedSourcesRef.current.has(sourceKey);
      });

      if (pendingSources.length === 0) return;

      const batchSize = Math.ceil(pendingSources.length / 2);

      for (let start = 0; start < pendingSources.length; start += batchSize) {
        const batch = pendingSources.slice(start, start + batchSize);
        await Promise.all(batch.map(getVideoInfo));
      }
    };

    fetchVideoInfosInBatches();
    // 依赖项保持与之前一致
  }, [activeTab, availableSources, getVideoInfo, optimizationEnabled]);

  // 升序分页标签
  const categoriesAsc = useMemo(() => {
    return Array.from({ length: pageCount }, (_, i) => {
      const start = i * episodesPerPage + 1;
      const end = Math.min(start + episodesPerPage - 1, totalEpisodes);
      return { start, end };
    });
  }, [pageCount, episodesPerPage, totalEpisodes]);

  // 根据 descending 状态决定分页标签的排序和内容
  const categories = useMemo(() => {
    if (descending) {
      // 倒序时，label 也倒序显示
      return [...categoriesAsc]
        .reverse()
        .map(({ start, end }) => `${end}-${start}`);
    }
    return categoriesAsc.map(({ start, end }) => `${start}-${end}`);
  }, [categoriesAsc, descending]);

  const categoryContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 添加鼠标悬停状态管理
  const [isCategoryHovered, setIsCategoryHovered] = useState(false);

  // 阻止页面竖向滚动
  const preventPageScroll = useCallback((e: WheelEvent) => {
    if (isCategoryHovered) {
      e.preventDefault();
    }
  }, [isCategoryHovered]);

  // 处理滚轮事件，实现横向滚动
  const handleWheel = useCallback((e: WheelEvent) => {
    if (isCategoryHovered && categoryContainerRef.current) {
      e.preventDefault(); // 阻止默认的竖向滚动

      const container = categoryContainerRef.current;
      const scrollAmount = e.deltaY * 2; // 调整滚动速度

      // 根据滚轮方向进行横向滚动
      container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  }, [isCategoryHovered]);

  // 添加全局wheel事件监听器
  useEffect(() => {
    if (isCategoryHovered) {
      // 鼠标悬停时阻止页面滚动
      document.addEventListener('wheel', preventPageScroll, { passive: false });
      document.addEventListener('wheel', handleWheel, { passive: false });
    } else {
      // 鼠标离开时恢复页面滚动
      document.removeEventListener('wheel', preventPageScroll);
      document.removeEventListener('wheel', handleWheel);
    }

    return () => {
      document.removeEventListener('wheel', preventPageScroll);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isCategoryHovered, preventPageScroll, handleWheel]);

  // 当分页切换时，将激活的分页标签滚动到视口中间
  useEffect(() => {
    const btn = buttonRefs.current[displayPage];
    if (btn) {
      // 使用原生 scrollIntoView API 自动滚动到视口中央
      btn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',  // 水平居中显示选中的分页
      });
    }
  }, [displayPage, pageCount]);

  // 处理换源tab点击，只在点击时才搜索
  const handleSourceTabClick = () => {
    setActiveTab('sources');
  };

  const handleCategoryClick = useCallback(
    (index: number) => {
      if (descending) {
        // 在倒序时，需要将显示索引转换为实际索引
        setCurrentPage(pageCount - 1 - index);
      } else {
        setCurrentPage(index);
      }
    },
    [descending, pageCount]
  );

  const handleEpisodeClick = useCallback(
    (episodeNumber: number) => {
      onChange?.(episodeNumber);
    },
    [onChange]
  );

  const handleSourceClick = useCallback(
    (source: SearchResult) => {
      onSourceChange?.(source.source, source.id, source.title);
    },
    [onSourceChange]
  );

  const currentStart = currentPage * episodesPerPage + 1;
  const currentEnd = Math.min(
    currentStart + episodesPerPage - 1,
    totalEpisodes
  );

  return (
    <div className={`md:ml-2 px-4 sm:px-4 py-0 h-full rounded-xl bg-black/10 dark:bg-white/5 flex flex-col border border-white/0 dark:border-white/30 ${inModal ? 'overflow-visible' : 'overflow-hidden'}`}>
      {/* 主要的 Tab 切换 - 美化版本 */}
      <div className={`flex mb-2 shrink-0 relative ${inModal ? '-mx-4 rounded-t-xl' : '-mx-4'}`}>
        {totalEpisodes > 1 && (
          <div
            onClick={() => setActiveTab('episodes')}
            className={`group flex-1 py-3.5 sm:py-4 px-4 sm:px-6 text-center cursor-pointer transition-all duration-300 font-semibold relative overflow-hidden active:scale-[0.98] min-h-[44px] ${inModal ? 'rounded-tl-xl' : ''}
              ${activeTab === 'episodes'
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-700 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400'
              }
            `.trim()}
          >
            {/* 激活态背景光晕 */}
            {activeTab === 'episodes' && (
              <div className='absolute inset-0 bg-linear-to-r from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20 -z-10'></div>
            )}
            {/* 非激活态背景 */}
            {activeTab !== 'episodes' && (
              <div className='absolute inset-0 bg-gray-100/50 dark:bg-gray-800/50 group-hover:bg-gray-100 dark:group-hover:bg-gray-800/70 transition-colors duration-300 -z-10'></div>
            )}
            {/* 悬浮光效 */}
            <div className='absolute inset-0 bg-linear-to-r from-transparent via-green-100/0 to-transparent dark:via-green-500/0 group-hover:via-green-100/50 dark:group-hover:via-green-500/10 transition-all duration-300 -z-10'></div>
            <span className='relative z-10 font-bold text-sm sm:text-base'>选集</span>
          </div>
        )}
        <div
          onClick={handleSourceTabClick}
          className={`group flex-1 py-3.5 sm:py-4 px-4 sm:px-6 text-center cursor-pointer transition-all duration-300 font-semibold relative overflow-hidden active:scale-[0.98] min-h-[44px] ${inModal && totalEpisodes <= 1 ? 'rounded-t-xl' : inModal ? 'rounded-tr-xl' : ''}
            ${activeTab === 'sources'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400'
            }
          `.trim()}
        >
          {/* 激活态背景光晕 */}
          {activeTab === 'sources' && (
            <div className='absolute inset-0 bg-linear-to-r from-blue-50 via-cyan-50 to-sky-50 dark:from-blue-900/20 dark:via-cyan-900/20 dark:to-sky-900/20 -z-10'></div>
          )}
          {/* 非激活态背景 */}
          {activeTab !== 'sources' && (
            <div className='absolute inset-0 bg-gray-100/50 dark:bg-gray-800/50 group-hover:bg-gray-100 dark:group-hover:bg-gray-800/70 transition-colors duration-300 -z-10'></div>
          )}
          {/* 悬浮光效 */}
          <div className='absolute inset-0 bg-linear-to-r from-transparent via-blue-100/0 to-transparent dark:via-blue-500/0 group-hover:via-blue-100/50 dark:group-hover:via-blue-500/10 transition-all duration-300 -z-10'></div>
          <span className='relative z-10 font-bold text-sm sm:text-base'>换源</span>
        </div>
      </div>

      {/* 选集 Tab 内容 */}
      {activeTab === 'episodes' && (
        <div className='flex flex-col flex-1 overflow-hidden -mx-4 px-4'>
          {/* 分类标签 */}
          <div className='flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 border-b border-gray-300 dark:border-gray-700 -mx-2 px-2 shrink-0'>
            <div
              className='flex-1 overflow-x-auto scrollbar-hide'
              ref={categoryContainerRef}
              onMouseEnter={() => setIsCategoryHovered(true)}
              onMouseLeave={() => setIsCategoryHovered(false)}
              style={{
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <div className='flex gap-2 min-w-max pb-2'>
                {categories.map((label, idx) => {
                  const isActive = idx === displayPage;
                  return (
                    <button
                      key={label}
                      ref={(el) => {
                        buttonRefs.current[idx] = el;
                      }}
                      onClick={() => handleCategoryClick(idx)}
                      className={`min-w-[64px] sm:min-w-[80px] relative py-2 sm:py-2.5 px-2 sm:px-3 text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0 text-center rounded-t-lg active:scale-95
                        ${isActive
                          ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                          : 'text-gray-700 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400 hover:bg-gray-50 dark:hover:bg-white/5'
                        }
                      `.trim()}
                    >
                      {label}
                      {isActive && (
                        <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 dark:bg-green-400 rounded-full' />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* 向上/向下按钮 */}
            <button
              className='shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-gray-700 hover:text-green-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-green-400 dark:hover:bg-white/20 transition-all duration-200 hover:scale-105 active:scale-95 transform translate-y-[-4px]'
              onClick={() => {
                // 切换集数排序（正序/倒序）
                setDescending((prev) => !prev);
              }}
            >
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4'
                />
              </svg>
            </button>
          </div>

          {/* 集数网格 */}
          <div className='flex flex-wrap gap-2 sm:gap-3 overflow-y-auto flex-1 content-start pb-4 px-1'>
            {(() => {
              const len = currentEnd - currentStart + 1;
              const episodes = Array.from({ length: len }, (_, i) =>
                descending ? currentEnd - i : currentStart + i
              );
              return episodes;
            })().map((episodeNumber) => {
              const isActive = episodeNumber === value;
              // 获取 TMDB 分集信息
              const tmdbEpisode = tmdbEpisodes?.find(ep => ep.episodeNumber === episodeNumber);
              const hasTooltip = tmdbEpisode?.name && tmdbEpisode.name !== `第 ${episodeNumber} 集` && tmdbEpisode.name !== `Episode ${episodeNumber}`;

              return (
                <EpisodeButton
                  key={episodeNumber}
                  episodeNumber={episodeNumber}
                  isActive={isActive}
                  title={episodes_titles?.[episodeNumber - 1]}
                  tmdbEpisodeName={hasTooltip ? tmdbEpisode?.name : undefined}
                  onClick={() => handleEpisodeClick(episodeNumber)}
                  portalContainer={portalContainer}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 换源 Tab 内容 */}
      {activeTab === 'sources' && (
        <div className='flex flex-col h-full mt-4'>
          {/* 标题栏和刷新按钮 */}
          <div className='flex items-center justify-between mb-3 px-2'>
            <h3 className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
              选源 {availableSources.length > 0 && !sourceSearchLoading && (
                <span className='text-xs text-gray-500 dark:text-gray-400 ml-1'>
                  ({availableSources.length})
                </span>
              )}
            </h3>
            <div className='flex items-center gap-2'>
              {onRefreshSources && (
                <button
                  onClick={onRefreshSources}
                  disabled={sourceSearchLoading}
                  className='group relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95'
                  title='刷新搜索源'
                >
                  <div className='absolute inset-0 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors duration-200'></div>
                  <svg
                    className={`relative z-10 w-3.5 h-3.5 ${sourceSearchLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'}`}
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                    />
                  </svg>
                  <span className='relative z-10'>刷新</span>
                </button>
              )}

              {availableSources.length > 0 && (
                <button
                  onClick={testAllSources}
                  disabled={manualTesting}
                  className='group relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'
                  title='测速所有播放源'
                >
                  <div className='absolute inset-0 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg group-hover:bg-green-50 dark:group-hover:bg-green-900/20 transition-colors duration-200'></div>
                  <Gauge className='relative z-10 w-3.5 h-3.5' />
                  <span className='relative z-10'>{manualTesting ? '测速中...' : '测速'}</span>
                </button>
              )}
            </div>
          </div>

          {manualTesting && (
            <div className='mb-3 px-2'>
              <div className='flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-2 dark:border-blue-700/60 dark:bg-blue-900/20'>
                <RefreshCw className='h-4 w-4 animate-spin text-blue-600 dark:text-blue-400' />
                <div className='h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
                  <div
                    className='h-full bg-linear-to-r from-blue-500 to-cyan-500 transition-all duration-300'
                    style={{
                      width: `${manualProgress.total > 0 ? (manualProgress.done / manualProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className='font-mono text-xs text-gray-600 dark:text-gray-400'>
                  {manualProgress.done}/{manualProgress.total}
                </span>
              </div>
            </div>
          )}

          {sourceSearchLoading && (
            <div className='flex items-center justify-center py-8'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
              <span className='ml-2 text-sm text-gray-600 dark:text-gray-300'>
                搜索中...
              </span>
            </div>
          )}

          {sourceSearchError && (
            <div className='flex items-center justify-center py-8'>
              <div className='text-center'>
                <div className='text-red-500 text-2xl mb-2'>⚠️</div>
                <p className='text-sm text-red-600 dark:text-red-400'>
                  {sourceSearchError}
                </p>
              </div>
            </div>
          )}

          {!sourceSearchLoading &&
            !sourceSearchError &&
            availableSources.length === 0 && (
              <div className='flex items-center justify-center py-8'>
                <div className='text-center'>
                  <div className='text-gray-400 text-2xl mb-2'>📺</div>
                  <p className='text-sm text-gray-600 dark:text-gray-300'>
                    暂无可用的换源
                  </p>
                </div>
              </div>
            )}

          {!sourceSearchLoading &&
            !sourceSearchError &&
            availableSources.length > 0 && (
              <div className={`flex-1 overflow-y-auto space-y-2 sm:space-y-3 pb-20 ${inModal ? 'px-8' : 'px-1'}`}>
                {availableSources
                  .sort((a, b) => {
                    const aIsCurrent =
                      a.source?.toString() === currentSource?.toString() &&
                      a.id?.toString() === currentId?.toString();
                    const bIsCurrent =
                      b.source?.toString() === currentSource?.toString() &&
                      b.id?.toString() === currentId?.toString();
                    if (aIsCurrent && !bIsCurrent) return -1;
                    if (!aIsCurrent && bIsCurrent) return 1;
                    return 0;
                  })
                  .map((source, index) => {
                    const isCurrentSource =
                      source.source?.toString() === currentSource?.toString() &&
                      source.id?.toString() === currentId?.toString();
                    return (
                      <div
                        key={`${source.source}-${source.id}`}
                        onClick={() =>
                          !isCurrentSource && handleSourceClick(source)
                        }
                        className={`group flex items-start gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-3 rounded-xl transition-all select-none duration-200 relative overflow-hidden active:scale-[0.98]
                      ${isCurrentSource
                            ? 'bg-linear-to-r from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/30 dark:via-emerald-900/30 dark:to-teal-900/30 border-2 border-green-500/50 dark:border-green-400/50 shadow-lg shadow-green-500/10'
                            : 'bg-linear-to-r from-gray-50 to-gray-100/50 dark:from-white/5 dark:to-white/10 hover:from-blue-50 hover:to-cyan-50 dark:hover:from-blue-900/20 dark:hover:to-cyan-900/20 hover:scale-[1.02] hover:shadow-md cursor-pointer border border-gray-200/50 dark:border-white/10'
                          }`.trim()}
                      >
                        {/* 封面 */}
                        <div className='shrink-0 w-10 h-16 sm:w-12 sm:h-20 bg-linear-to-br from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-200'>
                          {source.episodes && source.episodes.length > 0 && (
                            <img
                              src={processImageUrl(source.poster)}
                              alt={source.title}
                              className='w-full h-full object-cover'
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          )}
                        </div>

                        {/* 信息区域 */}
                        <div className='flex-1 min-w-0 flex flex-col justify-between h-16 sm:h-20 relative'>
                          {/* 标题 - 顶部 */}
                          <div className='flex items-start gap-2 sm:gap-3 h-5 sm:h-6'>
                            <div className='flex-1 min-w-0 relative'>
                              <h3
                                className='font-medium text-sm sm:text-base truncate text-gray-900 dark:text-gray-100 leading-none peer'
                              >
                                {source.title}
                              </h3>
                              {/* 增强的 tooltip */}
                              <div
                                className='absolute top-full left-0 mt-2 px-3 py-2 bg-linear-to-br from-gray-800 to-gray-900 text-white text-xs rounded-lg shadow-xl border border-white/10 opacity-0 invisible peer-hover:opacity-100 peer-hover:visible transition-all duration-200 ease-out delay-100 pointer-events-none z-9999 backdrop-blur-sm'
                                style={{
                                  width: 'max-content',
                                  maxWidth: 'min(90vw, 12em)',
                                  whiteSpace: 'normal',
                                  wordBreak: 'break-word',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  textWrap: 'balance',
                                } as React.CSSProperties}
                              >
                                <span className='font-medium leading-relaxed block text-center' style={{ textWrap: 'balance' } as React.CSSProperties}>{source.title}</span>
                                <div
                                  className='absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-800'
                                ></div>
                              </div>
                            </div>
                          </div>

                          {/* 源名称和集数信息 - 垂直居中 */}
                          <div className='flex items-center justify-between gap-2'>
                            <div className='flex items-center gap-1'>
                              <span className='text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 border border-gray-500/60 rounded text-gray-700 dark:text-gray-300'>
                                {source.source_name}
                              </span>
                              {/* 当前源标记 - 紧跟源名称后 */}
                              {isCurrentSource && (
                                <div className='flex items-center gap-0.5 shrink-0'>
                                  {/* 动感小箭头 - 指向左边（源名称） */}
                                  <div className='text-green-500 animate-pulse -mr-0.5'>
                                    <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
                                      <path fillRule='evenodd' d='M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z' clipRule='evenodd' />
                                    </svg>
                                  </div>
                                  {/* 标签 */}
                                  <div className='relative'>
                                    <div className='absolute inset-0 bg-green-500 rounded-full blur-[3px] opacity-50 animate-pulse'></div>
                                    <div className='relative bg-linear-to-r from-green-500 to-emerald-500 text-white text-xs px-2.5 py-1 rounded-full font-semibold shadow-lg'>
                                      当前源
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {source.episodes.length > 1 && (
                              <span className='text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium'>
                                {source.episodes.length} 集
                              </span>
                            )}
                          </div>

                          {/* 网络信息 - 底部 */}
                          <div className='flex items-end h-5 sm:h-6'>
                            {(() => {
                              const sourceKey = `${source.source}-${source.id}`;
                              const videoInfo = videoInfoMap.get(sourceKey);
                              const isTesting = testingSourceKeys.has(sourceKey);

                              if (isTesting) {
                                return (
                                  <div className='text-blue-600 dark:text-blue-400 font-medium text-[10px] sm:text-xs animate-pulse'>
                                    正在测速...
                                  </div>
                                );
                              }

                              if (videoInfo) {
                                if (videoInfo.hasError || videoInfo.status === 'failed') {
                                  return (
                                    <div
                                      className='text-red-500/90 dark:text-red-400 font-medium text-[10px] sm:text-xs'
                                      title={videoInfo.message}
                                    >
                                      {videoInfo.message || '测速失败'}
                                    </div>
                                  );
                                }

                                if (!videoInfo.hasError) {
                                  return (
                                    <div className='flex items-end gap-2 sm:gap-3'>
                                      <div className='text-green-600 dark:text-green-400 font-medium text-[10px] sm:text-xs'>
                                        {videoInfo.loadSpeed}
                                      </div>
                                      <div className='text-orange-600 dark:text-orange-400 font-medium text-[10px] sm:text-xs'>
                                        {videoInfo.pingTime}ms
                                      </div>
                                    </div>
                                  );
                                }
                              }

                              return null;
                            })()}
                          </div>

                          {(() => {
                            const sourceKey = `${source.source}-${source.id}`;
                            const videoInfo = videoInfoMap.get(sourceKey);
                            const isTesting = testingSourceKeys.has(sourceKey);

                            if (isTesting) {
                              return (
                                <div className='absolute bottom-0 right-0 flex items-center gap-1 bg-blue-500/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-xs shrink-0'>
                                  <RefreshCw className='w-3 h-3 animate-spin' />
                                  <span>检测中</span>
                                </div>
                              );
                            }

                            if (!videoInfo) return null;

                            if (videoInfo.hasError || videoInfo.status === 'failed') {
                              return (
                                <div className='absolute bottom-0 right-0 bg-red-500/10 dark:bg-red-400/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded text-xs shrink-0 min-w-[60px] text-center'>
                                  检测失败
                                </div>
                              );
                            }

                            if (videoInfo.quality !== '未知') {
                              const isUltraHigh = ['4K', '2K'].includes(videoInfo.quality);
                              const isHigh = ['1080p', '720p'].includes(videoInfo.quality);
                              const isStandard = ['480p', 'SD'].includes(videoInfo.quality);

                              const bgColor = isUltraHigh
                                ? 'bg-purple-500/10 dark:bg-purple-400/20'
                                : isHigh
                                  ? 'bg-green-500/10 dark:bg-green-400/20'
                                  : isStandard
                                    ? 'bg-yellow-500/10 dark:bg-yellow-400/20'
                                    : 'bg-gray-500/10 dark:bg-gray-400/20';
                              const textColor = isUltraHigh
                                ? 'text-purple-600 dark:text-purple-400'
                                : isHigh
                                  ? 'text-green-600 dark:text-green-400'
                                  : isStandard
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-gray-600 dark:text-gray-400';

                              return (
                                <div className={`absolute bottom-0 right-0 flex items-center gap-1 ${bgColor} ${textColor} px-2 py-0.5 rounded text-xs shrink-0 font-semibold`}>
                                  <Wifi className='w-3 h-3' />
                                  <span>{videoInfo.quality}</span>
                                </div>
                              );
                            }

                            if (videoInfo.status === 'ok' || videoInfo.playable) {
                              return (
                                <div className='absolute bottom-0 right-0 flex items-center gap-1 bg-green-500/10 dark:bg-green-400/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded text-xs shrink-0'>
                                  <Wifi className='w-3 h-3' />
                                  <span>已连通</span>
                                </div>
                              );
                            }

                            return null;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                <div className='shrink-0 mt-auto pt-2 border-t border-gray-400 dark:border-gray-700'>
                  <button
                    onClick={() => {
                      if (videoTitle) {
                        // 使用 startTransition 优化导航性能
                        startTransition(() => {
                          router.push(
                            `/search?q=${encodeURIComponent(videoTitle)}`
                          );
                        });
                      }
                    }}
                    className='w-full text-center text-xs text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors py-2'
                  >
                    影片匹配有误？点击去搜索
                  </button>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default EpisodeSelector;
