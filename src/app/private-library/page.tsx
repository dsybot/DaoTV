/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

'use client';

import { ArrowDownWideNarrow, ArrowUpNarrowWide, Film } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { base58Encode } from '@/lib/utils';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

interface EmbySourceOption {
  key: string;
  name: string;
}

interface Video {
  id: string;
  folder?: string;
  tmdbId?: number;
  title: string;
  poster: string;
  releaseDate?: string;
  year?: string;
  overview?: string;
  voteAverage?: number;
  rating?: number;
  mediaType: 'movie' | 'tv';
}

interface EmbyView {
  id: string;
  name: string;
  type: string;
}

export default function PrivateLibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 获取运行时配置
  const runtimeConfig = useMemo(() => {
    if (typeof window !== 'undefined' && (window as any).RUNTIME_CONFIG) {
      return (window as any).RUNTIME_CONFIG;
    }
    return { EMBY_ENABLED: false };
  }, []);

  // 解析URL中的source参数（支持 emby:emby1 格式）
  const parseSourceParam = (sourceParam: string | null): { embyKey?: string } => {
    if (!sourceParam) return {};

    if (sourceParam.includes(':')) {
      const [, key] = sourceParam.split(':');
      return { embyKey: key };
    }

    return {};
  };

  const [embyKey, setEmbyKey] = useState<string | undefined>();
  const [embySourceOptions, setEmbySourceOptions] = useState<EmbySourceOption[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [embyViews, setEmbyViews] = useState<EmbyView[]>([]);
  const [selectedView, setSelectedView] = useState<string>('all');
  const [loadingViews, setLoadingViews] = useState(false);
  // Emby排序状态
  const [sortBy, setSortBy] = useState<string>('SortName');
  const [sortOrder, setSortOrder] = useState<'Ascending' | 'Descending'>('Ascending');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortDropdownPosition, setSortDropdownPosition] = useState<{ x: number; y: number; width: number }>({ x: 0, y: 0, width: 0 });
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const pageSize = 20;
  const observerTarget = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // 搜索状态
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 初始化：从URL读取source参数
  useEffect(() => {
    const sourceParam = searchParams.get('source');
    const { embyKey: parsedEmbyKey } = parseSourceParam(sourceParam);
    setEmbyKey(parsedEmbyKey);
  }, [searchParams]);

  // 获取 Emby 源列表
  useEffect(() => {
    if (!runtimeConfig.EMBY_ENABLED) return;

    const fetchEmbySources = async () => {
      try {
        const response = await fetch('/api/emby/sources');
        const data = await response.json();
        if (data.sources && data.sources.length > 0) {
          setEmbySourceOptions(data.sources);
          // 如果没有指定 embyKey，自动选择第一个源
          if (!embyKey) {
            setEmbyKey(data.sources[0].key);
          }
        }
      } catch (error) {
        console.error('获取 Emby 源列表失败:', error);
      }
    };

    fetchEmbySources();
  }, [runtimeConfig.EMBY_ENABLED, embyKey]);

  // 获取 Emby 媒体库列表
  useEffect(() => {
    if (!runtimeConfig.EMBY_ENABLED) return;

    const fetchEmbyViews = async () => {
      setLoadingViews(true);
      try {
        const params = new URLSearchParams();
        if (embyKey) params.append('embyKey', embyKey);

        const response = await fetch(`/api/emby/views?${params.toString()}`);
        const data = await response.json();

        if (data.success && data.views) {
          setEmbyViews(data.views);
        }
      } catch (error) {
        console.error('获取 Emby 媒体库失败:', error);
      } finally {
        setLoadingViews(false);
      }
    };

    fetchEmbyViews();
  }, [runtimeConfig.EMBY_ENABLED, embyKey]);

  // 获取 Emby 列表
  const fetchEmbyList = async (pageNum: number, append = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError('');

      const params = new URLSearchParams({
        page: pageNum.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
      });

      if (selectedView !== 'all') {
        params.append('parentId', selectedView);
      }

      if (embyKey) {
        params.append('embyKey', embyKey);
      }

      const response = await fetch(`/api/emby/list?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('获取列表失败');
      }

      const data = await response.json();

      if (data.list && Array.isArray(data.list)) {
        const newVideos = data.list.map((item: any) => ({
          id: item.id,
          title: item.title,
          poster: item.poster,
          year: item.year,
          rating: item.rating,
          mediaType: item.mediaType,
        }));

        if (append) {
          setVideos((prev) => [...prev, ...newVideos]);
        } else {
          setVideos(newVideos);
        }

        setHasMore(pageNum < data.totalPages);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('获取 Emby 列表失败:', error);
      setError('获取列表失败，请稍后重试');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  };

  // 当 embyKey、selectedView、sortBy、sortOrder 变化时重新加载
  useEffect(() => {
    if (!runtimeConfig.EMBY_ENABLED) return;

    setPage(1);
    setVideos([]);
    setHasMore(true);
    fetchEmbyList(1, false);
  }, [runtimeConfig.EMBY_ENABLED, embyKey, selectedView, sortBy, sortOrder]);

  // 无限滚动
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingRef.current) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchEmbyList(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, loading, loadingMore, page]);

  // 排序选项
  const sortOptions = [
    { value: 'SortName', label: '名称', icon: ArrowUpNarrowWide },
    { value: 'DateCreated', label: '添加时间', icon: ArrowDownWideNarrow },
    { value: 'PremiereDate', label: '上映时间', icon: ArrowDownWideNarrow },
  ];

  // 切换排序顺序
  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'Ascending' ? 'Descending' : 'Ascending'));
  };

  // Emby搜索处理函数
  const handleEmbySearch = async () => {
    if (!searchKeyword.trim()) return;

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        keyword: searchKeyword,
      });
      if (embyKey) {
        params.append('embyKey', embyKey);
      }

      const response = await fetch(`/api/emby/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error('搜索失败');
      }

      const data = await response.json();
      if (data.error) {
        setError(data.error);
        setSearchResults([]);
      } else {
        setSearchResults(data.videos || []);
      }
    } catch (err) {
      console.error('搜索失败:', err);
      setError('搜索失败');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 处理视频卡片点击
  const handleVideoClick = (video: Video) => {
    const sourceParam = embyKey ? `emby_${embyKey}` : 'emby';
    router.push(`/play?source=${sourceParam}&id=${video.id}&title=${encodeURIComponent(video.title)}`);
  };

  if (!mounted) {
    return null;
  }

  if (!runtimeConfig.EMBY_ENABLED) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Film className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Emby功能未启用</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-6">
        {/* 标题和源选择 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-4">Emby</h1>

          {/* Emby 源选择 */}
          {embySourceOptions.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">选择 Emby 源</label>
              <select
                value={embyKey || ''}
                onChange={(e) => {
                  const newKey = e.target.value || undefined;
                  setEmbyKey(newKey);
                  const sourceParam = newKey ? `emby:${newKey}` : 'emby';
                  router.push(`/private-library?source=${sourceParam}`);
                }}
                className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
              >
                {embySourceOptions.map((source) => (
                  <option key={source.key} value={source.key}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 媒体库筛选 */}
          {embyViews.length > 0 && (
            <div className="mb-4">
              <CapsuleSwitch
                options={[
                  { value: 'all', label: '全部' },
                  ...embyViews.map((view) => ({
                    value: view.id,
                    label: view.name,
                  })),
                ]}
                active={selectedView}
                onChange={setSelectedView}
              />
            </div>
          )}

          {/* 排序选择和搜索 */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  ref={sortButtonRef}
                  onClick={() => {
                    if (sortButtonRef.current) {
                      const rect = sortButtonRef.current.getBoundingClientRect();
                      setSortDropdownPosition({
                        x: rect.left,
                        y: rect.bottom + 8,
                        width: rect.width,
                      });
                    }
                    setShowSortDropdown(!showSortDropdown);
                  }}
                  className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 flex items-center gap-2"
                >
                  {sortOptions.find((opt) => opt.value === sortBy)?.label || '排序'}
                </button>

                {showSortDropdown && (
                  <div
                    ref={sortDropdownRef}
                    className="fixed z-50 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg py-2"
                    style={{
                      left: `${sortDropdownPosition.x}px`,
                      top: `${sortDropdownPosition.y}px`,
                      minWidth: `${sortDropdownPosition.width}px`,
                    }}
                  >
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setShowSortDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={toggleSortOrder}
                className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
              >
                {sortOrder === 'Ascending' ? '升序' : '降序'}
              </button>
            </div>

            {/* 搜索框 */}
            <div className="relative w-full md:w-auto md:min-w-[300px]">
              <input
                type="text"
                placeholder="搜索视频..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchKeyword.trim()) {
                    handleEmbySearch();
                  }
                }}
                className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchKeyword ? (
                <button
                  onClick={() => {
                    setSearchKeyword('');
                    setSearchResults([]);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleEmbySearch}
                  disabled={!searchKeyword.trim() || isSearching}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-500">加载中...</p>
            </div>
          </div>
        )}

        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                搜索结果 ({searchResults.length})
              </h3>
              <button
                onClick={() => {
                  setSearchKeyword('');
                  setSearchResults([]);
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                清除搜索
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {searchResults.map((video) => (
                <div key={video.id} onClick={() => handleVideoClick(video)}>
                  <VideoCard
                    id={video.id}
                    title={video.title}
                    poster={video.poster}
                    year={video.year}
                    source={embyKey ? `emby_${embyKey}` : 'emby'}
                    from="search"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 视频列表 */}
        {!loading && videos.length > 0 && searchResults.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {videos.map((video) => (
              <div key={video.id} onClick={() => handleVideoClick(video)}>
                <VideoCard
                  id={video.id}
                  title={video.title}
                  poster={video.poster}
                  year={video.year}
                  source={embyKey ? `emby_${embyKey}` : 'emby'}
                  from="search"
                />
              </div>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {!loading && videos.length === 0 && !error && (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <Film className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">暂无内容</p>
            </div>
          </div>
        )}

        {/* 加载更多 */}
        {loadingMore && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* 无限滚动触发器 */}
        <div ref={observerTarget} className="h-4" />
      </div>
    </PageLayout>
  );
}
