/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect, no-console, unused-imports/no-unused-vars */

'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ChevronRight,
  Film,
  Play,
  Sparkles,
  Trash2,
  Tv,
} from 'lucide-react';
import Link from 'next/link';
import {
  Suspense,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
// 客户端收藏 API
import { getAllFavorites, getAllPlayRecords } from '@/lib/db.client';
import { getDoubanDetails } from '@/lib/douban.client';
import {
  cleanExpiredCache,
  clearRecommendsCache,
} from '@/lib/shortdrama-cache';
import { ReleaseCalendarItem, ShortDramaItem } from '@/lib/types';
import { DoubanItem } from '@/lib/types';
// 🚀 TanStack Query Mutations
import { useClearFavoritesMutation } from '@/hooks/useFavoritesMutations';
import { useHomePageQueries } from '@/hooks/useHomePageQueries';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import ContinueWatching from '@/components/ContinueWatching';
import HeroBanner from '@/components/HeroBanner';
import PageLayout from '@/components/PageLayout';
import ScrollableRow from '@/components/ScrollableRow';
import SectionTitle from '@/components/SectionTitle';
import ShortDramaCard from '@/components/ShortDramaCard';
import { useSite } from '@/components/SiteProvider';
import SkeletonCard from '@/components/SkeletonCard';
import { TelegramWelcomeModal } from '@/components/TelegramWelcomeModal';
import VideoCard from '@/components/VideoCard';

// 🎯 优化：合并状态管理 - 使用 useReducer 减少重渲染
interface HomeState {
  activeTab: 'home' | 'favorites';
  hotMovies: DoubanItem[]; // 本地详情增强数据
  hotTvShows: DoubanItem[];
  hotVarietyShows: DoubanItem[];
  hotAnime: DoubanItem[];
  hotShortDramas: ShortDramaItem[];
  upcomingReleases: ReleaseCalendarItem[];
  username: string;
  showAnnouncement: boolean;
}

type HomeAction =
  | { type: 'SET_ACTIVE_TAB'; payload: 'home' | 'favorites' }
  | { type: 'SET_HOT_MOVIES'; payload: DoubanItem[] }
  | { type: 'SET_HOT_TV_SHOWS'; payload: DoubanItem[] }
  | { type: 'SET_HOT_VARIETY_SHOWS'; payload: DoubanItem[] }
  | { type: 'SET_HOT_ANIME'; payload: DoubanItem[] }
  | { type: 'SET_HOT_SHORT_DRAMAS'; payload: ShortDramaItem[] }
  | { type: 'SET_UPCOMING_RELEASES'; payload: ReleaseCalendarItem[] }
  | { type: 'SET_USERNAME'; payload: string }
  | { type: 'SET_SHOW_ANNOUNCEMENT'; payload: boolean }
  | { type: 'UPDATE_HOT_MOVIES'; payload: (prev: DoubanItem[]) => DoubanItem[] }
  | {
      type: 'UPDATE_HOT_TV_SHOWS';
      payload: (prev: DoubanItem[]) => DoubanItem[];
    }
  | {
      type: 'UPDATE_HOT_VARIETY_SHOWS';
      payload: (prev: DoubanItem[]) => DoubanItem[];
    }
  | { type: 'UPDATE_HOT_ANIME'; payload: (prev: DoubanItem[]) => DoubanItem[] }
  | {
      type: 'UPDATE_HOT_SHORT_DRAMAS';
      payload: (prev: ShortDramaItem[]) => ShortDramaItem[];
    };

const homeReducer = (state: HomeState, action: HomeAction): HomeState => {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_HOT_MOVIES':
      return { ...state, hotMovies: action.payload };
    case 'SET_HOT_TV_SHOWS':
      return { ...state, hotTvShows: action.payload };
    case 'SET_HOT_VARIETY_SHOWS':
      return { ...state, hotVarietyShows: action.payload };
    case 'SET_HOT_ANIME':
      return { ...state, hotAnime: action.payload };
    case 'SET_HOT_SHORT_DRAMAS':
      return { ...state, hotShortDramas: action.payload };
    case 'SET_UPCOMING_RELEASES':
      return { ...state, upcomingReleases: action.payload };
    case 'SET_USERNAME':
      return { ...state, username: action.payload };
    case 'SET_SHOW_ANNOUNCEMENT':
      return { ...state, showAnnouncement: action.payload };
    case 'UPDATE_HOT_MOVIES':
      return { ...state, hotMovies: action.payload(state.hotMovies) };
    case 'UPDATE_HOT_TV_SHOWS':
      return { ...state, hotTvShows: action.payload(state.hotTvShows) };
    case 'UPDATE_HOT_VARIETY_SHOWS':
      return {
        ...state,
        hotVarietyShows: action.payload(state.hotVarietyShows),
      };
    case 'UPDATE_HOT_ANIME':
      return { ...state, hotAnime: action.payload(state.hotAnime) };
    case 'UPDATE_HOT_SHORT_DRAMAS':
      return { ...state, hotShortDramas: action.payload(state.hotShortDramas) };
    default:
      return state;
  }
};

