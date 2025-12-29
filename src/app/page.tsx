/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { ChevronRight, Film, Tv, Calendar, Sparkles, Play } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

import {
  BangumiCalendarData,
  GetBangumiCalendarData,
} from '@/lib/bangumi.client';
import { getRecommendedShortDramas } from '@/lib/shortdrama.client';
import { cleanExpiredCache } from '@/lib/shortdrama-cache';
import { ShortDramaItem, ReleaseCalendarItem } from '@/lib/types';
// 客户端收藏 API
import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import ContinueWatching from '@/components/ContinueWatching';
import HomeCarousel from '@/components/HomeCarousel';
import PageLayout from '@/components/PageLayout';
import ScrollableRow from '@/components/ScrollableRow';
import SectionTitle from '@/components/SectionTitle';
import ShortDramaCard from '@/components/ShortDramaCard';
import SkeletonCard from '@/components/SkeletonCard';
import { useSite } from '@/components/SiteProvider';
import { TelegramWelcomeModal } from '@/components/TelegramWelcomeModal';
import VideoCard from '@/components/VideoCard';

function HomeClient() {
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>([]);
  const [hotShortDramas, setHotShortDramas] = useState<ShortDramaItem[]>([]);
  const [bangumiCalendarData, setBangumiCalendarData] = useState<
    BangumiCalendarData[]
  >([]);
  const [upcomingReleases, setUpcomingReleases] = useState<ReleaseCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { announcement, enableTMDBCarousel } = useSite();
  const [username, setUsername] = useState<string>('');
  const [layoutMode, setLayoutMode] = useState<'sidebar' | 'top'>('top');

  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);

  // 合并初始化逻辑 - 优化性能，减少重渲染
  useEffect(() => {
    // 获取用户名
    const authInfo = getAuthInfoFromBrowserCookie();
    if (authInfo?.username) {
      setUsername(authInfo.username);
    }

    // 读取布局模式
    if (typeof window !== 'undefined') {
      const savedLayout = localStorage.getItem('layoutMode');
      // 兼容旧版本的 'bottom' 值
      if (savedLayout === 'bottom') {
        setLayoutMode('top');
        localStorage.setItem('layoutMode', 'top');
      } else if (savedLayout === 'sidebar' || savedLayout === 'top') {
        setLayoutMode(savedLayout as 'sidebar' | 'top');
      } else {
        // 如果没有保存过布局模式，设置默认值为顶栏模式
        setLayoutMode('top');
        localStorage.setItem('layoutMode', 'top');
      }
    }

    // 检查公告弹窗状态
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      } else {
        setShowAnnouncement(Boolean(!hasSeenAnnouncement && announcement));
      }
    }
  }, [announcement]);

  // 监听布局模式变化（仅跨标签页）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'layoutMode') {
        // 兼容旧版本的 'bottom' 值
        if (e.newValue === 'bottom') {
          setLayoutMode('top');
          localStorage.setItem('layoutMode', 'top');
        } else if (e.newValue === 'sidebar' || e.newValue === 'top') {
          setLayoutMode(e.newValue as 'sidebar' | 'top');
        }
      }
    };

    // 监听 storage 事件（跨标签页）
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 欢迎提示窗 - 每次打开网站时显示一次（关闭浏览器标签页后重新打开才再次显示）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasShownWelcome = sessionStorage.getItem('hasShownWelcome');

      // 如果本次会话还没有显示过欢迎弹窗，则显示
      if (!hasShownWelcome) {
        setShowWelcomeToast(true);
        sessionStorage.setItem('hasShownWelcome', 'true');

        // 3秒后自动消失
        const timer = setTimeout(() => {
          setShowWelcomeToast(false);
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, []);


  // 收藏夹数据
  type FavoriteItem = {
    id: string;
    source: string;
    title: string;
    poster: string;
    episodes: number;
    source_name: string;
    currentEpisode?: number;
    search_title?: string;
    origin?: 'vod' | 'live' | 'shortdrama';
    type?: string;
    save_time: number;
    releaseDate?: string;
    remarks?: string;
  };

  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [favoriteFilter, setFavoriteFilter] = useState<'all' | 'movie' | 'tv' | 'shortdrama' | 'live' | 'variety' | 'anime'>('all');
  const [favoriteSortBy, setFavoriteSortBy] = useState<'recent' | 'title'>('recent');
  const [upcomingFilter, setUpcomingFilter] = useState<'all' | 'movie' | 'tv'>('all');

  useEffect(() => {
    // 清理过期缓存
    cleanExpiredCache().catch(console.error);

    const fetchRecommendData = async () => {
      try {
        setLoading(true);

        // 并行获取热门电影、热门剧集、热门综艺、热门短剧和即将上映
        const [moviesData, tvShowsData, varietyShowsData, shortDramasData, bangumiCalendarData, upcomingReleasesData] =
          await Promise.allSettled([
            getDoubanCategories({
              kind: 'movie',
              category: '热门',
              type: '全部',
            }),
            getDoubanCategories({ kind: 'tv', category: 'tv', type: 'tv' }),
            getDoubanCategories({ kind: 'tv', category: 'show', type: 'show' }),
            getRecommendedShortDramas(undefined, 8),
            GetBangumiCalendarData(),
            fetch('/api/release-calendar?limit=100').then(res => {
              if (!res.ok) {
                console.error('获取即将上映数据失败，状态码:', res.status);
                return { items: [] };
              }
              return res.json();
            }),
          ]);

        // 处理电影数据
        if (moviesData.status === 'fulfilled' && moviesData.value?.code === 200) {
          setHotMovies(moviesData.value.list);
        } else {
          console.warn('获取热门电影失败:', moviesData.status === 'rejected' ? moviesData.reason : '数据格式错误');
        }

        // 处理剧集数据
        if (tvShowsData.status === 'fulfilled' && tvShowsData.value?.code === 200) {
          setHotTvShows(tvShowsData.value.list);
        } else {
          console.warn('获取热门剧集失败:', tvShowsData.status === 'rejected' ? tvShowsData.reason : '数据格式错误');
        }

        // 处理综艺数据
        if (varietyShowsData.status === 'fulfilled' && varietyShowsData.value?.code === 200) {
          setHotVarietyShows(varietyShowsData.value.list);
        } else {
          console.warn('获取热门综艺失败:', varietyShowsData.status === 'rejected' ? varietyShowsData.reason : '数据格式错误');
        }

        // 处理短剧数据
        if (shortDramasData.status === 'fulfilled') {
          setHotShortDramas(shortDramasData.value);
        } else {
          console.warn('获取热门短剧失败:', shortDramasData.reason);
          setHotShortDramas([]);
        }

        // 处理bangumi数据，防止接口失败导致页面崩溃
        if (bangumiCalendarData.status === 'fulfilled' && Array.isArray(bangumiCalendarData.value)) {
          setBangumiCalendarData(bangumiCalendarData.value);
        } else {
          console.warn('Bangumi接口失败或返回数据格式错误:',
            bangumiCalendarData.status === 'rejected' ? bangumiCalendarData.reason : '数据格式错误');
          setBangumiCalendarData([]);
        }

        // 处理即将上映数据
        if (upcomingReleasesData.status === 'fulfilled' && upcomingReleasesData.value?.items) {
          const releases = upcomingReleasesData.value.items;
          console.log('📅 获取到的即将上映数据:', releases.length, '条');

          // 过滤出即将上映和刚上映的作品（过去7天到未来90天）
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const ninetyDaysLater = new Date(today);
          ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);

          console.log('📅 7天前日期:', sevenDaysAgo.toISOString().split('T')[0]);
          console.log('📅 今天日期:', today.toISOString().split('T')[0]);
          console.log('📅 90天后日期:', ninetyDaysLater.toISOString().split('T')[0]);

          const upcoming = releases.filter((item: ReleaseCalendarItem) => {
            // 修复时区问题：使用字符串比较而不是Date对象比较
            const releaseDateStr = item.releaseDate; // 格式: "2025-11-07"
            const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
            const ninetyDaysStr = ninetyDaysLater.toISOString().split('T')[0];
            const isUpcoming = releaseDateStr >= sevenDaysAgoStr && releaseDateStr <= ninetyDaysStr;
            return isUpcoming;
          });

          console.log('📅 日期过滤后的数据:', upcoming.length, '条');
          console.log('📅 过滤后的标题:', upcoming.map((i: ReleaseCalendarItem) => `${i.title} (${i.releaseDate})`));

          // 智能去重：识别同系列内容（如"XX"和"XX第二季"）以及副标题（如"过关斩将：猎杀游戏"和"猎杀游戏"）
          const normalizeTitle = (title: string): string => {
            // 先统一冒号格式
            let normalized = title.replace(/：/g, ':').trim();

            // 处理副标题：如果有冒号，取冒号后的部分（主标题）
            // 例如 "过关斩将:猎杀游戏" -> "猎杀游戏"
            if (normalized.includes(':')) {
              const parts = normalized.split(':').map(p => p.trim());
              // 取最后一部分作为主标题（通常主标题在冒号后面）
              normalized = parts[parts.length - 1];
            }

            // 再移除季数、集数等后缀和空格
            normalized = normalized
              .replace(/第[一二三四五六七八九十\d]+季/g, '')
              .replace(/[第]?[一二三四五六七八九十\d]+季/g, '')
              .replace(/Season\s*\d+/gi, '')
              .replace(/S\d+/gi, '')
              .replace(/\s+\d+$/g, '') // 移除末尾数字
              .replace(/\s+/g, '') // 移除所有空格
              .trim();

            return normalized;
          };

          // 去重：基于标题去重，保留最早的那条记录
          const uniqueUpcoming = upcoming.reduce((acc: ReleaseCalendarItem[], current: ReleaseCalendarItem) => {
            const normalizedCurrent = normalizeTitle(current.title);

            // 先检查精确匹配
            const exactMatch = acc.find(item => item.title === current.title);
            if (exactMatch) {
              // 精确匹配：保留上映日期更早的
              const existingIndex = acc.findIndex(item => item.title === current.title);
              if (new Date(current.releaseDate) < new Date(exactMatch.releaseDate)) {
                acc[existingIndex] = current;
              }
              return acc;
            }

            // 再检查归一化后的模糊匹配（识别同系列）
            const similarMatch = acc.find(item => {
              const normalizedExisting = normalizeTitle(item.title);
              return normalizedCurrent === normalizedExisting;
            });

            if (similarMatch) {
              // 模糊匹配：优先保留没有"第X季"标记的原版
              const existingIndex = acc.findIndex(item => normalizeTitle(item.title) === normalizedCurrent);
              const currentHasSeason = /第[一二三四五六七八九十\d]+季|Season\s*\d+|S\d+/i.test(current.title);
              const existingHasSeason = /第[一二三四五六七八九十\d]+季|Season\s*\d+|S\d+/i.test(similarMatch.title);

              // 如果当前没有季数标记，而已存在的有，则替换
              if (!currentHasSeason && existingHasSeason) {
                acc[existingIndex] = current;
              }
              // 如果都有季数标记或都没有，则保留日期更早的
              else if (currentHasSeason === existingHasSeason) {
                if (new Date(current.releaseDate) < new Date(similarMatch.releaseDate)) {
                  acc[existingIndex] = current;
                }
              }
              // 如果当前有季数标记而已存在的没有，则保留已存在的（不替换）
              return acc;
            }

            // 没有匹配，添加新项
            acc.push(current);
            return acc;
          }, []);

          console.log('📅 去重后的即将上映数据:', uniqueUpcoming.length, '条');

          // 智能分配：按更细的时间段分类，确保时间分散
          const todayStr = today.toISOString().split('T')[0];
          const sevenDaysLaterStr = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const thirtyDaysLaterStr = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          // 更细致的时间段划分
          const recentlyReleased = uniqueUpcoming.filter((i: ReleaseCalendarItem) => i.releaseDate < todayStr); // 已上映
          const releasingToday = uniqueUpcoming.filter((i: ReleaseCalendarItem) => i.releaseDate === todayStr); // 今日上映
          const nextSevenDays = uniqueUpcoming.filter((i: ReleaseCalendarItem) => i.releaseDate > todayStr && i.releaseDate <= sevenDaysLaterStr); // 未来7天
          const nextThirtyDays = uniqueUpcoming.filter((i: ReleaseCalendarItem) => i.releaseDate > sevenDaysLaterStr && i.releaseDate <= thirtyDaysLaterStr); // 8-30天
          const laterReleasing = uniqueUpcoming.filter((i: ReleaseCalendarItem) => i.releaseDate > thirtyDaysLaterStr); // 30天后

          // 智能分配：总共10个，按时间段分散选取
          const maxTotal = 10;
          let selectedItems: ReleaseCalendarItem[] = [];

          // 配额分配策略：2已上映 + 1今日(限制) + 4近期(7天) + 2中期(30天) + 1远期
          // 今日上映限制最多3个，避免全是今天的
          const maxTodayLimit = 3;
          const recentQuota = Math.min(2, recentlyReleased.length);
          const todayQuota = Math.min(1, releasingToday.length);
          const sevenDayQuota = Math.min(4, nextSevenDays.length);
          const thirtyDayQuota = Math.min(2, nextThirtyDays.length);
          const laterQuota = Math.min(1, laterReleasing.length);

          selectedItems = [
            ...recentlyReleased.slice(0, recentQuota),
            ...releasingToday.slice(0, todayQuota),
            ...nextSevenDays.slice(0, sevenDayQuota),
            ...nextThirtyDays.slice(0, thirtyDayQuota),
            ...laterReleasing.slice(0, laterQuota),
          ];

          // 如果没填满10个，按优先级补充（但限制今日上映总数）
          if (selectedItems.length < maxTotal) {
            const remaining = maxTotal - selectedItems.length;
            const currentTodayCount = selectedItems.filter((i: ReleaseCalendarItem) => i.releaseDate === todayStr).length;

            // 优先从近期7天补充
            const additionalSeven = nextSevenDays.slice(sevenDayQuota, sevenDayQuota + remaining);
            selectedItems = [...selectedItems, ...additionalSeven];

            // 还不够就从30天内补充
            if (selectedItems.length < maxTotal) {
              const stillRemaining = maxTotal - selectedItems.length;
              const additionalThirty = nextThirtyDays.slice(thirtyDayQuota, thirtyDayQuota + stillRemaining);
              selectedItems = [...selectedItems, ...additionalThirty];
            }

            // 还不够就从远期补充
            if (selectedItems.length < maxTotal) {
              const stillRemaining = maxTotal - selectedItems.length;
              const additionalLater = laterReleasing.slice(laterQuota, laterQuota + stillRemaining);
              selectedItems = [...selectedItems, ...additionalLater];
            }

            // 还不够就从已上映补充
            if (selectedItems.length < maxTotal) {
              const stillRemaining = maxTotal - selectedItems.length;
              const additionalRecent = recentlyReleased.slice(recentQuota, recentQuota + stillRemaining);
              selectedItems = [...selectedItems, ...additionalRecent];
            }

            // 最后实在不够才从今日上映补充（但限制总数不超过maxTodayLimit）
            if (selectedItems.length < maxTotal) {
              const currentTodayCount = selectedItems.filter((i: ReleaseCalendarItem) => i.releaseDate === todayStr).length;
              const todayRemaining = maxTodayLimit - currentTodayCount;
              if (todayRemaining > 0) {
                const stillRemaining = Math.min(maxTotal - selectedItems.length, todayRemaining);
                const additionalToday = releasingToday.slice(todayQuota, todayQuota + stillRemaining);
                selectedItems = [...selectedItems, ...additionalToday];
              }
            }
          }

          console.log('📅 分配结果:', {
            已上映: recentlyReleased.length,
            今日上映: releasingToday.length,
            '7天内': nextSevenDays.length,
            '8-30天': nextThirtyDays.length,
            '30天后': laterReleasing.length,
            最终显示: selectedItems.length
          });

          setUpcomingReleases(selectedItems);
        } else {
          console.warn('获取即将上映数据失败:', upcomingReleasesData.status === 'rejected' ? upcomingReleasesData.reason : '数据格式错误');
          setUpcomingReleases([]);
        }
      } catch (error) {
        console.error('获取推荐数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendData();
  }, []);

  // 处理收藏数据更新的函数
  const updateFavoriteItems = async (allFavorites: Record<string, any>) => {
    const allPlayRecords = await getAllPlayRecords();

    // 根据保存时间排序（从近到远）
    const sorted = Object.entries(allFavorites)
      .sort(([, a], [, b]) => b.save_time - a.save_time)
      .map(([key, fav]) => {
        const plusIndex = key.indexOf('+');
        const source = key.slice(0, plusIndex);
        const id = key.slice(plusIndex + 1);

        // 查找对应的播放记录，获取当前集数
        const playRecord = allPlayRecords[key];
        const currentEpisode = playRecord?.index;

        return {
          id,
          source,
          title: fav.title,
          year: fav.year,
          poster: fav.cover,
          episodes: fav.total_episodes,
          source_name: fav.source_name,
          currentEpisode,
          search_title: fav?.search_title,
          origin: fav?.origin,
          type: fav?.type,
          save_time: fav.save_time,
          releaseDate: fav?.releaseDate,
          remarks: fav?.remarks,
        } as FavoriteItem;
      });
    setFavoriteItems(sorted);
  };

  // 当切换到收藏夹时加载收藏数据
  useEffect(() => {
    if (activeTab !== 'favorites') return;

    const loadFavorites = async () => {
      const allFavorites = await getAllFavorites();
      await updateFavoriteItems(allFavorites);
    };

    loadFavorites();

    // 监听收藏更新事件
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        updateFavoriteItems(newFavorites);
      }
    );

    return unsubscribe;
  }, [activeTab]);

  const handleCloseAnnouncement = (announcement: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', announcement); // 记录已查看弹窗
  };

  return (
    <PageLayout>
      {/* Telegram 新用户欢迎弹窗 */}
      <TelegramWelcomeModal />

      {/* 右侧滑入的欢迎悬浮窗 */}
      <div
        className={`fixed top-20 right-4 z-9999 transition-all duration-500 ease-out ${showWelcomeToast
          ? 'translate-x-0 opacity-100'
          : 'translate-x-[120%] opacity-0 pointer-events-none'
          }`}
      >
        <div className='relative overflow-hidden rounded-xl bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 p-[2px] shadow-2xl'>
          <div className='relative bg-white dark:bg-gray-900 rounded-xl px-5 py-3 backdrop-blur-sm'>
            <div className='flex items-center gap-3'>
              <div className='shrink-0 w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center'>
                <span className='text-xl animate-wave origin-bottom-right'>👋</span>
              </div>
              <div className='flex-1 min-w-0'>
                <div className='text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap'>
                  <span>
                    {(() => {
                      const hour = new Date().getHours();
                      if (hour < 12) return '早上好';
                      if (hour < 18) return '下午好';
                      return '晚上好';
                    })()}
                    {username && '，'}
                  </span>
                  {username && (
                    <span className='text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400'>
                      {username}
                    </span>
                  )}
                </div>
                <p className='text-xs text-gray-600 dark:text-gray-400 mt-0.5'>
                  发现更多精彩影视内容 ✨
                </p>
              </div>
              <button
                onClick={() => setShowWelcomeToast(false)}
                className='shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
                aria-label='关闭'
              >
                <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className='px-2 sm:px-10 py-4 sm:py-8 overflow-visible'>

        {/* 轮播图 - 在所有tab显示（根据配置） */}
        {enableTMDBCarousel && (
          <div className={`mt-8 sm:mt-12 mb-8 ${layoutMode === 'top' ? 'md:-mt-4' : ''}`}>
            <HomeCarousel />
          </div>
        )}

        {/* 顶部 Tab 切换 */}
        <div className='mb-8 flex items-center justify-center'>
          <CapsuleSwitch
            options={[
              { label: '首页', value: 'home' },
              { label: '收藏夹', value: 'favorites' },
            ]}
            active={activeTab}
            onChange={(value) => setActiveTab(value as 'home' | 'favorites')}
          />
        </div>

        <div className='max-w-[95%] mx-auto'>
          {/* 收藏夹视图 */}
          <section className={`mb-8 ${activeTab === 'favorites' ? 'block' : 'hidden'}`}>
            <div className='mb-6 flex items-center justify-between'>
              <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                我的收藏
              </h2>
              {favoriteItems.length > 0 && (
                <button
                  className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                  onClick={async () => {
                    if (confirm('确定要清空所有收藏吗？')) {
                      await clearAllFavorites();
                      setFavoriteItems([]);
                    }
                  }}
                >
                  清空收藏
                </button>
              )}
            </div>

            {/* 统计信息 */}
            {favoriteItems.length > 0 && (() => {
              // 统计（兼容旧数据：没有origin字段的默认为vod）
              const stats = {
                total: favoriteItems.length,
                movie: favoriteItems.filter(item => {
                  const origin = item.origin || 'vod';
                  return origin === 'vod' && item.episodes === 1 && item.type !== 'variety';
                }).length,
                tv: favoriteItems.filter(item => {
                  const origin = item.origin || 'vod';
                  return origin === 'vod' && item.episodes > 1 && item.type !== 'variety' && item.type !== 'anime';
                }).length,
                anime: favoriteItems.filter(item => item.type === 'anime').length,
                shortdrama: favoriteItems.filter(item => item.origin === 'shortdrama' || item.source === 'shortdrama').length,
                live: favoriteItems.filter(item => item.origin === 'live').length,
                variety: favoriteItems.filter(item => item.type === 'variety').length,
              };
              return (
                <div className='mb-4 flex flex-wrap gap-2 text-sm text-gray-600 dark:text-gray-400'>
                  <span className='px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full'>
                    共 <strong className='text-gray-900 dark:text-gray-100'>{stats.total}</strong> 项
                  </span>
                  {stats.movie > 0 && (
                    <span className='px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full'>
                      电影 {stats.movie}
                    </span>
                  )}
                  {stats.tv > 0 && (
                    <span className='px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full'>
                      剧集 {stats.tv}
                    </span>
                  )}
                  {stats.anime > 0 && (
                    <span className='px-3 py-1 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 rounded-full'>
                      动漫 {stats.anime}
                    </span>
                  )}
                  {stats.shortdrama > 0 && (
                    <span className='px-3 py-1 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 rounded-full'>
                      短剧 {stats.shortdrama}
                    </span>
                  )}
                  {stats.live > 0 && (
                    <span className='px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-full'>
                      直播 {stats.live}
                    </span>
                  )}
                  {stats.variety > 0 && (
                    <span className='px-3 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full'>
                      综艺 {stats.variety}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* 筛选标签 */}
            {favoriteItems.length > 0 && (
              <div className='mb-4 flex flex-wrap gap-2'>
                {[
                  { key: 'all' as const, label: '全部', icon: '📚' },
                  { key: 'movie' as const, label: '电影', icon: '🎬' },
                  { key: 'tv' as const, label: '剧集', icon: '📺' },
                  { key: 'anime' as const, label: '动漫', icon: '🎌' },
                  { key: 'shortdrama' as const, label: '短剧', icon: '🎭' },
                  { key: 'live' as const, label: '直播', icon: '📡' },
                  { key: 'variety' as const, label: '综艺', icon: '🎪' },
                ].map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => setFavoriteFilter(key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${favoriteFilter === key
                      ? 'bg-linear-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                  >
                    <span className='mr-1'>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* 排序选项 */}
            {favoriteItems.length > 0 && (
              <div className='mb-4 flex items-center gap-2 text-sm'>
                <span className='text-gray-600 dark:text-gray-400'>排序：</span>
                <div className='flex gap-2'>
                  {[
                    { key: 'recent' as const, label: '最近添加' },
                    { key: 'title' as const, label: '标题 A-Z' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setFavoriteSortBy(key)}
                      className={`px-3 py-1 rounded-md transition-colors ${favoriteSortBy === key
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {favoriteItems.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-16 px-4'>
                <div className='mb-6 relative'>
                  <div className='absolute inset-0 bg-linear-to-r from-pink-300 to-purple-300 dark:from-pink-600 dark:to-purple-600 opacity-20 rounded-full'></div>
                  <svg className='w-32 h-32 relative z-10' viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'>
                    <path d='M100 170C100 170 30 130 30 80C30 50 50 30 70 30C85 30 95 40 100 50C105 40 115 30 130 30C150 30 170 50 170 80C170 130 100 170 100 170Z'
                      className='fill-gray-300 dark:fill-gray-600 stroke-gray-400 dark:stroke-gray-500'
                      strokeWidth='3'
                    />
                    <path d='M100 170C100 170 30 130 30 80C30 50 50 30 70 30C85 30 95 40 100 50C105 40 115 30 130 30C150 30 170 50 170 80C170 130 100 170 100 170Z'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeDasharray='5,5'
                      className='text-gray-400 dark:text-gray-500'
                    />
                  </svg>
                </div>
                <h3 className='text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2'>
                  收藏夹空空如也
                </h3>
                <p className='text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs'>
                  快去发现喜欢的影视作品，点击 ❤️ 添加到收藏吧！
                </p>
              </div>
            ) : (
              <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'>
                {(() => {
                  // 筛选（兼容旧数据：没有origin字段的默认为vod）
                  let filtered = favoriteItems;
                  if (favoriteFilter === 'movie') {
                    filtered = favoriteItems.filter(item => {
                      const origin = item.origin || 'vod'; // 旧数据默认为vod
                      return origin === 'vod' && item.episodes === 1 && item.type !== 'variety';
                    });
                  } else if (favoriteFilter === 'tv') {
                    filtered = favoriteItems.filter(item => {
                      const origin = item.origin || 'vod';
                      return origin === 'vod' && item.episodes > 1 && item.type !== 'variety' && item.type !== 'anime';
                    });
                  } else if (favoriteFilter === 'anime') {
                    filtered = favoriteItems.filter(item => item.type === 'anime');
                  } else if (favoriteFilter === 'shortdrama') {
                    filtered = favoriteItems.filter(item => item.origin === 'shortdrama' || item.source === 'shortdrama');
                  } else if (favoriteFilter === 'live') {
                    filtered = favoriteItems.filter(item => item.origin === 'live');
                  } else if (favoriteFilter === 'variety') {
                    filtered = favoriteItems.filter(item => item.type === 'variety');
                  }

                  // 排序
                  if (favoriteSortBy === 'title') {
                    filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
                  }
                  // 'recent' 已经在 updateFavoriteItems 中按 save_time 排序了

                  return filtered.map((item) => {
                    // 智能计算即将上映状态
                    let calculatedRemarks = item.remarks;

                    if (item.releaseDate) {
                      const now = new Date();
                      now.setHours(0, 0, 0, 0); // 归零时间，只比较日期
                      const releaseDate = new Date(item.releaseDate);
                      const daysDiff = Math.ceil((releaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                      if (daysDiff < 0) {
                        const daysAgo = Math.abs(daysDiff);
                        calculatedRemarks = `已上映${daysAgo}天`;
                      } else if (daysDiff === 0) {
                        calculatedRemarks = '今日上映';
                      } else {
                        calculatedRemarks = `${daysDiff}天后上映`;
                      }
                    }

                    return (
                      <div key={item.id + item.source} className='w-full'>
                        <VideoCard
                          query={item.search_title}
                          {...item}
                          from='favorite'
                          type={item.type || (item.episodes > 1 ? 'tv' : '')}
                          remarks={calculatedRemarks}
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </section>

          {/* 首页视图 - 优化：使用 CSS 控制显示，避免重复挂载 */}
          <div className={activeTab === 'home' ? 'block' : 'hidden'}>
            {/* 继续观看 */}
            <ContinueWatching />

            {/* 即将上映 */}
            {!loading && upcomingReleases.length > 0 && (
              <section className='mb-4 sm:mb-8'>
                <div className='mb-3 sm:mb-4 flex items-center justify-between'>
                  <SectionTitle title="即将上映" icon={Calendar} iconColor="text-orange-500" />
                  <Link
                    href='/release-calendar'
                    className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 ml-1' />
                  </Link>
                </div>

                {/* Tab 切换 */}
                <div className='mb-4 flex gap-2'>
                  {[
                    { key: 'all', label: '全部', count: upcomingReleases.length },
                    { key: 'movie', label: '电影', count: upcomingReleases.filter(r => r.type === 'movie').length },
                    { key: 'tv', label: '电视剧', count: upcomingReleases.filter(r => r.type === 'tv').length },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setUpcomingFilter(key as 'all' | 'movie' | 'tv')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${upcomingFilter === key
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                      {label}
                      {count > 0 && (
                        <span className={`ml-1.5 text-xs ${upcomingFilter === key
                          ? 'text-white/80'
                          : 'text-gray-500 dark:text-gray-400'
                          }`}>
                          ({count})
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <ScrollableRow enableVirtualization={true}>
                  {upcomingReleases
                    .filter(release => upcomingFilter === 'all' || release.type === upcomingFilter)
                    .map((release, index) => {
                      // 计算距离上映还有几天
                      const now = new Date();
                      now.setHours(0, 0, 0, 0); // 归零时间，只比较日期
                      const releaseDate = new Date(release.releaseDate);
                      const daysDiff = Math.ceil((releaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                      // 根据天数差异显示不同文字
                      let remarksText;
                      if (daysDiff < 0) {
                        remarksText = `已上映${Math.abs(daysDiff)}天`;
                      } else if (daysDiff === 0) {
                        remarksText = '今日上映';
                      } else {
                        remarksText = `${daysDiff}天后上映`;
                      }

                      return (
                        <div
                          key={`${release.id}-${index}`}
                          className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                        >
                          <VideoCard
                            source='upcoming_release'
                            id={release.id}
                            source_name='即将上映'
                            from='douban'
                            title={release.title}
                            poster={release.cover || '/placeholder-poster.jpg'}
                            year={release.releaseDate.split('-')[0]}
                            type={release.type}
                            remarks={remarksText}
                            releaseDate={release.releaseDate}
                            query={release.title}
                            episodes={release.episodes || (release.type === 'tv' ? undefined : 1)}
                          />
                        </div>
                      );
                    })}
                </ScrollableRow>
              </section>
            )}

            {/* 热门电影 */}
            <section className='mb-4 sm:mb-8'>
              <div className='mb-3 sm:mb-4 flex items-center justify-between'>
                <SectionTitle title="热门电影" icon={Film} iconColor="text-red-500" />
                <Link
                  href='/douban?type=movie'
                  className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                >
                  查看更多
                  <ChevronRight className='w-4 h-4 ml-1' />
                </Link>
              </div>
              <ScrollableRow enableVirtualization={true}>
                {loading
                  ? // 加载状态显示灰色占位数据
                  Array.from({ length: 8 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))
                  : // 显示真实数据
                  hotMovies.map((movie, index) => (
                    <div
                      key={index}
                      className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                    >
                      <VideoCard
                        from='douban'
                        source='douban'
                        id={movie.id}
                        source_name='豆瓣'
                        title={movie.title}
                        poster={movie.poster}
                        douban_id={Number(movie.id)}
                        rate={movie.rate}
                        year={movie.year}
                        type='movie'
                      />
                    </div>
                  ))}
              </ScrollableRow>
            </section>

            {/* 热门剧集 */}
            <section className='mb-4 sm:mb-8'>
              <div className='mb-3 sm:mb-4 flex items-center justify-between'>
                <SectionTitle title="热门剧集" icon={Tv} iconColor="text-blue-500" />
                <Link
                  href='/douban?type=tv'
                  className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                >
                  查看更多
                  <ChevronRight className='w-4 h-4 ml-1' />
                </Link>
              </div>
              <ScrollableRow enableVirtualization={true}>
                {loading
                  ? // 加载状态显示灰色占位数据
                  Array.from({ length: 8 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))
                  : // 显示真实数据
                  hotTvShows.map((show, index) => (
                    <div
                      key={index}
                      className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                    >
                      <VideoCard
                        from='douban'
                        source='douban'
                        id={show.id}
                        source_name='豆瓣'
                        title={show.title}
                        poster={show.poster}
                        douban_id={Number(show.id)}
                        rate={show.rate}
                        year={show.year}
                      />
                    </div>
                  ))}
              </ScrollableRow>
            </section>

            {/* 每日新番放送 */}
            <section className='mb-4 sm:mb-8'>
              <div className='mb-3 sm:mb-4 flex items-center justify-between'>
                <SectionTitle title="新番放送" icon={Calendar} iconColor="text-purple-500" />
                <Link
                  href='/douban?type=anime'
                  className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                >
                  查看更多
                  <ChevronRight className='w-4 h-4 ml-1' />
                </Link>
              </div>
              <ScrollableRow enableVirtualization={true}>
                {loading
                  ? // 加载状态显示灰色占位数据
                  Array.from({ length: 8 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))
                  : // 展示当前日期的番剧
                  (() => {
                    // 获取当前日期对应的星期
                    const today = new Date();
                    const weekdays = [
                      'Sun',
                      'Mon',
                      'Tue',
                      'Wed',
                      'Thu',
                      'Fri',
                      'Sat',
                    ];
                    const currentWeekday = weekdays[today.getDay()];

                    // 找到当前星期对应的番剧数据
                    const todayAnimes =
                      bangumiCalendarData.find(
                        (item) => item.weekday.en === currentWeekday
                      )?.items || [];

                    return todayAnimes.map((anime, index) => (
                      <div
                        key={`${anime.id}-${index}`}
                        className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                      >
                        <VideoCard
                          from='douban'
                          source='bangumi'
                          id={anime.id.toString()}
                          source_name='Bangumi'
                          title={anime.name_cn || anime.name}
                          poster={
                            anime.images?.large ||
                            anime.images?.common ||
                            anime.images?.medium ||
                            anime.images?.small ||
                            anime.images?.grid ||
                            '/placeholder-poster.jpg'
                          }
                          douban_id={anime.id}
                          rate={anime.rating?.score?.toFixed(1) || ''}
                          year={anime.air_date?.split('-')?.[0] || ''}
                          isBangumi={true}
                        />
                      </div>
                    ));
                  })()}
              </ScrollableRow>
            </section>

            {/* 热门综艺 */}
            <section className='mb-4 sm:mb-8'>
              <div className='mb-3 sm:mb-4 flex items-center justify-between'>
                <SectionTitle title="热门综艺" icon={Sparkles} iconColor="text-pink-500" />
                <Link
                  href='/douban?type=show'
                  className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                >
                  查看更多
                  <ChevronRight className='w-4 h-4 ml-1' />
                </Link>
              </div>
              <ScrollableRow enableVirtualization={true}>
                {loading
                  ? // 加载状态显示灰色占位数据
                  Array.from({ length: 8 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))
                  : // 显示真实数据
                  hotVarietyShows.map((show, index) => (
                    <div
                      key={index}
                      className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                    >
                      <VideoCard
                        from='douban'
                        source='douban'
                        id={show.id}
                        source_name='豆瓣'
                        title={show.title}
                        poster={show.poster}
                        douban_id={Number(show.id)}
                        rate={show.rate}
                        year={show.year}
                      />
                    </div>
                  ))}
              </ScrollableRow>
            </section>

            {/* 热门短剧 */}
            <section className='mb-4 sm:mb-8'>
              <div className='mb-3 sm:mb-4 flex items-center justify-between'>
                <SectionTitle title="热门短剧" icon={Play} iconColor="text-orange-500" />
                <Link
                  href='/shortdrama'
                  className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                >
                  查看更多
                  <ChevronRight className='w-4 h-4 ml-1' />
                </Link>
              </div>
              <ScrollableRow enableVirtualization={true}>
                {loading
                  ? // 加载状态显示灰色占位数据
                  Array.from({ length: 8 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))
                  : // 显示真实数据
                  hotShortDramas.map((drama, index) => (
                    <div
                      key={index}
                      className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                    >
                      <ShortDramaCard drama={drama} />
                    </div>
                  ))}
              </ScrollableRow>
            </section>
          </div>
        </div>
      </div>
      {announcement && showAnnouncement && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 transition-opacity duration-300 ${showAnnouncement ? '' : 'opacity-0 pointer-events-none'
            }`}
          onTouchStart={(e) => {
            // 如果点击的是背景区域，阻止触摸事件冒泡，防止背景滚动
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
          onTouchMove={(e) => {
            // 如果触摸的是背景区域，阻止触摸移动，防止背景滚动
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onTouchEnd={(e) => {
            // 如果触摸的是背景区域，阻止触摸结束事件，防止背景滚动
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
          style={{
            touchAction: 'none', // 禁用所有触摸操作
          }}
        >
          <div
            className='w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900 transform transition-all duration-300 hover:shadow-2xl'
            onTouchMove={(e) => {
              // 允许公告内容区域正常滚动，阻止事件冒泡到外层
              e.stopPropagation();
            }}
            style={{
              touchAction: 'auto', // 允许内容区域的正常触摸操作
            }}
          >
            <div className='flex justify-between items-start mb-4'>
              <h3 className='text-2xl font-bold tracking-tight text-gray-800 dark:text-white border-b border-green-500 pb-1'>
                提示
              </h3>
              <button
                onClick={() => handleCloseAnnouncement(announcement)}
                className='text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-white transition-colors'
                aria-label='关闭'
              ></button>
            </div>
            <div className='mb-6'>
              <div className='relative overflow-hidden rounded-lg mb-4 bg-green-50 dark:bg-green-900/20'>
                <div className='absolute inset-y-0 left-0 w-1.5 bg-green-500 dark:bg-green-400'></div>
                <div
                  className='ml-4 text-gray-600 dark:text-gray-300 leading-relaxed'
                  dangerouslySetInnerHTML={{ __html: announcement }}
                />
              </div>
            </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement)}
              className='w-full rounded-lg bg-linear-to-r from-green-600 to-green-700 px-4 py-3 text-white font-medium shadow-md hover:shadow-lg hover:from-green-700 hover:to-green-800 dark:from-green-600 dark:to-green-700 dark:hover:from-green-700 dark:hover:to-green-800 transition-all duration-300 transform hover:-translate-y-0.5'
            >
              我知道了
            </button>
          </div>
        </div>
      )}

    </PageLayout>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
