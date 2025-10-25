/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { Brain, ChevronRight, Film, Tv, Calendar, Sparkles, Play } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

import {
  BangumiCalendarData,
  GetBangumiCalendarData,
} from '@/lib/bangumi.client';
import { getRecommendedShortDramas } from '@/lib/shortdrama.client';
import { cleanExpiredCache } from '@/lib/shortdrama-cache';
import { ShortDramaItem } from '@/lib/types';
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
  const [loading, setLoading] = useState(true);
  const { announcement } = useSite();
  const [username, setUsername] = useState<string>('');

  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // 获取用户名
  useEffect(() => {
    const authInfo = getAuthInfoFromBrowserCookie();
    if (authInfo?.username) {
      setUsername(authInfo.username);
    }
  }, []);

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      } else {
        setShowAnnouncement(Boolean(!hasSeenAnnouncement && announcement));
      }
    }
  }, [announcement]);


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
    origin?: 'vod' | 'live';
    save_time: number;
  };

  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);

  // 按日期分组收藏
  const groupFavoritesByDate = () => {
    const groups: { [key: string]: FavoriteItem[] } = {};

    favoriteItems.forEach((favorite) => {
      const date = new Date(favorite.save_time);
      const dateKey = date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(favorite);
    });

    // 按日期倒序排列（最新的在前）
    return Object.entries(groups).sort((a, b) => {
      const dateA = new Date(a[1][0].save_time);
      const dateB = new Date(b[1][0].save_time);
      return dateB.getTime() - dateA.getTime();
    });
  };

  useEffect(() => {
    // 清理过期缓存
    cleanExpiredCache().catch(console.error);

    const fetchRecommendData = async () => {
      try {
        setLoading(true);

        // 并行获取热门电影、热门剧集、热门综艺和热门短剧
        const [moviesData, tvShowsData, varietyShowsData, shortDramasData, bangumiCalendarData] =
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
          save_time: fav.save_time,
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

      <div className='px-2 sm:px-10 py-4 sm:py-8 overflow-visible'>
        {/* 欢迎横幅 - 在所有 tab 显示 */}
        <div className='mb-6 mt-0 md:mt-12 relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-[2px] shadow-lg animate-[slideDown_0.5s_ease-out]'>
          <div className='relative bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6'>
            {/* 装饰性背景 - 优化：移除模糊效果，使用纯渐变 */}
            <div className='absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full opacity-60'></div>
            <div className='absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-pink-400/10 to-purple-400/10 rounded-full opacity-60'></div>

            <div className='relative z-10'>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex-1 min-w-0'>
                  <h2 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1.5 flex items-center gap-2 flex-wrap'>
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
                      <span className='text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400'>
                        {username}
                      </span>
                    )}
                    <span className='inline-block animate-wave origin-bottom-right'>👋</span>
                  </h2>
                  <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
                    发现更多精彩影视内容 ✨
                  </p>
                </div>

                {/* 装饰图标 - 优化：移除 pulse 动画 */}
                <div className='hidden lg:block flex-shrink-0'>
                  <div className='w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg'>
                    <Film className='w-8 h-8 text-white' />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
          {/* 收藏夹视图 - 优化：使用 CSS 控制显示，避免重复挂载 */}
          <section className={`mb-8 ${activeTab === 'favorites' ? 'block' : 'hidden'}`}>
              <div className='mb-6 flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <h2 className='text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-200'>
                    我的收藏时光
                  </h2>
                  {favoriteItems.length > 0 && (
                    <span className='text-sm text-gray-500 dark:text-gray-400'>
                      {favoriteItems.length} 部作品
                    </span>
                  )}
                </div>
                {favoriteItems.length > 0 && (
                  <button
                    className='text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors'
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

              {favoriteItems.length === 0 ? (
                /* 空状态 - 优化：移除模糊和pulse动画 */
                <div className='flex flex-col items-center justify-center py-16 px-4'>
                  <div className='mb-6 relative'>
                    <div className='absolute inset-0 bg-gradient-to-r from-pink-300 to-purple-300 dark:from-pink-600 dark:to-purple-600 opacity-20 rounded-full'></div>
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
                /* 时间线样式的收藏列表 */
                <div className='space-y-6 sm:space-y-8'>
                  {groupFavoritesByDate().map(([dateKey, items], groupIndex) => {
                    const date = new Date(items[0].save_time);
                    const isToday = new Date().toDateString() === date.toDateString();
                    const isYesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toDateString() === date.toDateString();

                    let displayDate = dateKey;
                    if (isToday) displayDate = '今天';
                    else if (isYesterday) displayDate = '昨天';
                    else {
                      displayDate = date.toLocaleDateString('zh-CN', {
                        month: 'long',
                        day: 'numeric',
                      });
                    }

                    return (
                      <div key={dateKey} className='relative'>
                        {/* 时间线连接线 */}
                        {groupIndex < groupFavoritesByDate().length - 1 && (
                          <div className='absolute left-[11px] sm:left-[15px] top-[32px] sm:top-[40px] bottom-[-24px] sm:bottom-[-32px] w-[2px] bg-gradient-to-b from-green-500 via-emerald-500 to-teal-500 dark:from-green-600 dark:via-emerald-600 dark:to-teal-600 opacity-30'></div>
                        )}

                        {/* 日期标题 - 优化：移除blur和pulse动画 */}
                        <div className='flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4'>
                          <div className='relative flex-shrink-0'>
                            <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 dark:from-green-600 dark:via-emerald-600 dark:to-teal-600 flex items-center justify-center shadow-lg shadow-green-500/30 dark:shadow-green-500/20'>
                              <span className='text-white text-xs sm:text-sm font-bold'>{items.length}</span>
                            </div>
                          </div>
                          <div className='flex-1 min-w-0'>
                            <h4 className='text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate'>
                              {displayDate}
                            </h4>
                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                              <span className='hidden sm:inline'>收藏了 </span>{items.length}<span className='hidden sm:inline'> 部作品</span><span className='sm:hidden'>部</span>
                            </p>
                          </div>
                        </div>

                        {/* 该日期的收藏卡片网格 */}
                        <div className='ml-8 sm:ml-11 justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'>
                          {items.map((item) => (
                            <div key={item.id + item.source} className='w-full'>
                              <VideoCard
                                query={item.search_title}
                                {...item}
                                from='favorite'
                                type={item.episodes > 1 ? 'tv' : ''}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 底部统计 */}
              {favoriteItems.length > 0 && (
                <div className='mt-8 sm:mt-12 pt-6 border-t border-gray-200 dark:border-gray-700'>
                  <div className='flex items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-500 dark:text-gray-400'>
                    <div className='flex items-center gap-1.5 sm:gap-2'>
                      <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gradient-to-br from-green-500 to-emerald-500'></div>
                      <span>共 {favoriteItems.length} 部收藏</span>
                    </div>
                    <div className='w-px h-3 sm:h-4 bg-gray-300 dark:bg-gray-600'></div>
                    <div className='flex items-center gap-1.5 sm:gap-2'>
                      <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500'></div>
                      <span>跨越 {groupFavoritesByDate().length} 天</span>
                    </div>
                  </div>
                </div>
              )}
            </section>

          {/* 首页视图 - 优化：使用 CSS 控制显示，避免重复挂载 */}
          <div className={activeTab === 'home' ? 'block' : 'hidden'}>
              {/* 继续观看 */}
              <ContinueWatching />

              {/* 热门电影 */}
              <section className='mb-8'>
                <div className='mb-4 flex items-center justify-between'>
                  <SectionTitle title="热门电影" icon={Film} iconColor="text-red-500" />
                  <Link
                    href='/douban?type=movie'
                    className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 ml-1' />
                  </Link>
                </div>
                <ScrollableRow>
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
              <section className='mb-8'>
                <div className='mb-4 flex items-center justify-between'>
                  <SectionTitle title="热门剧集" icon={Tv} iconColor="text-blue-500" />
                  <Link
                    href='/douban?type=tv'
                    className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 ml-1' />
                  </Link>
                </div>
                <ScrollableRow>
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
              <section className='mb-8'>
                <div className='mb-4 flex items-center justify-between'>
                  <SectionTitle title="新番放送" icon={Calendar} iconColor="text-purple-500" />
                  <Link
                    href='/douban?type=anime'
                    className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 ml-1' />
                  </Link>
                </div>
                <ScrollableRow>
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
              <section className='mb-8'>
                <div className='mb-4 flex items-center justify-between'>
                  <SectionTitle title="热门综艺" icon={Sparkles} iconColor="text-pink-500" />
                  <Link
                    href='/douban?type=show'
                    className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 ml-1' />
                  </Link>
                </div>
                <ScrollableRow>
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
              <section className='mb-8'>
                <div className='mb-4 flex items-center justify-between'>
                  <SectionTitle title="热门短剧" icon={Play} iconColor="text-orange-500" />
                  <Link
                    href='/shortdrama'
                    className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 ml-1' />
                  </Link>
                </div>
                <ScrollableRow>
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
                <p className='ml-4 text-gray-600 dark:text-gray-300 leading-relaxed'>
                  {announcement}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement)}
              className='w-full rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 text-white font-medium shadow-md hover:shadow-lg hover:from-green-700 hover:to-green-800 dark:from-green-600 dark:to-green-700 dark:hover:from-green-700 dark:hover:to-green-800 transition-all duration-300 transform hover:-translate-y-0.5'
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