const allFavoritesOptions = () =>
  queryOptions({
    queryKey: ['favorites'],
    queryFn: () => getAllFavorites(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

const allPlayRecordsOptions = () =>
  queryOptions({
    queryKey: ['playRecords'],
    queryFn: () => getAllPlayRecords(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

function HomeClient() {
  // 🚀 TanStack Query - 首页数据查询（替代 GlobalCache）
  const {
    data: homeData,
    isLoading: homeLoading,
    isFetching: homeFetching,
    errors: homeErrors,
    refetch: refetchHomeData,
  } = useHomePageQueries();

  // 🎯 优化：使用 useTransition 让 tab 切换不阻塞 UI
  const [isPending, startTransition] = useTransition();

  // 🎯 优化：使用 useReducer 合并本地状态
  const [state, dispatch] = useReducer(homeReducer, {
    activeTab: 'home',
    hotMovies: [],
    hotTvShows: [],
    hotVarietyShows: [],
    hotAnime: [],
    hotShortDramas: [],
    upcomingReleases: [],
    username: '',
    showAnnouncement: false,
  });

  const { announcement } = useSite();

  // 🚀 从 TanStack Query 获取首页数据，本地状态作为详情增强
  const hotMovies = useMemo(() => {
    const cached = homeData?.hotMovies || [];
    // 合并本地详情数据
    if (state.hotMovies.length > 0 && cached.length > 0) {
      return cached.map((m) => {
        const local = state.hotMovies.find((lm) => lm.id === m.id);
        return local ? { ...m, ...local } : m;
      });
    }
    return cached;
  }, [homeData?.hotMovies, state.hotMovies]);

  const hotTvShows = useMemo(() => {
    const cached = homeData?.hotTvShows || [];
    if (state.hotTvShows.length > 0 && cached.length > 0) {
      return cached.map((s) => {
        const local = state.hotTvShows.find((ls) => ls.id === s.id);
        return local ? { ...s, ...local } : s;
      });
    }
    return cached;
  }, [homeData?.hotTvShows, state.hotTvShows]);

  const hotVarietyShows = useMemo(() => {
    const cached = homeData?.hotVarietyShows || [];
    if (state.hotVarietyShows.length > 0 && cached.length > 0) {
      return cached.map((s) => {
        const local = state.hotVarietyShows.find((ls) => ls.id === s.id);
        return local ? { ...s, ...local } : s;
      });
    }
    return cached;
  }, [homeData?.hotVarietyShows, state.hotVarietyShows]);

  const hotAnime = useMemo(() => {
    const cached = homeData?.hotAnime || [];
    if (state.hotAnime.length > 0 && cached.length > 0) {
      return cached.map((a) => {
        const local = state.hotAnime.find((la) => la.id === a.id);
        return local ? { ...a, ...local } : a;
      });
    }
    return cached;
  }, [homeData?.hotAnime, state.hotAnime]);

  const hotShortDramas = useMemo(() => {
    const cached = homeData?.hotShortDramas || [];
    if (state.hotShortDramas.length > 0 && cached.length > 0) {
      return cached.map((d) => {
        const local = state.hotShortDramas.find((ld) => ld.id === d.id);
        return local ? { ...d, ...local } : d;
      });
    }
    return cached;
  }, [homeData?.hotShortDramas, state.hotShortDramas]);

  const bangumiCalendarData = homeData?.bangumiCalendar || [];

  // 🚀 计算 loading 状态：首次加载时显示 loading
  const loading = homeLoading;

  // 解构本地状态
  const { activeTab, upcomingReleases, username, showAnnouncement } = state;

  const [showWelcomeToast, setShowWelcomeToast] = useState(false);

  // 🚀 Web Worker引用
  const workerRef = useRef<Worker | null>(null);

  // 🔄 优化：缓存问候语计算
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }, []); // 空依赖数组，只在组件挂载时计算一次

  // 🔄 优化：缓存今日番剧计算
  const todayAnimes = useMemo(() => {
    const today = new Date();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentWeekday = weekdays[today.getDay()];

    return (
      bangumiCalendarData.find((item) => item.weekday.en === currentWeekday)
        ?.items || []
    );
  }, [bangumiCalendarData]); // 依赖bangumiCalendarData，数据变化时重新计算

  // 🔄 优化：缓存今天的日期（用于上映日期计算）
  const today = useMemo(() => {
    const dateStr = new Date().toLocaleDateString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [year, month, day] = dateStr.split('/');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date;
  }, []); // 空依赖，只在组件挂载时计算一次

  const [showClearFavoritesDialog, setShowClearFavoritesDialog] =
    useState(false);
  const [requireClearConfirmation, setRequireClearConfirmation] =
    useState(false);

  // 合并初始化逻辑 - 优化性能，减少重渲染
  useEffect(() => {
    // 获取用户名
    const authInfo = getAuthInfoFromBrowserCookie();
    if (authInfo?.username) {
      dispatch({ type: 'SET_USERNAME', payload: authInfo.username });
    }

    // 读取清空确认设置
    if (typeof window !== 'undefined') {
      const savedRequireClearConfirmation = localStorage.getItem(
        'requireClearConfirmation',
      );
      if (savedRequireClearConfirmation !== null) {
        setRequireClearConfirmation(JSON.parse(savedRequireClearConfirmation));
      }
    }

    // 检查公告弹窗状态
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        dispatch({ type: 'SET_SHOW_ANNOUNCEMENT', payload: true });
      } else {
        dispatch({
          type: 'SET_SHOW_ANNOUNCEMENT',
          payload: Boolean(!hasSeenAnnouncement && announcement),
        });
      }
    }
  }, [announcement]);

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

  // 🚀 TanStack Query - 使用 useQuery 获取收藏数据（自动缓存，跨页面持久化）
  const { data: allFavorites = {} } = useQuery(allFavoritesOptions());

  // 🚀 TanStack Query - 使用 useQuery 获取播放记录（自动缓存，跨页面持久化）
  const { data: allPlayRecords = {} } = useQuery(allPlayRecordsOptions());

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
    releaseDate?: string;
    remarks?: string;
  };

  // 🚀 TanStack Query - 使用 useMemo 计算收藏列表（自动响应数据变化）
  const favoriteItems = useMemo(() => {
    // 根据保存时间排序（从近到远）
    return Object.entries(allFavorites)
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
          releaseDate: fav?.releaseDate,
          remarks: fav?.remarks,
        } as FavoriteItem;
      });
  }, [allFavorites, allPlayRecords]);

  const [favoriteFilter, setFavoriteFilter] = useState<
    'all' | 'movie' | 'tv' | 'shortdrama' | 'live' | 'variety' | 'anime'
  >('all');
  const [favoriteSortBy, setFavoriteSortBy] = useState<'recent' | 'title'>(
    'recent',
  );
  const [upcomingFilter, setUpcomingFilter] = useState<'all' | 'movie' | 'tv'>(
    'all',
  );

  // 🔄 优化：缓存收藏夹统计信息计算
  const favoriteStats = useMemo(() => {
    if (favoriteItems.length === 0) return null;

    return {
      total: favoriteItems.length,
      movie: favoriteItems.filter((item) => {
        if (item.type) return item.type === 'movie';
        if (item.source === 'shortdrama' || item.source_name === '短剧')
          return false;
        if (item.source === 'bangumi') return false;
        if (item.origin === 'live') return false;
        return item.episodes === 1;
      }).length,
      tv: favoriteItems.filter((item) => {
        if (item.type) return item.type === 'tv';
        if (item.source === 'shortdrama' || item.source_name === '短剧')
          return false;
        if (item.source === 'bangumi') return false;
        if (item.origin === 'live') return false;
        return item.episodes > 1;
      }).length,
      anime: favoriteItems.filter((item) => {
        if (item.type) return item.type === 'anime';
        return item.source === 'bangumi';
      }).length,
      shortdrama: favoriteItems.filter((item) => {
        if (item.type) return item.type === 'shortdrama';
        return item.source === 'shortdrama' || item.source_name === '短剧';
      }).length,
      live: favoriteItems.filter((item) => item.origin === 'live').length,
      variety: favoriteItems.filter((item) => {
        if (item.type) return item.type === 'variety';
        return false;
      }).length,
    };
  }, [favoriteItems]);

  useEffect(() => {
    // 清理过期缓存
    cleanExpiredCache().catch(console.error);

    // 清除可能缓存了空数据的短剧推荐缓存
    clearRecommendsCache().catch(console.error);

    // 🚀 TanStack Query 会自动加载数据，无需手动调用

    // 🔄 异步加载即将上映数据（不阻塞页面显示）
    const fetchUpcomingReleases = async () => {
      try {
        const response = await fetch('/api/release-calendar?limit=100');
        if (!response.ok) {
          console.error('获取即将上映数据失败，状态码:', response.status);
          return;
        }
        const data = await response.json();
        const releases = data.items || [];
        console.log('📅 获取到的即将上映数据:', releases.length, '条');

        // 初始化Web Worker
        if (
          !workerRef.current &&
          typeof window !== 'undefined' &&
          window.Worker
        ) {
          try {
            workerRef.current = new Worker(
              new URL('../workers/releaseCalendar.worker.ts', import.meta.url),
            );

            workerRef.current.onmessage = (e: MessageEvent) => {
              const { selectedItems, stats, error } = e.data;

              if (error) {
                console.error('📅 [Worker] 处理失败:', error);
                dispatch({ type: 'SET_UPCOMING_RELEASES', payload: [] });
                return;
              }

              console.log('📅 [Main] Worker处理完成，分配结果:', stats);
              dispatch({
                type: 'SET_UPCOMING_RELEASES',
                payload: selectedItems,
              });
            };

            workerRef.current.onerror = (error) => {
              console.error('📅 [Worker] 错误:', error);
              dispatch({ type: 'SET_UPCOMING_RELEASES', payload: [] });
            };
          } catch (error) {
            console.error('📅 [Worker] 初始化失败:', error);
            dispatch({ type: 'SET_UPCOMING_RELEASES', payload: [] });
          }
        }

        // 发送数据到Worker处理
        if (workerRef.current) {
          const todayStr = new Date()
            .toLocaleDateString('zh-CN', {
              timeZone: 'Asia/Shanghai',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            })
            .split('/')
            .reverse()
            .join('-');

          workerRef.current.postMessage({
            releases,
            today: todayStr,
          });
        } else {
          // Fallback: Worker不可用时的处理
          console.warn('📅 Web Worker不可用，跳过即将上映数据处理');
          dispatch({ type: 'SET_UPCOMING_RELEASES', payload: [] });
        }
      } catch (error) {
        console.error('获取即将上映数据失败:', error);
        dispatch({ type: 'SET_UPCOMING_RELEASES', payload: [] });
      }
    };

    fetchUpcomingReleases();

    // 🚀 清理Web Worker
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        console.log('📅 [Main] Web Worker已清理');
      }
    };
  }, []);

  // 如果首页数据加载完成但热门短剧为空，强制刷新（可能之前缓存了空数据）
  useEffect(() => {
    if (homeData && homeData.hotShortDramas.length === 0 && !homeLoading) {
      console.log('[TanStack Query] 热门短剧为空，强制刷新首页数据');
      refetchHomeData();
    }
  }, [homeData, homeLoading, refetchHomeData]);

  // 🚀 延迟加载详情数据（增强首页数据）
  useEffect(() => {
    if (!homeData) return;

    // 延迟加载电影详情
    if (homeData.hotMovies.length > 0) {
      setTimeout(() => {
        Promise.all(
          homeData.hotMovies.slice(0, 2).map(async (movie) => {
            try {
              const detailsRes = await getDoubanDetails(movie.id);
              if (detailsRes.code === 200 && detailsRes.data) {
                return {
                  id: movie.id,
                  plot_summary: detailsRes.data.plot_summary,
                  backdrop: detailsRes.data.backdrop,
                  trailerUrl: detailsRes.data.trailerUrl,
                };
              }
            } catch (error) {
              console.warn(`获取电影 ${movie.id} 详情失败:`, error);
            }
            return null;
          }),
        ).then((results) => {
          dispatch({
            type: 'UPDATE_HOT_MOVIES',
            payload: (prev) => {
              const updated = homeData.hotMovies.map((m) => {
                const detail = results.find((r) => r?.id === m.id);
                return detail ? { ...m, ...detail } : m;
              });
              return updated;
            },
          });
        });
      }, 2000);
    }

    // 延迟加载剧集详情
    if (homeData.hotTvShows.length > 0) {
      setTimeout(() => {
        Promise.all(
          homeData.hotTvShows.slice(0, 2).map(async (show) => {
            try {
              const detailsRes = await getDoubanDetails(show.id);
              if (detailsRes.code === 200 && detailsRes.data) {
                return {
                  id: show.id,
                  plot_summary: detailsRes.data.plot_summary,
                  backdrop: detailsRes.data.backdrop,
                  trailerUrl: detailsRes.data.trailerUrl,
                };
              }
            } catch (error) {
              console.warn(`获取剧集 ${show.id} 详情失败:`, error);
            }
            return null;
          }),
        ).then((results) => {
          dispatch({
            type: 'UPDATE_HOT_TV_SHOWS',
            payload: (prev) => {
              const updated = homeData.hotTvShows.map((s) => {
                const detail = results.find((r) => r?.id === s.id);
                return detail ? { ...s, ...detail } : s;
              });
              return updated;
            },
          });
        });
      }, 2000);
    }

    // 延迟加载动漫详情
    if (homeData.hotAnime.length > 0) {
      setTimeout(() => {
        const anime = homeData.hotAnime[0];
        getDoubanDetails(anime.id)
          .then((detailsRes) => {
            if (detailsRes.code === 200 && detailsRes.data) {
              dispatch({
                type: 'UPDATE_HOT_ANIME',
                payload: (prev) => {
                  const updated = homeData.hotAnime.map((a) =>
                    a.id === anime.id ? { ...a, ...detailsRes.data } : a,
                  );
                  return updated;
                },
              });
            }
          })
          .catch((error) => {
            console.warn(`获取动漫 ${anime.id} 详情失败:`, error);
          });
      }, 3000);
    }

    // 延迟加载综艺详情
    if (homeData.hotVarietyShows.length > 0) {
      setTimeout(() => {
        const show = homeData.hotVarietyShows[0];
        getDoubanDetails(show.id)
          .then((detailsRes) => {
            if (detailsRes.code === 200 && detailsRes.data) {
              dispatch({
                type: 'UPDATE_HOT_VARIETY_SHOWS',
                payload: (prev) => {
                  const updated = homeData.hotVarietyShows.map((s) =>
                    s.id === show.id ? { ...s, ...detailsRes.data } : s,
                  );
                  return updated;
                },
              });
            }
          })
          .catch((error) => {
            console.warn(`获取综艺 ${show.id} 详情失败:`, error);
          });
      }, 3000);
    }

    // 延迟加载短剧详情
    if (homeData.hotShortDramas.length > 0) {
      setTimeout(() => {
        Promise.all(
          homeData.hotShortDramas.slice(0, 2).map(async (drama) => {
            try {
              const response = await fetch(
                `/api/shortdrama/detail?id=${drama.id}&episode=1`,
              );
              if (response.ok) {
                const detailData = await response.json();
                if (detailData.desc) {
                  return { id: drama.id, description: detailData.desc };
                }
              }
            } catch (error) {
              console.warn(`获取短剧 ${drama.id} 详情失败:`, error);
            }
            return null;
          }),
        ).then((results) => {
          dispatch({
            type: 'UPDATE_HOT_SHORT_DRAMAS',
            payload: (prev) => {
              const updated = homeData.hotShortDramas.map((d) => {
                const detail = results.find((r) => r?.id === d.id);
                return detail ? { ...d, description: detail.description } : d;
              });
              return updated;
            },
          });
        });
      }, 3000);
    }
  }, [homeData]);

  // 🚀 TanStack Query - 使用 useMutation 管理清空收藏操作
  // 特性：乐观更新（立即清空 UI）+ 错误回滚（失败时恢复数据）
  const clearFavoritesMutation = useClearFavoritesMutation();

  const handleCloseAnnouncement = (announcement: string) => {
    dispatch({ type: 'SET_SHOW_ANNOUNCEMENT', payload: false });
    localStorage.setItem('hasSeenAnnouncement', announcement); // 记录已查看弹窗
  };

  return (
    <PageLayout>
      {/* Telegram 新用户欢迎弹窗 */}
      <TelegramWelcomeModal />

      {/* 右侧滑入的欢迎悬浮窗 */}
      <div
        className={`fixed top-20 right-4 z-9999 transition-all duration-500 ease-out ${
          showWelcomeToast
            ? 'translate-x-0 opacity-100'
            : 'translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        <div className='relative overflow-hidden rounded-xl bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 p-[2px] shadow-2xl'>
          <div className='relative bg-white dark:bg-gray-900 rounded-xl px-5 py-3'>
            <div className='flex items-center gap-3'>
              <div className='shrink-0 w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center'>
                <span className='text-xl animate-wave origin-bottom-right'>
                  👋
                </span>
              </div>
              <div className='flex-1 min-w-0'>
                <div className='text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap'>
                  <span>
                    {greeting}
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
                <svg
                  className='w-4 h-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className='px-2 sm:px-10 py-4 sm:py-8 overflow-visible pb-32 md:pb-safe-bottom'>
        {/* 轮播图 - 在所有tab显示 */}
        {!loading &&
          (hotMovies.length > 0 ||
            hotTvShows.length > 0 ||
            hotVarietyShows.length > 0 ||
            hotShortDramas.length > 0) && (
            <div className='mt-8 sm:mt-12 mb-8 md:-mt-4'>
              <HeroBanner
                items={[
                  // 豆瓣电影
                  ...hotMovies.slice(0, 2).map((movie) => ({
                    id: movie.id,
                    title: movie.title,
                    poster: movie.poster,
                    backdrop: movie.backdrop,
                    trailerUrl: movie.trailerUrl,
                    description: movie.plot_summary,
                    year: movie.year,
                    rate: movie.rate,
                    douban_id: Number(movie.id),
                    type: 'movie' as const,
                  })),
                  // 豆瓣电视剧
                  ...hotTvShows.slice(0, 2).map((show) => ({
                    id: show.id,
                    title: show.title,
                    poster: show.poster,
                    backdrop: show.backdrop,
                    trailerUrl: show.trailerUrl,
                    description: show.plot_summary,
                    year: show.year,
                    rate: show.rate,
                    douban_id: Number(show.id),
                    type: 'tv' as const,
                  })),
                  // 豆瓣综艺
                  ...hotVarietyShows.slice(0, 1).map((show) => ({
                    id: show.id,
                    title: show.title,
                    poster: show.poster,
                    backdrop: show.backdrop,
                    trailerUrl: show.trailerUrl,
                    description: show.plot_summary,
                    year: show.year,
                    rate: show.rate,
                    douban_id: Number(show.id),
                    type: 'variety' as const,
                  })),
                  // 豆瓣动漫
                  ...hotAnime.slice(0, 1).map((anime) => ({
                    id: anime.id,
                    title: anime.title,
                    poster: anime.poster,
                    backdrop: anime.backdrop,
                    trailerUrl: anime.trailerUrl,
                    description: anime.plot_summary,
                    year: anime.year,
                    rate: anime.rate,
                    douban_id: Number(anime.id),
                    type: 'anime' as const,
                  })),
                ]}
                autoPlayInterval={8000}
                showControls={true}
                showIndicators={true}
                enableVideo={
                  !(window as any).RUNTIME_CONFIG?.DISABLE_HERO_TRAILER
                }
              />
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
            onChange={(value) =>
              startTransition(() =>
                dispatch({
                  type: 'SET_ACTIVE_TAB',
                  payload: value as 'home' | 'favorites',
                }),
              )
            }
          />
        </div>

        <div
          className={`max-w-[95%] mx-auto ${isPending ? 'opacity-70 transition-opacity duration-150' : ''}`}
        >
          {/* 收藏夹视图 */}
          <section
            className={`mb-8 ${activeTab === 'favorites' ? 'block' : 'hidden'}`}
          >
            <div className='mb-6 flex items-center justify-between'>
              <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                我的收藏
              </h2>
              {favoriteItems.length > 0 && (
                <button
                  className='flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-white hover:bg-red-600 dark:text-red-400 dark:hover:text-white dark:hover:bg-red-500 border border-red-300 dark:border-red-700 hover:border-red-600 dark:hover:border-red-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md'
                  onClick={() => {
                    // 根据用户设置决定是否显示确认对话框
                    if (requireClearConfirmation) {
                      setShowClearFavoritesDialog(true);
                    } else {
                      // 🚀 使用 mutation.mutate() 清空收藏
                      // 特性：立即清空 UI（乐观更新），失败时自动回滚
                      clearFavoritesMutation.mutate();
                    }
                  }}
                >
                  <Trash2 className='w-4 h-4' />
                  <span>清空收藏</span>
                </button>
              )}
            </div>

            {/* 统计信息 */}
            {favoriteStats && (
              <div className='mb-4 flex flex-wrap gap-2 text-sm text-gray-600 dark:text-gray-400'>
                <span className='px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full'>
                  共{' '}
                  <strong className='text-gray-900 dark:text-gray-100'>
                    {favoriteStats.total}
                  </strong>{' '}
                  项
                </span>
                {favoriteStats.movie > 0 && (
                  <span className='px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full'>
                    电影 {favoriteStats.movie}
                  </span>
                )}
                {favoriteStats.tv > 0 && (
                  <span className='px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full'>
                    剧集 {favoriteStats.tv}
                  </span>
                )}
                {favoriteStats.anime > 0 && (
                  <span className='px-3 py-1 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 rounded-full'>
                    动漫 {favoriteStats.anime}
                  </span>
                )}
                {favoriteStats.shortdrama > 0 && (
                  <span className='px-3 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 rounded-full'>
                    短剧 {favoriteStats.shortdrama}
                  </span>
                )}
                {favoriteStats.live > 0 && (
                  <span className='px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-full'>
                    直播 {favoriteStats.live}
                  </span>
                )}
                {favoriteStats.variety > 0 && (
                  <span className='px-3 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full'>
                    综艺 {favoriteStats.variety}
                  </span>
                )}
              </div>
            )}

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
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      favoriteFilter === key
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
                      className={`px-3 py-1 rounded-md transition-colors ${
                        favoriteSortBy === key
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
                  <svg
                    className='w-32 h-32 relative z-10'
                    viewBox='0 0 200 200'
                    fill='none'
                    xmlns='http://www.w3.org/2000/svg'
                  >
                    <path
                      d='M100 170C100 170 30 130 30 80C30 50 50 30 70 30C85 30 95 40 100 50C105 40 115 30 130 30C150 30 170 50 170 80C170 130 100 170 100 170Z'
                      className='fill-gray-300 dark:fill-gray-600 stroke-gray-400 dark:stroke-gray-500'
                      strokeWidth='3'
                    />
                    <path
                      d='M100 170C100 170 30 130 30 80C30 50 50 30 70 30C85 30 95 40 100 50C105 40 115 30 130 30C150 30 170 50 170 80C170 130 100 170 100 170Z'
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
                  // 筛选
                  let filtered = favoriteItems;
                  if (favoriteFilter === 'movie') {
                    filtered = favoriteItems.filter((item) => {
                      // 优先用 type 字段判断
                      if (item.type) return item.type === 'movie';
                      // 向后兼容：没有 type 时用 episodes 判断
                      if (
                        item.source === 'shortdrama' ||
                        item.source_name === '短剧'
                      )
                        return false;
                      if (item.source === 'bangumi') return false; // 排除动漫
                      if (item.origin === 'live') return false; // 排除直播
                      // vod 来源：按集数判断
                      return item.episodes === 1;
                    });
                  } else if (favoriteFilter === 'tv') {
                    filtered = favoriteItems.filter((item) => {
                      // 优先用 type 字段判断
                      if (item.type) return item.type === 'tv';
                      // 向后兼容：没有 type 时用 episodes 判断
                      if (
                        item.source === 'shortdrama' ||
                        item.source_name === '短剧'
                      )
                        return false;
                      if (item.source === 'bangumi') return false; // 排除动漫
                      if (item.origin === 'live') return false; // 排除直播
                      // vod 来源：按集数判断
                      return item.episodes > 1;
                    });
                  } else if (favoriteFilter === 'anime') {
                    filtered = favoriteItems.filter((item) => {
                      // 优先用 type 字段判断
                      if (item.type) return item.type === 'anime';
                      // 向后兼容：用 source 判断
                      return item.source === 'bangumi';
                    });
                  } else if (favoriteFilter === 'shortdrama') {
                    filtered = favoriteItems.filter((item) => {
                      // 优先用 type 字段判断
                      if (item.type) return item.type === 'shortdrama';
                      // 向后兼容：用 source 判断
                      return (
                        item.source === 'shortdrama' ||
                        item.source_name === '短剧'
                      );
                    });
                  } else if (favoriteFilter === 'live') {
                    filtered = favoriteItems.filter(
                      (item) => item.origin === 'live',
                    );
                  } else if (favoriteFilter === 'variety') {
                    filtered = favoriteItems.filter((item) => {
                      // 优先用 type 字段判断
                      if (item.type) return item.type === 'variety';
                      // 向后兼容：暂无 fallback
                      return false;
                    });
                  }

                  // 排序
                  if (favoriteSortBy === 'title') {
                    filtered = [...filtered].sort((a, b) =>
                      a.title.localeCompare(b.title, 'zh-CN'),
                    );
                  }
                  // 'recent' 已经在 updateFavoriteItems 中按 save_time 排序了

                  return filtered.map((item) => {
                    // 智能计算即将上映状态
                    let calculatedRemarks = item.remarks;

                    if (item.releaseDate) {
                      const releaseDate = new Date(item.releaseDate);
                      const daysDiff = Math.ceil(
                        (releaseDate.getTime() - today.getTime()) /
                          (1000 * 60 * 60 * 24),
                      );

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

            {/* 确认对话框 */}
            <ConfirmDialog
              isOpen={showClearFavoritesDialog}
              title='确认清空收藏'
              message={`确定要清空所有收藏吗？\n\n这将删除 ${favoriteItems.length} 项收藏，此操作无法撤销。`}
              confirmText='确认清空'
              cancelText='取消'
              variant='danger'
              onConfirm={() => {
                // 🚀 使用 mutation.mutate() 清空收藏
                // 特性：立即清空 UI（乐观更新），失败时自动回滚
                clearFavoritesMutation.mutate();
                setShowClearFavoritesDialog(false);
              }}
              onCancel={() => setShowClearFavoritesDialog(false)}
            />
          </section>

          {/* 首页视图 - 优化：使用 CSS 控制显示，避免重复挂载 */}
          <div className={activeTab === 'home' ? 'block' : 'hidden'}>
            {/* 继续观看 */}
            <ContinueWatching />

            {/* 即将上映 */}
            {!loading && upcomingReleases.length > 0 && (
              <section className='mb-4 sm:mb-8'>
                <div className='mb-3 sm:mb-4 flex items-center justify-between'>
                  <SectionTitle
                    title='即将上映'
                    icon={Calendar}
                    iconColor='text-orange-500'
                  />
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
                    {
                      key: 'all',
                      label: '全部',
                      count: upcomingReleases.length,
                    },
                    {
                      key: 'movie',
                      label: '电影',
                      count: upcomingReleases.filter((r) => r.type === 'movie')
                        .length,
                    },
                    {
                      key: 'tv',
                      label: '电视剧',
                      count: upcomingReleases.filter((r) => r.type === 'tv')
                        .length,
                    },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() =>
                        setUpcomingFilter(key as 'all' | 'movie' | 'tv')
                      }
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        upcomingFilter === key
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {label}
                      {count > 0 && (
                        <span
                          className={`ml-1.5 text-xs ${
                            upcomingFilter === key
                              ? 'text-white/80'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          ({count})
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <ScrollableRow enableVirtualization={true}>
                  {upcomingReleases
                    .filter(
                      (release) =>
                        upcomingFilter === 'all' ||
                        release.type === upcomingFilter,
                    )
                    .map((release, index) => {
                      // 计算距离上映还有几天
                      const releaseDate = new Date(release.releaseDate);
                      const daysDiff = Math.ceil(
                        (releaseDate.getTime() - today.getTime()) /
                          (1000 * 60 * 60 * 24),
                      );

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
                            episodes={
                              release.episodes ||
                              (release.type === 'tv' ? undefined : 1)
                            }
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
                <SectionTitle
                  title='热门电影'
                  icon={Film}
                  iconColor='text-red-500'
                />
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
                <SectionTitle
                  title='热门剧集'
                  icon={Tv}
                  iconColor='text-blue-500'
                />
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
                          type='tv'
                        />
                      </div>
                    ))}
              </ScrollableRow>
            </section>

            {/* 每日新番放送 */}
            <section className='mb-4 sm:mb-8'>
              <div className='mb-3 sm:mb-4 flex items-center justify-between'>
                <SectionTitle
                  title='新番放送'
                  icon={Calendar}
                  iconColor='text-purple-500'
                />
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
                    todayAnimes.map((anime, index) => (
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
                    ))}
              </ScrollableRow>
            </section>

            {/* 热门综艺 */}
            <section className='mb-4 sm:mb-8'>
              <div className='mb-3 sm:mb-4 flex items-center justify-between'>
                <SectionTitle
                  title='热门综艺'
                  icon={Sparkles}
                  iconColor='text-pink-500'
                />
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
                          type='variety'
                        />
                      </div>
                    ))}
              </ScrollableRow>
            </section>

            {/* 热门短剧 */}
            <section className='mb-4 sm:mb-8'>
              <div className='mb-3 sm:mb-4 flex items-center justify-between'>
                <SectionTitle
                  title='热门短剧'
                  icon={Play}
                  iconColor='text-orange-500'
                />
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
                      <ShortDramaCard
                        key={index}
                        drama={drama}
                        className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                      />
                    ))}
              </ScrollableRow>
            </section>
          </div>
        </div>
      </div>
      {announcement && showAnnouncement && (
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 transition-opacity duration-300 ${
            showAnnouncement ? '' : 'opacity-0 pointer-events-none'
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
            <div className='mb-4'>
              <h3 className='text-2xl font-bold tracking-tight text-gray-800 dark:text-white border-b border-green-500 pb-1'>
                提示
              </h3>
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
