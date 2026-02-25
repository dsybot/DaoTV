/* eslint-disable no-console,@typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

'use client';

import {
  BarChart3,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Heart,
  KeyRound,
  LogOut,
  PlayCircle,
  Settings,
  Shield,
  Tv,
  User,
  Users,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { CURRENT_VERSION } from '@/lib/version';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';
import {
  getCachedWatchingUpdates,
  getDetailedWatchingUpdates,
  subscribeToWatchingUpdatesEvent,
  checkWatchingUpdates,
  type WatchingUpdate,
} from '@/lib/watching-updates';
import {
  getAllPlayRecords,
  forceRefreshPlayRecordsCache,
  type PlayRecord,
} from '@/lib/db.client';
import type { Favorite } from '@/lib/types';
import { isSeriesCompleted } from '@/lib/utils';

import { useDownload } from '@/contexts/DownloadContext';

import { VersionPanel } from './VersionPanel';
import VideoCard from './VideoCard';
import {
  useWatchRoomConfigQuery,
  useServerConfigQuery,
  useVersionCheckQuery,
  usePlayRecordsQuery,
  useFavoritesQuery,
  useChangePasswordMutation,
  useInvalidateUserMenuData,
} from '@/hooks/useUserMenuQueries';

interface AuthInfo {
  username?: string;
  role?: 'owner' | 'admin' | 'user';
}

export const UserMenu: React.FC = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isVersionPanelOpen, setIsVersionPanelOpen] = useState(false);
  const [isWatchingUpdatesOpen, setIsWatchingUpdatesOpen] = useState(false);
  const [isContinueWatchingOpen, setIsContinueWatchingOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);
  const [storageType, setStorageType] = useState<string>(() => {
    // 🔧 优化：直接从 RUNTIME_CONFIG 读取初始值，避免默认值导致的多次渲染
    if (typeof window !== 'undefined') {
      return (window as any).RUNTIME_CONFIG?.STORAGE_TYPE || 'localstorage';
    }
    return 'localstorage';
  });
  const [mounted, setMounted] = useState(false);
  const [watchingUpdates, setWatchingUpdates] = useState<WatchingUpdate | null>(null);
  const [hasUnreadUpdates, setHasUnreadUpdates] = useState(false);
  // 🚀 TanStack Query - 观影室配置
  const { data: showWatchRoom = false } = useWatchRoomConfigQuery();
  // 🚀 TanStack Query - 下载功能配置
  const { data: serverConfig } = useServerConfigQuery();
  const downloadEnabled = serverConfig?.downloadEnabled ?? true;
  const { tasks, setShowDownloadPanel } = useDownload();

  // 🚀 TanStack Query - 数据失效工具
  const { invalidatePlayRecords, invalidateFavorites } = useInvalidateUserMenuData();

  // Body 滚动锁定 - 使用 overflow 方式避免布局问题
  useEffect(() => {
    if (isSettingsOpen || isChangePasswordOpen || isWatchingUpdatesOpen || isContinueWatchingOpen || isFavoritesOpen) {
      const body = document.body;
      const html = document.documentElement;

      // 保存原始样式
      const originalBodyOverflow = body.style.overflow;
      const originalHtmlOverflow = html.style.overflow;

      // 只设置 overflow 来阻止滚动
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';

      return () => {

        // 恢复所有原始样式
        body.style.overflow = originalBodyOverflow;
        html.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isSettingsOpen, isChangePasswordOpen, isWatchingUpdatesOpen, isContinueWatchingOpen, isFavoritesOpen]);

  // 设置相关状态
  const [defaultAggregateSearch, setDefaultAggregateSearch] = useState(true);
  const [doubanProxyUrl, setDoubanProxyUrl] = useState('');
  const [enableOptimization, setEnableOptimization] = useState(false);
  const [fluidSearch, setFluidSearch] = useState(true);
  const [liveDirectConnect, setLiveDirectConnect] = useState(false);
  const [playerBufferMode, setPlayerBufferMode] = useState<
    'standard' | 'enhanced' | 'max'
  >('standard');
  const [doubanDataSource, setDoubanDataSource] = useState('direct');
  const [doubanImageProxyType, setDoubanImageProxyType] = useState('direct');
  const [doubanImageProxyUrl, setDoubanImageProxyUrl] = useState('');
  const [continueWatchingMinProgress, setContinueWatchingMinProgress] = useState(5);
  const [continueWatchingMaxProgress, setContinueWatchingMaxProgress] = useState(100);
  const [enableContinueWatchingFilter, setEnableContinueWatchingFilter] = useState(false);
  const [isDoubanDropdownOpen, setIsDoubanDropdownOpen] = useState(false);
  const [isDoubanImageProxyDropdownOpen, setIsDoubanImageProxyDropdownOpen] =
    useState(false);
  // 跳过片头片尾相关设置
  const [enableAutoSkip, setEnableAutoSkip] = useState(true);
  const [enableAutoNextEpisode, setEnableAutoNextEpisode] = useState(true);

  // 清空继续观看确认设置（默认关闭，需要的用户可以开启）
  const [requireClearConfirmation, setRequireClearConfirmation] = useState(false);

  // 下载相关设置
  const [downloadFormat, setDownloadFormat] = useState<'TS' | 'MP4'>('TS');
  // 精确搜索开关
  const [exactSearch, setExactSearch] = useState(true);

  // Emby 配置相关状态
  const [embyConfig, setEmbyConfig] = useState<{
    sources: Array<{
      key: string;
      name: string;
      enabled: boolean;
      ServerURL: string;
      ApiKey?: string;
      Username?: string;
      Password?: string;
      // 高级选项
      removeEmbyPrefix?: boolean;
      appendMediaSourceId?: boolean;
      transcodeMp4?: boolean;
      proxyPlay?: boolean;
    }>;
  }>({ sources: [] });
  const [embySaving, setEmbySaving] = useState(false);
  const [showEmbyToast, setShowEmbyToast] = useState(false);
  const [embyToastMessage, setEmbyToastMessage] = useState('');
  const [embyToastType, setEmbyToastType] = useState<'success' | 'error'>('success');

  // 豆瓣数据源选项
  const doubanDataSourceOptions = [
    { value: 'direct', label: '直连（服务器直接请求豆瓣）' },
    { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云）',
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
    { value: 'custom', label: '自定义代理' },
  ];

  // 豆瓣图片代理选项
  const doubanImageProxyTypeOptions = [
    { value: 'direct', label: '直连（浏览器直接请求豆瓣）' },
    { value: 'server', label: '服务器代理（由服务器代理请求豆瓣）' },
    { value: 'img3', label: '豆瓣官方精品 CDN（阿里云）' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云）',
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
    { value: 'baidu', label: '百度图片代理（境内CDN，Chrome可能触发下载）' },
    { value: 'custom', label: '自定义代理' },
  ];

  // 播放缓冲模式选项
  const bufferModeOptions = [
    {
      value: 'standard' as const,
      label: '默认模式',
      description: '标准缓冲设置，适合网络稳定的环境',
      icon: '🎯',
      color: 'green',
    },
    {
      value: 'enhanced' as const,
      label: '增强模式',
      description: '1.5倍缓冲，适合偶尔卡顿的网络环境',
      icon: '⚡',
      color: 'blue',
    },
    {
      value: 'max' as const,
      label: '强力模式',
      description: '3倍大缓冲，起播稍慢但播放更流畅',
      icon: '🚀',
      color: 'purple',
    },
  ];

  // 修改密码相关状态
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // 🚀 TanStack Query - 版本检查
  const { data: updateStatus = null, isLoading: isChecking } = useVersionCheckQuery();

  // 数据查询条件
  const dataQueryEnabled = typeof window !== 'undefined' && !!authInfo?.username && storageType !== 'localstorage';

  // 🚀 TanStack Query - 播放记录
  const { data: playRecords = [] } = usePlayRecordsQuery({
    enabled: dataQueryEnabled,
    enableFilter: enableContinueWatchingFilter,
    minProgress: continueWatchingMinProgress,
    maxProgress: continueWatchingMaxProgress,
  });

  // 🚀 TanStack Query - 收藏列表
  const { data: favorites = [] } = useFavoritesQuery({
    enabled: dataQueryEnabled,
  });

  // 🚀 TanStack Query - 修改密码
  const changePasswordMutation = useChangePasswordMutation();

  // 确保组件已挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 🚀 预加载导航页面 - 当菜单打开时预加载所有可能访问的页面
  useEffect(() => {
    if (isOpen) {
      // 预加载管理面板（仅 owner/admin 有权限）
      if (authInfo?.role === 'owner' || authInfo?.role === 'admin') {
        router.prefetch('/admin');
      }
      // 预加载播放统计（所有登录用户，且非 localstorage 存储）
      if (authInfo?.username && storageType !== 'localstorage') {
        router.prefetch('/play-stats');
      }
      // 预加载 TVBox 配置（所有人都能访问）
      router.prefetch('/tvbox');
      // 预加载观影室（如果功能启用，所有人都能访问）
      if (showWatchRoom) {
        router.prefetch('/watch-room');
      }
      // 预加载发布日历（所有人都能访问）
      router.prefetch('/release-calendar');
    }
  }, [isOpen, authInfo, storageType, showWatchRoom, router]);

  // 获取认证信息
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = getAuthInfoFromBrowserCookie();
      setAuthInfo(auth);
    }
  }, []);

  // 加载用户 Emby 配置
  useEffect(() => {
    if (isSettingsOpen) {
      fetch('/api/user/emby-config')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.config) {
            setEmbyConfig(data.config);
          }
        })
        .catch(err => console.error('加载 Emby 配置失败:', err));
    }
  }, [isSettingsOpen]);

  // 🚀 观影室配置和下载配置由 TanStack Query 自动管理

  // 从 localStorage 读取设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAggregateSearch = localStorage.getItem(
        'defaultAggregateSearch'
      );
      if (savedAggregateSearch !== null) {
        setDefaultAggregateSearch(JSON.parse(savedAggregateSearch));
      }

      const savedDoubanDataSource = localStorage.getItem('doubanDataSource');
      const defaultDoubanProxyType =
        (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY_TYPE || 'direct';
      if (savedDoubanDataSource !== null) {
        setDoubanDataSource(savedDoubanDataSource);
      } else if (defaultDoubanProxyType) {
        setDoubanDataSource(defaultDoubanProxyType);
      }

      const savedDoubanProxyUrl = localStorage.getItem('doubanProxyUrl');
      const defaultDoubanProxy =
        (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY || '';
      if (savedDoubanProxyUrl !== null) {
        setDoubanProxyUrl(savedDoubanProxyUrl);
      } else if (defaultDoubanProxy) {
        setDoubanProxyUrl(defaultDoubanProxy);
      }

      const savedDoubanImageProxyType = localStorage.getItem(
        'doubanImageProxyType'
      );
      const defaultDoubanImageProxyType =
        (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE || 'direct';
      if (savedDoubanImageProxyType !== null) {
        setDoubanImageProxyType(savedDoubanImageProxyType);
      } else if (defaultDoubanImageProxyType) {
        setDoubanImageProxyType(defaultDoubanImageProxyType);
      }

      const savedDoubanImageProxyUrl = localStorage.getItem(
        'doubanImageProxyUrl'
      );
      const defaultDoubanImageProxyUrl =
        (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY || '';
      if (savedDoubanImageProxyUrl !== null) {
        setDoubanImageProxyUrl(savedDoubanImageProxyUrl);
      } else if (defaultDoubanImageProxyUrl) {
        setDoubanImageProxyUrl(defaultDoubanImageProxyUrl);
      }

      const savedEnableOptimization =
        localStorage.getItem('enableOptimization');
      if (savedEnableOptimization !== null) {
        setEnableOptimization(JSON.parse(savedEnableOptimization));
      }

      const savedFluidSearch = localStorage.getItem('fluidSearch');
      const defaultFluidSearch =
        (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
      if (savedFluidSearch !== null) {
        setFluidSearch(JSON.parse(savedFluidSearch));
      } else if (defaultFluidSearch !== undefined) {
        setFluidSearch(defaultFluidSearch);
      }

      const savedLiveDirectConnect = localStorage.getItem('liveDirectConnect');
      if (savedLiveDirectConnect !== null) {
        setLiveDirectConnect(JSON.parse(savedLiveDirectConnect));
      }

      // 读取播放缓冲模式
      const savedBufferMode = localStorage.getItem('playerBufferMode');
      if (
        savedBufferMode === 'standard' ||
        savedBufferMode === 'enhanced' ||
        savedBufferMode === 'max'
      ) {
        setPlayerBufferMode(savedBufferMode);
      }

      const savedContinueWatchingMinProgress = localStorage.getItem('continueWatchingMinProgress');
      if (savedContinueWatchingMinProgress !== null) {
        setContinueWatchingMinProgress(parseInt(savedContinueWatchingMinProgress));
      }

      const savedContinueWatchingMaxProgress = localStorage.getItem('continueWatchingMaxProgress');
      if (savedContinueWatchingMaxProgress !== null) {
        setContinueWatchingMaxProgress(parseInt(savedContinueWatchingMaxProgress));
      }

      const savedEnableContinueWatchingFilter = localStorage.getItem('enableContinueWatchingFilter');
      if (savedEnableContinueWatchingFilter !== null) {
        setEnableContinueWatchingFilter(JSON.parse(savedEnableContinueWatchingFilter));
      }

      // 读取跳过片头片尾设置（默认开启）
      const savedEnableAutoSkip = localStorage.getItem('enableAutoSkip');
      if (savedEnableAutoSkip !== null) {
        setEnableAutoSkip(JSON.parse(savedEnableAutoSkip));
      }

      const savedEnableAutoNextEpisode = localStorage.getItem('enableAutoNextEpisode');
      if (savedEnableAutoNextEpisode !== null) {
        setEnableAutoNextEpisode(JSON.parse(savedEnableAutoNextEpisode));
      }

      // 读取清空继续观看确认设置（默认关闭）
      const savedRequireClearConfirmation = localStorage.getItem('requireClearConfirmation');
      if (savedRequireClearConfirmation !== null) {
        setRequireClearConfirmation(JSON.parse(savedRequireClearConfirmation));
      }

      // 读取下载格式设置
      const savedDownloadFormat = localStorage.getItem('downloadFormat');
      if (savedDownloadFormat === 'TS' || savedDownloadFormat === 'MP4') {
        setDownloadFormat(savedDownloadFormat);
      }

      // 加载精确搜索设置
      const savedExactSearch = localStorage.getItem('exactSearch');
      if (savedExactSearch !== null) {
        setExactSearch(savedExactSearch === 'true');
      }
    }
  }, []);

  // 🚀 版本检查由 TanStack Query 自动管理

  // 获取观看更新信息
  useEffect(() => {
    console.log('UserMenu watching-updates 检查条件:', {
      'window': typeof window !== 'undefined',
      'authInfo.username': authInfo?.username,
      'storageType': storageType,
      'storageType !== localstorage': storageType !== 'localstorage'
    });

    if (typeof window !== 'undefined' && authInfo?.username && storageType !== 'localstorage') {
      console.log('开始加载 watching-updates 数据...');

      const updateWatchingUpdates = () => {
        const updates = getDetailedWatchingUpdates();
        console.log('getDetailedWatchingUpdates 返回:', updates);
        setWatchingUpdates(updates);

        // 检测是否有新更新（只检查新剧集更新，不包括继续观看）
        if (updates && (updates.updatedCount || 0) > 0) {
          const lastViewed = parseInt(localStorage.getItem('watchingUpdatesLastViewed') || '0');
          const currentTime = Date.now();

          // 如果从未查看过，或者距离上次查看超过1分钟，认为有新更新
          const hasNewUpdates = lastViewed === 0 || (currentTime - lastViewed > 60000);
          setHasUnreadUpdates(hasNewUpdates);
        } else {
          setHasUnreadUpdates(false);
        }
      };

      // 页面初始化时检查更新（使用缓存机制）
      const forceInitialCheck = async () => {
        console.log('页面初始化，检查更新...');
        try {
          // 🔧 修复：不使用强制刷新，让缓存机制生效（30分钟）
          // 如果缓存有效，直接使用缓存；如果过期，自动重新检查
          await checkWatchingUpdates();

          // 更新UI
          updateWatchingUpdates();
          console.log('页面初始化更新检查完成');
        } catch (error) {
          console.error('页面初始化检查更新失败:', error);
          // 失败时仍然尝试从缓存加载
          updateWatchingUpdates();
        }
      };

      // 先尝试从缓存加载，然后强制检查
      const cachedUpdates = getCachedWatchingUpdates();
      if (cachedUpdates) {
        console.log('发现缓存数据，先加载缓存');
        updateWatchingUpdates();
      }

      // 🔧 修复：延迟1秒后在后台执行更新检查，避免阻塞页面初始加载
      setTimeout(() => {
        forceInitialCheck();
      }, 1000);

      // 订阅更新事件
      const unsubscribe = subscribeToWatchingUpdatesEvent(() => {
        console.log('收到 watching-updates 事件，更新数据...');
        updateWatchingUpdates();
      });

      return unsubscribe;
    } else {
      console.log('watching-updates 条件不满足，跳过加载');
    }
  }, [authInfo, storageType]);

  // 🚀 播放记录和收藏由 TanStack Query 自动管理
  // 监听事件来触发 TanStack Query 缓存失效
  useEffect(() => {
    if (!dataQueryEnabled) return;

    const handlePlayRecordsUpdate = () => {
      console.log('UserMenu: 播放记录更新，invalidate query');
      invalidatePlayRecords();
    };

    const handleFavoritesUpdate = () => {
      console.log('UserMenu: 收藏更新，invalidate query');
      invalidateFavorites();
    };

    window.addEventListener('playRecordsUpdated', handlePlayRecordsUpdate);
    window.addEventListener('favoritesUpdated', handleFavoritesUpdate);

    // 监听watching-updates事件，刷新播放记录
    const unsubscribeWatchingUpdates = subscribeToWatchingUpdatesEvent(() => {
      const updates = getDetailedWatchingUpdates();
      if (updates && updates.hasUpdates && updates.updatedCount > 0) {
        console.log('UserMenu: 检测到新集数更新，invalidate play records');
        invalidatePlayRecords();
      }
    });

    return () => {
      window.removeEventListener('playRecordsUpdated', handlePlayRecordsUpdate);
      window.removeEventListener('favoritesUpdated', handleFavoritesUpdate);
      unsubscribeWatchingUpdates();
    };
  }, [dataQueryEnabled, invalidatePlayRecords, invalidateFavorites]);

  // 点击外部区域关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-datasource"]')) {
          setIsDoubanDropdownOpen(false);
        }
      }
    };

    if (isDoubanDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanImageProxyDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-image-proxy"]')) {
          setIsDoubanImageProxyDropdownOpen(false);
        }
      }
    };

    if (isDoubanImageProxyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanImageProxyDropdownOpen]);

  const handleMenuClick = async () => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);

    // 如果是打开菜单，立即检查更新（不受缓存限制）
    if (willOpen && authInfo?.username && storageType !== 'localstorage') {
      console.log('打开菜单时强制检查更新...');
      try {
        // 暂时清除缓存时间，强制检查一次
        const lastCheckTime = localStorage.getItem('moontv_last_update_check');
        localStorage.removeItem('moontv_last_update_check');

        // 执行检查
        await checkWatchingUpdates();

        // 恢复缓存时间（如果之前有的话）
        if (lastCheckTime) {
          localStorage.setItem('moontv_last_update_check', lastCheckTime);
        }

        // 更新UI状态
        const updates = getDetailedWatchingUpdates();
        setWatchingUpdates(updates);

        // 重新计算未读状态
        if (updates && (updates.updatedCount || 0) > 0) {
          const lastViewed = parseInt(localStorage.getItem('watchingUpdatesLastViewed') || '0');
          const currentTime = Date.now();
          const hasNewUpdates = lastViewed === 0 || (currentTime - lastViewed > 60000);
          setHasUnreadUpdates(hasNewUpdates);
        } else {
          setHasUnreadUpdates(false);
        }

        console.log('菜单打开时的更新检查完成');
      } catch (error) {
        console.error('菜单打开时检查更新失败:', error);
      }
    }
  };

  const handleCloseMenu = () => {
    setIsOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('注销请求失败:', error);
    }
    window.location.href = '/';
  };

  const handleAdminPanel = () => {
    setIsOpen(false);
    router.refresh();
    // 使用 startTransition 优化导航性能
    startTransition(() => {
      router.push('/admin');
    });
  };

  const handlePlayStats = () => {
    setIsOpen(false);
    router.refresh();
    // 使用 startTransition 优化导航性能
    startTransition(() => {
      router.push('/play-stats');
    });
  };

  const handleTVBoxConfig = () => {
    setIsOpen(false);
    router.refresh();
    // 使用 startTransition 优化导航性能
    startTransition(() => {
      router.push('/tvbox');
    });
  };

  const handleWatchRoom = () => {
    setIsOpen(false);
    router.refresh();
    // 使用 startTransition 优化导航性能
    startTransition(() => {
      router.push('/watch-room');
    });
  };

  const handleReleaseCalendar = () => {
    setIsOpen(false);
    router.refresh();
    // 使用 startTransition 优化导航性能
    startTransition(() => {
      router.push('/release-calendar');
    });
  };

  const handleWatchingUpdates = () => {
    setIsOpen(false);
    setIsWatchingUpdatesOpen(true);
    // 标记为已读
    setHasUnreadUpdates(false);
    const currentTime = Date.now();
    localStorage.setItem('watchingUpdatesLastViewed', currentTime.toString());
  };

  const handleCloseWatchingUpdates = () => {
    setIsWatchingUpdatesOpen(false);
  };

  const handleContinueWatching = () => {
    setIsOpen(false);
    setIsContinueWatchingOpen(true);
  };

  const handleCloseContinueWatching = () => {
    setIsContinueWatchingOpen(false);
  };

  const handleFavorites = () => {
    setIsOpen(false);
    setIsFavoritesOpen(true);
  };

  const handleCloseFavorites = () => {
    setIsFavoritesOpen(false);
  };

  // 从 key 中解析 source 和 id
  const parseKey = (key: string) => {
    const [source, id] = key.split('+');
    return { source, id };
  };

  // 计算播放进度百分比
  const getProgress = (record: PlayRecord) => {
    if (record.total_time === 0) return 0;
    return (record.play_time / record.total_time) * 100;
  };

  // 检查播放记录是否有新集数更新
  const getNewEpisodesCount = (record: PlayRecord & { key: string }): number => {
    if (!watchingUpdates || !watchingUpdates.updatedSeries) return 0;

    const { source, id } = parseKey(record.key);

    // 在watchingUpdates中查找匹配的剧集
    const matchedSeries = watchingUpdates.updatedSeries.find(series =>
      series.sourceKey === source &&
      series.videoId === id &&
      series.hasNewEpisode
    );

    return matchedSeries ? (matchedSeries.newEpisodes || 0) : 0;
  };

  const handleChangePassword = () => {
    setIsOpen(false);
    setIsChangePasswordOpen(true);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleCloseChangePassword = () => {
    setIsChangePasswordOpen(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleSubmitChangePassword = async () => {
    setPasswordError('');

    // 验证密码
    if (!newPassword) {
      setPasswordError('新密码不得为空');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }

    setPasswordLoading(true);

    changePasswordMutation.mutate(newPassword, {
      onSuccess: async () => {
        // 修改成功，关闭弹窗并登出
        setIsChangePasswordOpen(false);
        await handleLogout();
      },
      onError: (error) => {
        setPasswordError(error.message || '网络错误，请稍后重试');
      },
      onSettled: () => {
        setPasswordLoading(false);
      },
    });
  };

  const handleSettings = () => {
    setIsOpen(false);
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  // 设置相关的处理函数
  const handleAggregateToggle = (value: boolean) => {
    setDefaultAggregateSearch(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('defaultAggregateSearch', JSON.stringify(value));
    }
  };

  const handleDoubanProxyUrlChange = (value: string) => {
    setDoubanProxyUrl(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanProxyUrl', value);
    }
  };

  const handleOptimizationToggle = (value: boolean) => {
    setEnableOptimization(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enableOptimization', JSON.stringify(value));
    }
  };

  const handleFluidSearchToggle = (value: boolean) => {
    setFluidSearch(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fluidSearch', JSON.stringify(value));
    }
  };

  const handleLiveDirectConnectToggle = (value: boolean) => {
    setLiveDirectConnect(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('liveDirectConnect', JSON.stringify(value));
    }
  };

  const handleBufferModeChange = (value: 'standard' | 'enhanced' | 'max') => {
    setPlayerBufferMode(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('playerBufferMode', value);
    }
  };

  const handleContinueWatchingMinProgressChange = (value: number) => {
    setContinueWatchingMinProgress(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('continueWatchingMinProgress', value.toString());
    }
  };

  const handleContinueWatchingMaxProgressChange = (value: number) => {
    setContinueWatchingMaxProgress(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('continueWatchingMaxProgress', value.toString());
    }
  };

  const handleEnableContinueWatchingFilterToggle = (value: boolean) => {
    setEnableContinueWatchingFilter(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enableContinueWatchingFilter', JSON.stringify(value));
    }
  };

  const handleEnableAutoSkipToggle = (value: boolean) => {
    setEnableAutoSkip(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enableAutoSkip', JSON.stringify(value));
      // 🔑 通知 SkipController localStorage 已更新
      window.dispatchEvent(new Event('localStorageChanged'));
    }
  };

  const handleEnableAutoNextEpisodeToggle = (value: boolean) => {
    setEnableAutoNextEpisode(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enableAutoNextEpisode', JSON.stringify(value));
      // 🔑 通知 SkipController localStorage 已更新
      window.dispatchEvent(new Event('localStorageChanged'));
    }
  };

  const handleRequireClearConfirmationToggle = (value: boolean) => {
    setRequireClearConfirmation(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('requireClearConfirmation', JSON.stringify(value));
    }
  };

  const handleDownloadFormatChange = (value: 'TS' | 'MP4') => {
    setDownloadFormat(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('downloadFormat', value);
    }
  };

  const handleExactSearchToggle = (value: boolean) => {
    setExactSearch(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('exactSearch', String(value));
    }
  };

  const handleDoubanDataSourceChange = (value: string) => {
    setDoubanDataSource(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanDataSource', value);
    }
  };

  const handleDoubanImageProxyTypeChange = (value: string) => {
    setDoubanImageProxyType(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanImageProxyType', value);
    }
  };

  const handleDoubanImageProxyUrlChange = (value: string) => {
    setDoubanImageProxyUrl(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanImageProxyUrl', value);
    }
  };

  // 获取感谢信息
  const getThanksInfo = (dataSource: string) => {
    switch (dataSource) {
      case 'cors-proxy-zwei':
        return {
          text: 'Thanks to @Zwei',
          url: 'https://github.com/bestzwei',
        };
      case 'cmliussss-cdn-tencent':
      case 'cmliussss-cdn-ali':
        return {
          text: 'Thanks to @CMLiussss',
          url: 'https://github.com/cmliu',
        };
      default:
        return null;
    }
  };

  // Emby 配置相关函数
  const showEmbyNotification = (message: string, type: 'success' | 'error') => {
    setEmbyToastMessage(message);
    setEmbyToastType(type);
    setShowEmbyToast(true);
    setTimeout(() => setShowEmbyToast(false), 3000);
  };

  const handleSaveEmbyConfig = async () => {
    setEmbySaving(true);
    try {
      const res = await fetch('/api/user/emby-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: embyConfig }),
      });
      const data = await res.json();
      if (data.success) {
        showEmbyNotification('Emby 配置保存成功！', 'success');
        // 使 ModernNav 的 Emby 配置缓存失效，触发重新检查
        queryClient.invalidateQueries({ queryKey: ['user', 'emby-config'] });
        // 重新加载配置以确认保存成功
        const reloadRes = await fetch('/api/user/emby-config');
        const reloadData = await reloadRes.json();
        if (reloadData.success && reloadData.config) {
          setEmbyConfig(reloadData.config);
        }
      } else {
        showEmbyNotification(`保存失败: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error('保存 Emby 配置失败:', err);
      showEmbyNotification('保存失败，请重试', 'error');
    } finally {
      setEmbySaving(false);
    }
  };

  const handleAddEmbySource = () => {
    setEmbyConfig({
      sources: [
        ...embyConfig.sources,
        {
          key: `emby_${Date.now()}`,
          name: '新 Emby 源',
          enabled: true,
          ServerURL: '',
          ApiKey: '',
        },
      ],
    });
  };

  const handleRemoveEmbySource = (index: number) => {
    setEmbyConfig({
      sources: embyConfig.sources.filter((_, i) => i !== index),
    });
  };

  const handleUpdateEmbySource = (index: number, field: string, value: any) => {
    const newSources = [...embyConfig.sources];
    (newSources[index] as any)[field] = value;
    setEmbyConfig({ sources: newSources });
  };

  const handleResetSettings = () => {
    const defaultDoubanProxyType =
      (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY_TYPE || 'direct';
    const defaultDoubanProxy =
      (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY || '';
    const defaultDoubanImageProxyType =
      (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE || 'direct';
    const defaultDoubanImageProxyUrl =
      (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY || '';
    const defaultFluidSearch =
      (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;

    setDefaultAggregateSearch(true);
    setEnableOptimization(false);
    setFluidSearch(defaultFluidSearch);
    setLiveDirectConnect(false);
    setDoubanProxyUrl(defaultDoubanProxy);
    setDoubanDataSource(defaultDoubanProxyType);
    setDoubanImageProxyType(defaultDoubanImageProxyType);
    setDoubanImageProxyUrl(defaultDoubanImageProxyUrl);
    setContinueWatchingMinProgress(5);
    setContinueWatchingMaxProgress(100);
    setEnableContinueWatchingFilter(false);
    setEnableAutoSkip(true);
    setEnableAutoNextEpisode(true);
    setRequireClearConfirmation(false);
    setPlayerBufferMode('standard');
    setDownloadFormat('TS');

    if (typeof window !== 'undefined') {
      localStorage.setItem('defaultAggregateSearch', JSON.stringify(true));
      localStorage.setItem('enableOptimization', JSON.stringify(false));
      localStorage.setItem('fluidSearch', JSON.stringify(defaultFluidSearch));
      localStorage.setItem('liveDirectConnect', JSON.stringify(false));
      localStorage.setItem('doubanProxyUrl', defaultDoubanProxy);
      localStorage.setItem('doubanDataSource', defaultDoubanProxyType);
      localStorage.setItem('doubanImageProxyType', defaultDoubanImageProxyType);
      localStorage.setItem('doubanImageProxyUrl', defaultDoubanImageProxyUrl);
      localStorage.setItem('continueWatchingMinProgress', '5');
      localStorage.setItem('continueWatchingMaxProgress', '100');
      localStorage.setItem('enableContinueWatchingFilter', JSON.stringify(false));
      localStorage.setItem('enableAutoSkip', JSON.stringify(true));
      localStorage.setItem('enableAutoNextEpisode', JSON.stringify(true));
      localStorage.setItem('requireClearConfirmation', JSON.stringify(false));
      localStorage.setItem('playerBufferMode', 'standard');
      localStorage.setItem('downloadFormat', 'TS');
    }
  };

  // 检查是否显示管理面板按钮
  const showAdminPanel =
    authInfo?.role === 'owner' || authInfo?.role === 'admin';

  // 检查是否显示修改密码按钮
  const showChangePassword =
    authInfo?.role !== 'owner' && storageType !== 'localstorage';

  // 检查是否显示播放统计按钮（所有登录用户，且非localstorage存储）
  const showPlayStats = authInfo?.username && storageType !== 'localstorage';

  // 检查是否显示更新提醒按钮（登录用户且非localstorage存储就显示）
  const showWatchingUpdates = authInfo?.username && storageType !== 'localstorage';

  // 检查是否有实际更新（用于显示红点）- 只检查新剧集更新
  const hasActualUpdates = watchingUpdates && (watchingUpdates.updatedCount || 0) > 0;

  // 计算更新数量（只统计新剧集更新）
  const totalUpdates = watchingUpdates?.updatedCount || 0;

  // 调试信息
  console.log('UserMenu 更新提醒调试:', {
    username: authInfo?.username,
    storageType,
    watchingUpdates,
    showWatchingUpdates,
    hasActualUpdates,
    totalUpdates
  });

  // 角色中文映射
  const getRoleText = (role?: string) => {
    switch (role) {
      case 'owner':
        return '站长';
      case 'admin':
        return '管理员';
      case 'user':
        return '用户';
      default:
        return '';
    }
  };

  // 菜单面板内容
  const menuPanel = (
    <>
      {/* 背景遮罩 - 普通菜单无需模糊 */}
      <div
        className='fixed inset-0 bg-transparent z-1000'
        onClick={handleCloseMenu}
      />

      {/* 菜单面板 */}
      <div className='fixed top-14 right-4 w-56 bg-white dark:bg-gray-900 rounded-lg shadow-xl z-1001 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden select-none'>
        {/* 用户信息区域 */}
        <div className='px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-800/50'>
          <div className='space-y-1'>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                当前用户
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${(authInfo?.role || 'user') === 'owner'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                  : (authInfo?.role || 'user') === 'admin'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  }`}
              >
                {getRoleText(authInfo?.role || 'user')}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <div className='font-semibold text-gray-900 dark:text-gray-100 text-sm truncate'>
                {authInfo?.username || 'default'}
              </div>
              <div className='text-[10px] text-gray-400 dark:text-gray-500'>
                数据存储：
                {storageType === 'localstorage' ? '本地' : storageType}
              </div>
            </div>
          </div>
        </div>

        {/* 菜单项 */}
        <div className='py-1'>
          {/* 设置按钮 */}
          <button
            onClick={handleSettings}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-150 ease-in-out text-sm'
          >
            <Settings className='w-4 h-4 text-gray-500 dark:text-gray-400' />
            <span className='font-medium'>设置</span>
          </button>

          {/* 更新提醒按钮 */}
          {showWatchingUpdates && (
            <button
              onClick={handleWatchingUpdates}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-150 ease-in-out text-sm relative'
            >
              <Bell className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>更新提醒</span>
              {hasUnreadUpdates && totalUpdates > 0 && (
                <div className='ml-auto flex items-center gap-1'>
                  <span className='inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full'>
                    {totalUpdates > 99 ? '99+' : totalUpdates}
                  </span>
                </div>
              )}
            </button>
          )}

          {/* 继续观看按钮 */}
          {showWatchingUpdates && (
            <button
              onClick={handleContinueWatching}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-150 ease-in-out text-sm relative'
            >
              <PlayCircle className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>继续观看</span>
              {playRecords.length > 0 && (
                <span className='ml-auto text-xs text-gray-400'>{playRecords.length}</span>
              )}
            </button>
          )}

          {/* 我的收藏按钮 */}
          {showWatchingUpdates && (
            <button
              onClick={handleFavorites}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-150 ease-in-out text-sm relative'
            >
              <Heart className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>我的收藏</span>
              {favorites.length > 0 && (
                <span className='ml-auto text-xs text-gray-400'>{favorites.length}</span>
              )}
            </button>
          )}

          {/* 管理面板按钮 */}
          {showAdminPanel && (
            <button
              onClick={handleAdminPanel}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-150 ease-in-out text-sm'
            >
              <Shield className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>管理面板</span>
            </button>
          )}

          {/* 播放统计按钮 */}
          {showPlayStats && (
            <button
              onClick={handlePlayStats}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-150 ease-in-out text-sm'
            >
              <BarChart3 className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>
                {authInfo?.role === 'owner' || authInfo?.role === 'admin' ? '播放统计' : '个人统计'}
              </span>
            </button>
          )}

          {/* 上映日程按钮 */}
          <button
            onClick={handleReleaseCalendar}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-150 ease-in-out text-sm'
          >
            <Calendar className='w-4 h-4 text-gray-500 dark:text-gray-400' />
            <span className='font-medium'>上映日程</span>
          </button>

          {/* TVBox配置按钮 */}
          <button
            onClick={handleTVBoxConfig}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-150 ease-in-out text-sm'
          >
            <Tv className='w-4 h-4 text-gray-500 dark:text-gray-400' />
            <span className='font-medium'>TVBox 配置</span>
          </button>

          {/* 观影室按钮 */}
          {showWatchRoom && (
            <button
              onClick={handleWatchRoom}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-150 ease-in-out text-sm'
            >
              <Users className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>观影室</span>
            </button>
          )}

          {/* 下载管理按钮 */}
          {downloadEnabled && (
            <button
              onClick={() => {
                setShowDownloadPanel(true);
                handleCloseMenu();
              }}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-150 ease-in-out text-sm'
            >
              <Download className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>下载管理</span>
              {tasks.filter(t => t.status === 'downloading').length > 0 && (
                <span className='ml-auto flex items-center gap-1'>
                  <span className='relative flex h-2 w-2'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'></span>
                    <span className='relative inline-flex rounded-full h-2 w-2 bg-green-500'></span>
                  </span>
                  <span className='text-xs text-green-600 dark:text-green-400'>
                    {tasks.filter(t => t.status === 'downloading').length}
                  </span>
                </span>
              )}
              {tasks.length > 0 && tasks.filter(t => t.status === 'downloading').length === 0 && (
                <span className='ml-auto text-xs text-gray-400'>{tasks.length}</span>
              )}
            </button>
          )}

          {/* 修改密码按钮 */}
          {showChangePassword && (
            <button
              onClick={handleChangePassword}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-150 ease-in-out text-sm'
            >
              <KeyRound className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>修改密码</span>
            </button>
          )}

          {/* 分割线 */}
          <div className='my-1 border-t border-gray-200 dark:border-gray-700'></div>

          {/* 登出按钮 */}
          <button
            onClick={handleLogout}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-[background-color] duration-150 ease-in-out text-sm'
          >
            <LogOut className='w-4 h-4' />
            <span className='font-medium'>登出</span>
          </button>

          {/* 分割线 */}
          <div className='my-1 border-t border-gray-200 dark:border-gray-700'></div>

          {/* 版本信息 */}
          <button
            onClick={() => {
              setIsVersionPanelOpen(true);
              handleCloseMenu();
            }}
            className='w-full px-3 py-2 text-center flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-xs'
          >
            <div className='flex items-center gap-1'>
              <span className='font-mono'>v{CURRENT_VERSION}</span>
              {!isChecking &&
                updateStatus &&
                updateStatus !== UpdateStatus.FETCH_FAILED && (
                  <div
                    className={`w-2 h-2 rounded-full -translate-y-2 ${updateStatus === UpdateStatus.HAS_UPDATE
                      ? 'bg-yellow-500'
                      : updateStatus === UpdateStatus.NO_UPDATE
                        ? 'bg-green-400'
                        : ''
                      }`}
                  ></div>
                )}
            </div>
          </button>
        </div>
      </div>
    </>
  );

  // 设置面板内容
  const settingsPanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-black/50 z-1000'
        onClick={handleCloseSettings}
        onTouchMove={(e) => {
          // 只阻止滚动，允许其他触摸事件
          e.preventDefault();
        }}
        onWheel={(e) => {
          // 阻止滚轮滚动
          e.preventDefault();
        }}
        style={{
          touchAction: 'none',
        }}
      />

      {/* 设置面板 */}
      <div
        className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-xl z-1001 flex flex-col'
      >
        {/* 内容容器 - 独立的滚动区域 */}
        <div
          className='flex-1 p-6 overflow-y-auto'
          data-panel-content
          style={{
            touchAction: 'pan-y', // 只允许垂直滚动
            overscrollBehavior: 'contain', // 防止滚动冒泡
          }}
        >
          {/* 标题栏 */}
          <div className='flex items-center justify-between mb-6'>
            <div className='flex items-center gap-3'>
              <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                本地设置
              </h3>
              <button
                onClick={handleResetSettings}
                className='px-2 py-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors'
                title='重置为默认设置'
              >
                恢复默认
              </button>
            </div>
            <button
              onClick={handleCloseSettings}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>

          {/* 设置项 */}
          <div className='space-y-6'>
            {/* Emby 配置 */}
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    Emby 配置
                  </h4>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    配置你的私人 Emby 服务器
                  </p>
                </div>
                <button
                  onClick={handleAddEmbySource}
                  className='px-3 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors'
                >
                  添加源
                </button>
              </div>

              {embyConfig.sources.length === 0 ? (
                <div className='text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                  暂无 Emby 源，点击"添加源"开始配置
                </div>
              ) : (
                <div className='space-y-4'>
                  {embyConfig.sources.map((source, index) => (
                    <div
                      key={source.key}
                      className='p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3'
                    >
                      <div className='flex items-center justify-between'>
                        <input
                          type='text'
                          value={source.name}
                          onChange={(e) => handleUpdateEmbySource(index, 'name', e.target.value)}
                          className='flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          placeholder='源名称'
                        />
                        <button
                          onClick={() => handleRemoveEmbySource(index)}
                          className='ml-2 px-2 py-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                        >
                          删除
                        </button>
                      </div>

                      <input
                        type='text'
                        value={source.ServerURL}
                        onChange={(e) => handleUpdateEmbySource(index, 'ServerURL', e.target.value)}
                        className='w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                        placeholder='服务器地址 (如: http://192.168.1.100:8096)'
                      />

                      <input
                        type='text'
                        value={source.ApiKey || ''}
                        onChange={(e) => handleUpdateEmbySource(index, 'ApiKey', e.target.value)}
                        className='w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                        placeholder='API Key (推荐)'
                      />

                      <div className='flex items-center gap-2'>
                        <input
                          type='text'
                          value={source.Username || ''}
                          onChange={(e) => handleUpdateEmbySource(index, 'Username', e.target.value)}
                          className='flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          placeholder='用户名 (可选)'
                        />
                        <input
                          type='password'
                          value={source.Password || ''}
                          onChange={(e) => handleUpdateEmbySource(index, 'Password', e.target.value)}
                          className='flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          placeholder='密码 (可选)'
                        />
                      </div>

                      <label className='flex items-center gap-2 text-sm'>
                        <input
                          type='checkbox'
                          checked={source.enabled}
                          onChange={(e) => handleUpdateEmbySource(index, 'enabled', e.target.checked)}
                          className='w-4 h-4 text-green-500 border-gray-300 rounded focus:ring-green-500'
                        />
                        <span className='text-gray-700 dark:text-gray-300'>启用此源</span>
                      </label>

                      {/* 高级选项 */}
                      <details className='mt-2'>
                        <summary className='text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200'>
                          高级选项
                        </summary>
                        <div className='mt-2 space-y-2 pl-2 border-l-2 border-gray-200 dark:border-gray-700'>
                          <label className='flex items-center gap-2 text-xs'>
                            <input
                              type='checkbox'
                              checked={source.transcodeMp4 || false}
                              onChange={(e) => handleUpdateEmbySource(index, 'transcodeMp4', e.target.checked)}
                              className='w-3 h-3 text-blue-500 border-gray-300 rounded focus:ring-blue-500'
                            />
                            <span className='text-gray-600 dark:text-gray-400'>转码mp4（推荐MKV格式启用）</span>
                          </label>
                          <label className='flex items-center gap-2 text-xs'>
                            <input
                              type='checkbox'
                              checked={source.proxyPlay || false}
                              onChange={(e) => handleUpdateEmbySource(index, 'proxyPlay', e.target.checked)}
                              className='w-3 h-3 text-blue-500 border-gray-300 rounded focus:ring-blue-500'
                            />
                            <span className='text-gray-600 dark:text-gray-400'>视频播放代理</span>
                          </label>
                          <label className='flex items-center gap-2 text-xs'>
                            <input
                              type='checkbox'
                              checked={source.removeEmbyPrefix || false}
                              onChange={(e) => handleUpdateEmbySource(index, 'removeEmbyPrefix', e.target.checked)}
                              className='w-3 h-3 text-blue-500 border-gray-300 rounded focus:ring-blue-500'
                            />
                            <span className='text-gray-600 dark:text-gray-400'>移除/emby前缀</span>
                          </label>
                          <label className='flex items-center gap-2 text-xs'>
                            <input
                              type='checkbox'
                              checked={source.appendMediaSourceId || false}
                              onChange={(e) => handleUpdateEmbySource(index, 'appendMediaSourceId', e.target.checked)}
                              className='w-3 h-3 text-blue-500 border-gray-300 rounded focus:ring-blue-500'
                            />
                            <span className='text-gray-600 dark:text-gray-400'>拼接MediaSourceId参数</span>
                          </label>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}

              {embyConfig.sources.length > 0 && (
                <button
                  onClick={handleSaveEmbyConfig}
                  disabled={embySaving}
                  className='w-full px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 rounded-lg transition-colors'
                >
                  {embySaving ? '保存中...' : '保存 Emby 配置'}
                </button>
              )}
            </div>

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700'></div>

            {/* 豆瓣数据源选择 */}
            <div className='space-y-3'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  豆瓣数据代理
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  选择获取豆瓣数据的方式
                </p>
              </div>
              <div className='relative' data-dropdown='douban-datasource'>
                {/* 自定义下拉选择框 */}
                <button
                  type='button'
                  onClick={() => setIsDoubanDropdownOpen(!isDoubanDropdownOpen)}
                  className='w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 text-left'
                >
                  {
                    doubanDataSourceOptions.find(
                      (option) => option.value === doubanDataSource
                    )?.label
                  }
                </button>

                {/* 下拉箭头 */}
                <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isDoubanDropdownOpen ? 'rotate-180' : ''
                      }`}
                  />
                </div>

                {/* 下拉选项列表 */}
                {isDoubanDropdownOpen && (
                  <div className='absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto'>
                    {doubanDataSourceOptions.map((option) => (
                      <button
                        key={option.value}
                        type='button'
                        onClick={() => {
                          handleDoubanDataSourceChange(option.value);
                          setIsDoubanDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${doubanDataSource === option.value
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                          : 'text-gray-900 dark:text-gray-100'
                          }`}
                      >
                        <span className='truncate'>{option.label}</span>
                        {doubanDataSource === option.value && (
                          <Check className='w-4 h-4 text-green-600 dark:text-green-400 shrink-0 ml-2' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 感谢信息 */}
              {getThanksInfo(doubanDataSource) && (
                <div className='mt-3'>
                  <button
                    type='button'
                    onClick={() =>
                      window.open(getThanksInfo(doubanDataSource)!.url, '_blank')
                    }
                    className='flex items-center justify-center gap-1.5 w-full px-3 text-xs text-gray-500 dark:text-gray-400 cursor-pointer'
                  >
                    <span className='font-medium'>
                      {getThanksInfo(doubanDataSource)!.text}
                    </span>
                    <ExternalLink className='w-3.5 opacity-70' />
                  </button>
                </div>
              )}
            </div>

            {/* 豆瓣代理地址设置 - 仅在选择自定义代理时显示 */}
            {doubanDataSource === 'custom' && (
              <div className='space-y-3'>
                <div>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    豆瓣代理地址
                  </h4>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    自定义代理服务器地址
                  </p>
                </div>
                <input
                  type='text'
                  className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
                  placeholder='例如: https://proxy.example.com/fetch?url='
                  value={doubanProxyUrl}
                  onChange={(e) => handleDoubanProxyUrlChange(e.target.value)}
                />
              </div>
            )}

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700'></div>

            {/* 豆瓣图片代理设置 */}
            <div className='space-y-3'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  豆瓣图片代理
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  选择获取豆瓣图片的方式
                </p>
              </div>
              <div className='relative' data-dropdown='douban-image-proxy'>
                {/* 自定义下拉选择框 */}
                <button
                  type='button'
                  onClick={() =>
                    setIsDoubanImageProxyDropdownOpen(
                      !isDoubanImageProxyDropdownOpen
                    )
                  }
                  className='w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 text-left'
                >
                  {
                    doubanImageProxyTypeOptions.find(
                      (option) => option.value === doubanImageProxyType
                    )?.label
                  }
                </button>

                {/* 下拉箭头 */}
                <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isDoubanDropdownOpen ? 'rotate-180' : ''
                      }`}
                  />
                </div>

                {/* 下拉选项列表 */}
                {isDoubanImageProxyDropdownOpen && (
                  <div className='absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto'>
                    {doubanImageProxyTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type='button'
                        onClick={() => {
                          handleDoubanImageProxyTypeChange(option.value);
                          setIsDoubanImageProxyDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${doubanImageProxyType === option.value
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                          : 'text-gray-900 dark:text-gray-100'
                          }`}
                      >
                        <span className='truncate'>{option.label}</span>
                        {doubanImageProxyType === option.value && (
                          <Check className='w-4 h-4 text-green-600 dark:text-green-400 shrink-0 ml-2' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 感谢信息 */}
              {getThanksInfo(doubanImageProxyType) && (
                <div className='mt-3'>
                  <button
                    type='button'
                    onClick={() =>
                      window.open(
                        getThanksInfo(doubanImageProxyType)!.url,
                        '_blank'
                      )
                    }
                    className='flex items-center justify-center gap-1.5 w-full px-3 text-xs text-gray-500 dark:text-gray-400 cursor-pointer'
                  >
                    <span className='font-medium'>
                      {getThanksInfo(doubanImageProxyType)!.text}
                    </span>
                    <ExternalLink className='w-3.5 opacity-70' />
                  </button>
                </div>
              )}
            </div>

            {/* 豆瓣图片代理地址设置 - 仅在选择自定义代理时显示 */}
            {doubanImageProxyType === 'custom' && (
              <div className='space-y-3'>
                <div>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    豆瓣图片代理地址
                  </h4>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    自定义图片代理服务器地址
                  </p>
                </div>
                <input
                  type='text'
                  className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
                  placeholder='例如: https://proxy.example.com/fetch?url='
                  value={doubanImageProxyUrl}
                  onChange={(e) =>
                    handleDoubanImageProxyUrlChange(e.target.value)
                  }
                />
              </div>
            )}

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700'></div>

            {/* 默认聚合搜索结果 */}
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  默认聚合搜索结果
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  搜索时默认按标题和年份聚合显示结果
                </p>
              </div>
              <label className='flex items-center cursor-pointer'>
                <div className='relative'>
                  <input
                    type='checkbox'
                    className='sr-only peer'
                    checked={defaultAggregateSearch}
                    onChange={(e) => handleAggregateToggle(e.target.checked)}
                  />
                  <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                  <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                </div>
              </label>
            </div>

            {/* 优选和测速 */}
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  优选和测速
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  如出现播放器劫持问题可关闭
                </p>
              </div>
              <label className='flex items-center cursor-pointer'>
                <div className='relative'>
                  <input
                    type='checkbox'
                    className='sr-only peer'
                    checked={enableOptimization}
                    onChange={(e) => handleOptimizationToggle(e.target.checked)}
                  />
                  <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                  <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                </div>
              </label>
            </div>

            {/* 流式搜索 */}
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  流式搜索输出
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  启用搜索结果实时流式输出，关闭后使用传统一次性搜索
                </p>
              </div>
              <label className='flex items-center cursor-pointer'>
                <div className='relative'>
                  <input
                    type='checkbox'
                    className='sr-only peer'
                    checked={fluidSearch}
                    onChange={(e) => handleFluidSearchToggle(e.target.checked)}
                  />
                  <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                  <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                </div>
              </label>
            </div>

            {/* 精确搜索 */}
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  精确搜索
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  开启后，搜索结果将过滤掉不包含搜索词的内容
                </p>
              </div>
              <label className='flex items-center cursor-pointer'>
                <div className='relative'>
                  <input
                    type='checkbox'
                    className='sr-only peer'
                    checked={exactSearch}
                    onChange={(e) => handleExactSearchToggle(e.target.checked)}
                  />
                  <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                  <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                </div>
              </label>
            </div>

            {/* 直播视频浏览器直连 */}
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  IPTV 视频浏览器直连
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  开启 IPTV 视频浏览器直连时，需要自备 Allow CORS 插件
                </p>
              </div>
              <label className='flex items-center cursor-pointer'>
                <div className='relative'>
                  <input
                    type='checkbox'
                    className='sr-only peer'
                    checked={liveDirectConnect}
                    onChange={(e) => handleLiveDirectConnectToggle(e.target.checked)}
                  />
                  <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                  <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                </div>
              </label>
            </div>

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700'></div>

            {/* 播放缓冲优化 - 卡片式选择器 */}
            <div className='space-y-3'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  播放缓冲优化
                </h4>
                <p className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
                  根据网络环境选择合适的缓冲模式，减少播放卡顿
                </p>
              </div>

              {/* 模式选择卡片 */}
              <div className='space-y-2'>
                {bufferModeOptions.map((option) => {
                  const isSelected = playerBufferMode === option.value;
                  const colorClasses = {
                    green: {
                      selected:
                        'border-transparent bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 ring-2 ring-green-400/60 dark:ring-green-500/50 shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)] dark:shadow-[0_0_15px_-3px_rgba(34,197,94,0.3)]',
                      icon: 'bg-linear-to-br from-green-100 to-emerald-100 dark:from-green-800/50 dark:to-emerald-800/50',
                      check: 'text-green-500',
                      label: 'text-green-700 dark:text-green-300',
                    },
                    blue: {
                      selected:
                        'border-transparent bg-linear-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 ring-2 ring-blue-400/60 dark:ring-blue-500/50 shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)] dark:shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]',
                      icon: 'bg-linear-to-br from-blue-100 to-cyan-100 dark:from-blue-800/50 dark:to-cyan-800/50',
                      check: 'text-blue-500',
                      label: 'text-blue-700 dark:text-blue-300',
                    },
                    purple: {
                      selected:
                        'border-transparent bg-linear-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 ring-2 ring-purple-400/60 dark:ring-purple-500/50 shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)] dark:shadow-[0_0_15px_-3px_rgba(168,85,247,0.3)]',
                      icon: 'bg-linear-to-br from-purple-100 to-pink-100 dark:from-purple-800/50 dark:to-pink-800/50',
                      check: 'text-purple-500',
                      label: 'text-purple-700 dark:text-purple-300',
                    },
                  } as const;
                  const colors =
                    colorClasses[option.color as keyof typeof colorClasses];

                  return (
                    <button
                      key={option.value}
                      type='button'
                      onClick={() => handleBufferModeChange(option.value)}
                      className={`w-full p-3 rounded-xl border-2 transition-all duration-300 text-left flex items-center gap-3 ${isSelected
                        ? colors.selected
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm bg-white dark:bg-gray-800'
                        }`}
                    >
                      {/* 图标 */}
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all duration-300 ${isSelected
                          ? colors.icon
                          : 'bg-gray-100 dark:bg-gray-700'
                          }`}
                      >
                        {option.icon}
                      </div>

                      {/* 文字内容 */}
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-2'>
                          <span
                            className={`font-medium transition-colors duration-300 ${isSelected
                              ? colors.label
                              : 'text-gray-900 dark:text-gray-100'
                              }`}
                          >
                            {option.label}
                          </span>
                        </div>
                        <p className='text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1'>
                          {option.description}
                        </p>
                      </div>

                      {/* 选中标记 */}
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${isSelected
                          ? `${colors.check} scale-100`
                          : 'text-transparent scale-75'
                          }`}
                      >
                        <svg
                          className='w-5 h-5'
                          fill='currentColor'
                          viewBox='0 0 20 20'
                        >
                          <path
                            fillRule='evenodd'
                            d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                            clipRule='evenodd'
                          />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700'></div>

            {/* 跳过片头片尾设置 */}
            <div className='space-y-4'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  跳过片头片尾设置
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  控制播放器默认的片头片尾跳过行为
                </p>
              </div>

              {/* 自动跳过开关 */}
              <div className='flex items-center justify-between'>
                <div>
                  <h5 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    启用自动跳过
                  </h5>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    开启后将自动跳过片头片尾，关闭则显示手动跳过按钮
                  </p>
                </div>
                <label className='flex items-center cursor-pointer'>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={enableAutoSkip}
                      onChange={(e) => handleEnableAutoSkipToggle(e.target.checked)}
                    />
                    <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                  </div>
                </label>
              </div>

              {/* 自动播放下一集开关 */}
              <div className='flex items-center justify-between'>
                <div>
                  <h5 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    片尾自动播放下一集
                  </h5>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    开启后片尾结束时自动跳转到下一集
                  </p>
                </div>
                <label className='flex items-center cursor-pointer'>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={enableAutoNextEpisode}
                      onChange={(e) => handleEnableAutoNextEpisodeToggle(e.target.checked)}
                    />
                    <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                  </div>
                </label>
              </div>

              {/* 清空继续观看确认开关 */}
              <div className='flex items-center justify-between'>
                <div>
                  <h5 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    清空记录确认提示
                  </h5>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    开启后点击清空按钮时会弹出确认对话框，防止误操作
                  </p>
                </div>
                <label className='flex items-center cursor-pointer'>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={requireClearConfirmation}
                      onChange={(e) => handleRequireClearConfirmationToggle(e.target.checked)}
                    />
                    <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                  </div>
                </label>
              </div>

              {/* 提示信息 */}
              <div className='text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800'>
                💡 这些设置会作为新视频的默认配置。对于已配置的视频，请在播放页面的"跳过设置"中单独调整。
              </div>
            </div>

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700'></div>

            {/* 继续观看筛选设置 */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    继续观看进度筛选
                  </h4>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    是否启用"继续观看"的播放进度筛选功能
                  </p>
                </div>
                <label className='flex items-center cursor-pointer'>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={enableContinueWatchingFilter}
                      onChange={(e) => handleEnableContinueWatchingFilterToggle(e.target.checked)}
                    />
                    <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                  </div>
                </label>
              </div>

              {/* 进度范围设置 - 仅在启用筛选时显示 */}
              {enableContinueWatchingFilter && (
                <>
                  <div>
                    <h5 className='text-sm font-medium text-gray-600 dark:text-gray-400 mb-3'>
                      进度范围设置
                    </h5>
                  </div>

                  <div className='grid grid-cols-2 gap-4'>
                    {/* 最小进度设置 */}
                    <div>
                      <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
                        最小进度 (%)
                      </label>
                      <input
                        type='number'
                        min='0'
                        max='100'
                        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                        value={continueWatchingMinProgress}
                        onChange={(e) => {
                          const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          handleContinueWatchingMinProgressChange(value);
                        }}
                      />
                    </div>

                    {/* 最大进度设置 */}
                    <div>
                      <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
                        最大进度 (%)
                      </label>
                      <input
                        type='number'
                        min='0'
                        max='100'
                        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                        value={continueWatchingMaxProgress}
                        onChange={(e) => {
                          const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 100));
                          handleContinueWatchingMaxProgressChange(value);
                        }}
                      />
                    </div>
                  </div>

                  {/* 当前范围提示 */}
                  <div className='text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg'>
                    当前设置：显示播放进度在 {continueWatchingMinProgress}% - {continueWatchingMaxProgress}% 之间的内容
                  </div>
                </>
              )}

              {/* 关闭筛选时的提示 */}
              {!enableContinueWatchingFilter && (
                <div className='text-xs text-gray-500 dark:text-gray-400 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800'>
                  筛选已关闭：将显示所有播放时间超过2分钟的内容
                </div>
              )}
            </div>

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700'></div>

            {/* 下载格式设置 */}
            <div className='space-y-3'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  下载格式
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  选择视频下载时的默认格式
                </p>
              </div>

              {/* 格式选择 */}
              <div className='grid grid-cols-2 gap-3'>
                <button
                  type='button'
                  onClick={() => handleDownloadFormatChange('TS')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${downloadFormat === 'TS'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                >
                  <div className='flex flex-col items-center gap-2'>
                    <div className={`text-2xl ${downloadFormat === 'TS' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      📦
                    </div>
                    <div className='text-center'>
                      <div className={`text-sm font-semibold ${downloadFormat === 'TS' ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-gray-100'}`}>
                        TS格式
                      </div>
                      <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                        推荐，兼容性好
                      </div>
                    </div>
                    {downloadFormat === 'TS' && (
                      <div className='w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center'>
                        <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
                          <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>

                <button
                  type='button'
                  onClick={() => handleDownloadFormatChange('MP4')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${downloadFormat === 'MP4'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                >
                  <div className='flex flex-col items-center gap-2'>
                    <div className={`text-2xl ${downloadFormat === 'MP4' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      🎬
                    </div>
                    <div className='text-center'>
                      <div className={`text-sm font-semibold ${downloadFormat === 'MP4' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                        MP4格式
                      </div>
                      <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                        通用格式
                      </div>
                    </div>
                    {downloadFormat === 'MP4' && (
                      <div className='w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center'>
                        <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
                          <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              </div>

              {/* 格式说明 */}
              <div className='text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800'>
                💡 TS格式下载速度快，兼容性好；MP4格式经过转码，体积略小，兼容性更广
              </div>
            </div>
          </div>

          {/* 底部说明 */}
          <div className='mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <p className='text-xs text-gray-500 dark:text-gray-400 text-center'>
              这些设置保存在本地浏览器中
            </p>
          </div>
        </div>
      </div>

      {/* Toast 通知 */}
      {showEmbyToast && (
        <div className='fixed top-20 left-1/2 -translate-x-1/2 z-[1100] animate-in fade-in slide-in-from-top-2 duration-300'>
          <div
            className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
              embyToastType === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {embyToastType === 'success' ? (
              <Check className='w-5 h-5' />
            ) : (
              <X className='w-5 h-5' />
            )}
            <span className='font-medium'>{embyToastMessage}</span>
          </div>
        </div>
      )}
    </>
  );

  // 修改密码面板内容
  const changePasswordPanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-black/50 z-1000'
        onClick={handleCloseChangePassword}
        onTouchMove={(e) => {
          // 只阻止滚动，允许其他触摸事件
          e.preventDefault();
        }}
        onWheel={(e) => {
          // 阻止滚轮滚动
          e.preventDefault();
        }}
        style={{
          touchAction: 'none',
        }}
      />

      {/* 修改密码面板 */}
      <div
        className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-xl z-1001 overflow-hidden'
      >
        {/* 内容容器 - 独立的滚动区域 */}
        <div
          className='h-full p-6'
          data-panel-content
          onTouchMove={(e) => {
            // 阻止事件冒泡到遮罩层，但允许内部滚动
            e.stopPropagation();
          }}
          style={{
            touchAction: 'auto', // 允许所有触摸操作
          }}
        >
          {/* 标题栏 */}
          <div className='flex items-center justify-between mb-6'>
            <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
              修改密码
            </h3>
            <button
              onClick={handleCloseChangePassword}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>

          {/* 表单 */}
          <div className='space-y-4'>
            {/* 新密码输入 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                新密码
              </label>
              <input
                type='password'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                placeholder='请输入新密码'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>

            {/* 确认密码输入 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                确认密码
              </label>
              <input
                type='password'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                placeholder='请再次输入新密码'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>

            {/* 错误信息 */}
            {passwordError && (
              <div className='text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800'>
                {passwordError}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className='flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <button
              onClick={handleCloseChangePassword}
              className='flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors'
              disabled={passwordLoading}
            >
              取消
            </button>
            <button
              onClick={handleSubmitChangePassword}
              className='flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              disabled={passwordLoading || !newPassword || !confirmPassword}
            >
              {passwordLoading ? '修改中...' : '确认修改'}
            </button>
          </div>

          {/* 底部说明 */}
          <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <p className='text-xs text-gray-500 dark:text-gray-400 text-center'>
              修改密码后需要重新登录
            </p>
          </div>
        </div>
      </div>
    </>
  );

  // 更新剧集海报弹窗内容
  const watchingUpdatesPanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-black/50 z-1000'
        onClick={handleCloseWatchingUpdates}
        onTouchMove={(e) => {
          e.preventDefault();
        }}
        onWheel={(e) => {
          e.preventDefault();
        }}
        style={{
          touchAction: 'none',
        }}
      />

      {/* 更新弹窗 */}
      <div
        className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-xl z-1001 flex flex-col'
      >
        {/* 内容容器 - 独立的滚动区域 */}
        <div
          className='flex-1 p-6 overflow-y-auto'
          data-panel-content
          style={{
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
          }}
        >
          {/* 标题栏 */}
          <div className='flex items-center justify-between mb-6'>
            <div className='flex items-center gap-3'>
              <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                更新提醒
              </h3>
              <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400'>
                {watchingUpdates && watchingUpdates.updatedCount > 0 && (
                  <span className='inline-flex items-center gap-1'>
                    <div className='w-2 h-2 bg-red-500 rounded-full animate-pulse'></div>
                    {watchingUpdates.updatedCount}部有新集
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleCloseWatchingUpdates}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>

          {/* 更新列表 */}
          <div className='space-y-8'>
            {/* 没有更新时的提示 */}
            {!hasActualUpdates && (
              <div className='text-center py-8'>
                <div className='text-gray-500 dark:text-gray-400 text-sm'>
                  暂无新剧集更新
                </div>
                <div className='text-xs text-gray-400 dark:text-gray-500 mt-2'>
                  系统会定期检查您观看过的剧集是否有新集数更新
                </div>
              </div>
            )}
            {/* 有新集数的剧集 */}
            {watchingUpdates && watchingUpdates.updatedSeries.filter(series => series.hasNewEpisode).length > 0 && (
              <div>
                <div className='flex items-center gap-2 mb-4'>
                  <h4 className='text-lg font-semibold text-gray-900 dark:text-white'>
                    新集更新
                  </h4>
                  <div className='flex items-center gap-1'>
                    <div className='w-2 h-2 bg-red-500 rounded-full animate-pulse'></div>
                    <span className='text-sm text-red-500 font-medium'>
                      {watchingUpdates.updatedSeries.filter(series => series.hasNewEpisode).length}部剧集有更新
                    </span>
                  </div>
                </div>

                <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'>
                  {watchingUpdates.updatedSeries
                    .filter(series => series.hasNewEpisode)
                    .map((series, index) => (
                      <div key={`new-${series.title}_${series.year}_${index}`} className='relative group/card'>
                        <div className='relative group-hover/card:z-5 transition-all duration-300'>
                          <VideoCard
                            title={series.title}
                            poster={series.cover}
                            year={series.year}
                            source={series.sourceKey}
                            source_name={series.source_name}
                            episodes={series.totalEpisodes}
                            currentEpisode={series.currentEpisode}
                            id={series.videoId}
                            onDelete={undefined}
                            type={series.totalEpisodes > 1 ? 'tv' : ''}
                            from="playrecord"
                          />
                        </div>
                        {/* 新集数徽章 - Netflix 统一风格 */}
                        <div className='absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-md shadow-lg animate-pulse z-10 font-bold'>
                          +{series.newEpisodes}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

          </div>

          {/* 底部说明 */}
          <div className='mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <p className='text-xs text-gray-500 dark:text-gray-400 text-center'>
              点击海报即可观看新更新的剧集
            </p>
          </div>
        </div>
      </div>
    </>
  );

  // 按日期分组播放记录
  const groupPlayRecordsByDate = () => {
    const groups: { [key: string]: typeof playRecords } = {};

    playRecords.forEach((record) => {
      const date = new Date(record.save_time);
      const dateKey = date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(record);
    });

    // 按日期倒序排列（最新的在前）
    return Object.entries(groups).sort((a, b) => {
      const dateA = new Date(a[1][0].save_time);
      const dateB = new Date(b[1][0].save_time);
      return dateB.getTime() - dateA.getTime();
    });
  };

  // 继续观看弹窗内容
  const continueWatchingPanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-black/50 z-1000'
        onClick={handleCloseContinueWatching}
        onTouchMove={(e) => {
          e.preventDefault();
        }}
        onWheel={(e) => {
          e.preventDefault();
        }}
        style={{
          touchAction: 'none',
        }}
      />

      {/* 继续观看弹窗 */}
      <div
        className='fixed inset-x-2 sm:inset-x-4 top-1/2 transform -translate-y-1/2 max-w-5xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-1001 max-h-[85vh] overflow-y-auto overflow-x-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className='flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 z-600 px-3 sm:px-6 py-3 sm:py-4 mb-4 sm:mb-6 border-b border-gray-200 dark:border-gray-700'>
            <h3 className='text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
              <PlayCircle className='w-5 h-5 sm:w-6 sm:h-6 text-blue-500 fill-blue-500' />
              <span className='hidden sm:inline'>继续观看</span>
              <span className='sm:hidden'>观看</span>
              {playRecords.length > 0 && (
                <span className='ml-1 sm:ml-2 text-xs sm:text-sm font-normal text-gray-500 dark:text-gray-400'>
                  {playRecords.length}部
                </span>
              )}
            </h3>
            <button
              onClick={handleCloseContinueWatching}
              className='p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
          <div className='px-3 sm:px-6 pb-3 sm:pb-6'>

            {playRecords.length === 0 ? (
              /* 空状态 */
              <div className='text-center py-16'>
                <PlayCircle className='w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-6' />
                <p className='text-lg text-gray-500 dark:text-gray-400 mb-2'>暂无需要继续观看的内容</p>
                <p className='text-sm text-gray-400 dark:text-gray-500'>
                  {enableContinueWatchingFilter
                    ? `观看进度在${continueWatchingMinProgress}%-${continueWatchingMaxProgress}%之间且播放时间超过2分钟的内容会显示在这里`
                    : '播放时间超过2分钟的所有内容都会显示在这里'
                  }
                </p>
              </div>
            ) : (
              /* 时间线样式的播放记录列表 */
              <div className='space-y-6 sm:space-y-8'>
                {groupPlayRecordsByDate().map(([dateKey, records], groupIndex) => {
                  const date = new Date(records[0].save_time);
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
                      {groupIndex < groupPlayRecordsByDate().length - 1 && (
                        <div className='absolute left-[11px] sm:left-[15px] top-[32px] sm:top-[40px] bottom-[-24px] sm:bottom-[-32px] w-[2px] bg-linear-to-b from-blue-500 via-cyan-500 to-sky-500 dark:from-blue-600 dark:via-cyan-600 dark:to-sky-600 opacity-30'></div>
                      )}

                      {/* 日期标题 */}
                      <div className='flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4'>
                        <div className='relative shrink-0'>
                          <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-linear-to-br from-blue-500 via-cyan-500 to-sky-500 dark:from-blue-600 dark:via-cyan-600 dark:to-sky-600 flex items-center justify-center shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20'>
                            <span className='text-white text-xs sm:text-sm font-bold'>{records.length}</span>
                          </div>
                          <div className='absolute inset-0 rounded-full bg-linear-to-br from-blue-400 via-cyan-400 to-sky-400 opacity-30 blur animate-pulse'></div>
                        </div>
                        <div className='flex-1 min-w-0'>
                          <h4 className='text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate'>
                            {displayDate}
                          </h4>
                          <p className='text-xs text-gray-500 dark:text-gray-400'>
                            <span className='hidden sm:inline'>观看了 </span>{records.length}<span className='hidden sm:inline'> 部作品</span><span className='sm:hidden'>部</span>
                          </p>
                        </div>
                      </div>

                      {/* 该日期的播放记录卡片网格 */}
                      <div className='ml-8 sm:ml-11 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4'>
                        {records.map((record) => {
                          const { source, id } = parseKey(record.key);
                          const newEpisodesCount = getNewEpisodesCount(record);
                          return (
                            <div key={record.key} className='relative group/card'>
                              <div className='relative group-hover/card:z-5 transition-all duration-300'>
                                <VideoCard
                                  id={id}
                                  title={record.title}
                                  poster={record.cover}
                                  year={record.year}
                                  source={source}
                                  source_name={record.source_name}
                                  progress={getProgress(record)}
                                  episodes={record.total_episodes}
                                  currentEpisode={record.index}
                                  query={record.search_title}
                                  from='playrecord'
                                  type={record.total_episodes > 1 ? 'tv' : ''}
                                  remarks={record.remarks}
                                  douban_id={record.douban_id}
                                />
                                {/* 进度百分比徽章 - 定位在封面左下角（封面aspect-ratio为2:3） */}
                                {getProgress(record) > 0 && getProgress(record) < 95 && (
                                  <div className={`absolute left-2 bg-blue-500/90 text-white text-xs px-2 py-0.5 rounded-full shadow-md font-medium z-9 pointer-events-none ${record.remarks && isSeriesCompleted(record.remarks)
                                    ? 'bottom-28 sm:bottom-28'
                                    : 'bottom-20 sm:bottom-20'
                                    }`}>
                                    {Math.round(getProgress(record))}%
                                  </div>
                                )}
                              </div>
                              {/* 新集数徽章 - Netflix 统一风格 */}
                              {newEpisodesCount > 0 && (
                                <div className='absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-md shadow-lg animate-pulse z-10 font-bold'>
                                  +{newEpisodesCount}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 底部统计 */}
            {playRecords.length > 0 && (
              <div className='mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700'>
                <div className='flex items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-500 dark:text-gray-400'>
                  <div className='flex items-center gap-1.5 sm:gap-2'>
                    <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-linear-to-br from-blue-500 to-cyan-500'></div>
                    <span>共 {playRecords.length} 部观看</span>
                  </div>
                  <div className='w-px h-3 sm:h-4 bg-gray-300 dark:bg-gray-600'></div>
                  <div className='flex items-center gap-1.5 sm:gap-2'>
                    <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-linear-to-br from-purple-500 to-pink-500'></div>
                    <span>跨越 {groupPlayRecordsByDate().length} 天</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // 按日期分组收藏
  const groupFavoritesByDate = () => {
    const groups: { [key: string]: typeof favorites } = {};

    favorites.forEach((favorite) => {
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

  // 我的收藏弹窗内容
  const favoritesPanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-black/50 z-1000'
        onClick={handleCloseFavorites}
        onTouchMove={(e) => {
          e.preventDefault();
        }}
        onWheel={(e) => {
          e.preventDefault();
        }}
        style={{
          touchAction: 'none',
        }}
      />

      {/* 收藏弹窗 */}
      <div
        className='fixed inset-x-2 sm:inset-x-4 top-1/2 transform -translate-y-1/2 max-w-5xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-1001 max-h-[85vh] overflow-y-auto overflow-x-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className='flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 z-600 px-3 sm:px-6 py-3 sm:py-4 mb-4 sm:mb-6 border-b border-gray-200 dark:border-gray-700'>
            <h3 className='text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
              <Heart className='w-5 h-5 sm:w-6 sm:h-6 text-red-500 fill-red-500' />
              <span className='hidden sm:inline'>我的收藏时光</span>
              <span className='sm:hidden'>收藏</span>
              <span className='ml-1 sm:ml-2 text-xs sm:text-sm font-normal text-gray-500 dark:text-gray-400'>
                {favorites.length}部
              </span>
            </h3>
            <button
              onClick={handleCloseFavorites}
              className='p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
          <div className='px-3 sm:px-6 pb-3 sm:pb-6'>

            {favorites.length === 0 ? (
              /* 空状态 */
              <div className='text-center py-16'>
                <Heart className='w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-6' />
                <p className='text-lg text-gray-500 dark:text-gray-400 mb-2'>暂无收藏</p>
                <p className='text-sm text-gray-400 dark:text-gray-500'>
                  在详情页点击收藏按钮即可添加收藏
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
                      {/* 时间线连接线 - 移动端更靠左 */}
                      {groupIndex < groupFavoritesByDate().length - 1 && (
                        <div className='absolute left-[11px] sm:left-[15px] top-[32px] sm:top-[40px] bottom-[-24px] sm:bottom-[-32px] w-[2px] bg-linear-to-b from-green-500 via-emerald-500 to-teal-500 dark:from-green-600 dark:via-emerald-600 dark:to-teal-600 opacity-30'></div>
                      )}

                      {/* 日期标题 */}
                      <div className='flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4'>
                        <div className='relative shrink-0'>
                          <div className='w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-linear-to-br from-green-500 via-emerald-500 to-teal-500 dark:from-green-600 dark:via-emerald-600 dark:to-teal-600 flex items-center justify-center shadow-lg shadow-green-500/30 dark:shadow-green-500/20'>
                            <span className='text-white text-xs sm:text-sm font-bold'>{items.length}</span>
                          </div>
                          <div className='absolute inset-0 rounded-full bg-linear-to-br from-green-400 via-emerald-400 to-teal-400 opacity-30 blur animate-pulse'></div>
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
                      <div className='ml-8 sm:ml-11 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4'>
                        {items.map((favorite) => {
                          const { source, id } = parseKey(favorite.key);

                          // 智能计算即将上映状态
                          let calculatedRemarks = favorite.remarks;
                          let isNewRelease = false;

                          if (favorite.releaseDate) {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const releaseDate = new Date(favorite.releaseDate);
                            const daysDiff = Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                            // 根据天数差异动态更新显示文字
                            if (daysDiff < 0) {
                              const daysAgo = Math.abs(daysDiff);
                              calculatedRemarks = `已上映${daysAgo}天`;
                              // 7天内上映的标记为新上映
                              if (daysAgo <= 7) {
                                isNewRelease = true;
                              }
                            } else if (daysDiff === 0) {
                              calculatedRemarks = '今日上映';
                              isNewRelease = true;
                            } else {
                              calculatedRemarks = `${daysDiff}天后上映`;
                            }
                          }

                          return (
                            <div key={favorite.key} className='relative'>
                              <VideoCard
                                id={id}
                                title={favorite.title}
                                poster={favorite.cover}
                                year={favorite.year}
                                source={source}
                                source_name={favorite.source_name}
                                episodes={favorite.total_episodes}
                                query={favorite.search_title}
                                from='favorite'
                                type={favorite.total_episodes > 1 ? 'tv' : ''}
                                remarks={calculatedRemarks}
                                releaseDate={favorite.releaseDate}
                              />
                              {/* 收藏心形图标 - 隐藏，使用VideoCard内部的hover爱心 */}
                              {/* 新上映高亮标记 - Netflix 统一风格 - 7天内上映的显示 */}
                              {isNewRelease && (
                                <div className='absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-md shadow-lg animate-pulse z-40'>
                                  新上映
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 底部统计 */}
            {favorites.length > 0 && (
              <div className='mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700'>
                <div className='flex items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-500 dark:text-gray-400'>
                  <div className='flex items-center gap-1.5 sm:gap-2'>
                    <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-linear-to-br from-green-500 to-emerald-500'></div>
                    <span>共 {favorites.length} 部</span>
                  </div>
                  <div className='w-px h-3 sm:h-4 bg-gray-300 dark:bg-gray-600'></div>
                  <div className='flex items-center gap-1.5 sm:gap-2'>
                    <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-linear-to-br from-blue-500 to-cyan-500'></div>
                    <span>跨越 {groupFavoritesByDate().length} 天</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className='relative'>
        <button
          onClick={handleMenuClick}
          className='relative w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:text-blue-500 dark:text-gray-300 dark:hover:text-blue-400 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/30 dark:hover:shadow-blue-400/30 group'
          aria-label='User Menu'
        >
          {/* 微光背景效果 */}
          <div className='absolute inset-0 rounded-full bg-linear-to-br from-blue-400/0 to-purple-600/0 group-hover:from-blue-400/20 group-hover:to-purple-600/20 dark:group-hover:from-blue-300/20 dark:group-hover:to-purple-500/20 transition-all duration-300'></div>

          <User className='w-full h-full relative z-10 group-hover:scale-110 transition-transform duration-300' />
        </button>
        {/* 统一更新提醒点：版本更新或剧集更新都显示橙色点 */}
        {((updateStatus === UpdateStatus.HAS_UPDATE) || (hasUnreadUpdates && totalUpdates > 0)) && (
          <div className='absolute top-[2px] right-[2px] w-2 h-2 bg-yellow-500 rounded-full animate-pulse shadow-lg shadow-yellow-500/50'></div>
        )}
      </div>

      {/* 使用 Portal 将菜单面板渲染到 document.body */}
      {isOpen && mounted && createPortal(menuPanel, document.body)}

      {/* 使用 Portal 将设置面板渲染到 document.body */}
      {isSettingsOpen && mounted && createPortal(settingsPanel, document.body)}

      {/* 使用 Portal 将修改密码面板渲染到 document.body */}
      {isChangePasswordOpen &&
        mounted &&
        createPortal(changePasswordPanel, document.body)}

      {/* 使用 Portal 将更新提醒面板渲染到 document.body */}
      {isWatchingUpdatesOpen &&
        mounted &&
        createPortal(watchingUpdatesPanel, document.body)}

      {/* 使用 Portal 将继续观看面板渲染到 document.body */}
      {isContinueWatchingOpen &&
        mounted &&
        createPortal(continueWatchingPanel, document.body)}

      {/* 使用 Portal 将我的收藏面板渲染到 document.body */}
      {isFavoritesOpen &&
        mounted &&
        createPortal(favoritesPanel, document.body)}

      {/* 版本面板 */}
      <VersionPanel
        isOpen={isVersionPanelOpen}
        onClose={() => setIsVersionPanelOpen(false)}
      />
    </>
  );
};
