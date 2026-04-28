/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  Cat,
  Clover,
  Film,
  FolderOpen,
  Globe,
  Home,
  Menu,
  MoreHorizontal,
  Play,
  PlaySquare,
  Radio,
  Star,
  Tv,
  X,
  type LucideIcon,
} from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { FastLink } from './FastLink';
import { GlassmorphismEffect } from './GlassmorphismEffect';
import { useSite } from './SiteProvider';

interface ModernNavProps {
  activePath?: string;
}

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

declare global {
  interface Window {
    __sidebarCollapsed?: boolean;
  }
}

const ModernNav = ({ activePath }: ModernNavProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { siteName } = useSite();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [active, setActive] = useState(() => {
    if (typeof window !== 'undefined') {
      const queryString = new URLSearchParams(
        window.location.search,
      ).toString();
      return queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;
    }
    return activePath || '/';
  });
  const [hasCustomCategories, setHasCustomCategories] = useState(false);
  const [enableWebLive, setEnableWebLive] = useState(false);
  const [embyEnabled, setEmbyEnabled] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.__sidebarCollapsed === 'boolean'
    ) {
      return window.__sidebarCollapsed;
    }
    return false;
  });

  const baseNavItems = useMemo<NavItem[]>(
    () => [
      { icon: Home, label: '首页', href: '/' },
      { icon: Globe, label: '源浏览', href: '/source-browser' },
      { icon: Film, label: '电影', href: '/douban?type=movie' },
      { icon: Tv, label: '剧集', href: '/douban?type=tv' },
      { icon: PlaySquare, label: '短剧', href: '/shortdrama' },
      { icon: Cat, label: '动漫', href: '/douban?type=anime' },
      { icon: Clover, label: '综艺', href: '/douban?type=show' },
    ],
    [],
  );

  useEffect(() => {
    const queryString = searchParams.toString();
    const fullPath = queryString ? `${pathname}?${queryString}` : pathname;
    setActive(fullPath);
  }, [pathname, searchParams]);

  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    setHasCustomCategories(runtimeConfig?.CUSTOM_CATEGORIES?.length > 0);
    setEnableWebLive(Boolean(runtimeConfig?.ENABLE_WEB_LIVE));
    setEmbyEnabled(
      Boolean(
        runtimeConfig?.EMBY_ENABLED || runtimeConfig?.PRIVATE_LIBRARY_ENABLED,
      ),
    );
  }, []);

  useLayoutEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      const nextCollapsed = JSON.parse(saved);
      setIsCollapsed(nextCollapsed);
      window.__sidebarCollapsed = nextCollapsed;
    }
  }, []);

  useLayoutEffect(() => {
    if (isCollapsed) {
      document.documentElement.dataset.sidebarCollapsed = 'true';
    } else {
      delete document.documentElement.dataset.sidebarCollapsed;
    }
  }, [isCollapsed]);

  const handleToggle = useCallback(() => {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(nextCollapsed));
    window.__sidebarCollapsed = nextCollapsed;
  }, [isCollapsed]);

  const navItems = useMemo<NavItem[]>(() => {
    const items = [...baseNavItems];

    if (enableWebLive) {
      items.push({ icon: Radio, label: '直播', href: '/live' });
    }

    if (hasCustomCategories) {
      items.push({
        icon: Star,
        label: '自定义',
        href: '/douban?type=custom',
      });
    }

    if (embyEnabled) {
      items.push({ icon: FolderOpen, label: 'Emby', href: '/emby' });
    }

    return items;
  }, [
    baseNavItems,
    embyEnabled,
    enableWebLive,
    hasCustomCategories,
  ]);

  const isActive = useCallback(
    (href: string) => {
      const typeMatch = href.match(/type=([^&]+)/)?.[1];
      const decodedActive = decodeURIComponent(active);
      const decodedItemHref = decodeURIComponent(href);

      if (
        decodedActive.startsWith('/detail') ||
        decodedActive.startsWith('/play')
      ) {
        return false;
      }

      return (
        decodedActive === decodedItemHref ||
        (decodedActive.startsWith('/douban') &&
          typeMatch &&
          decodedActive.includes(`type=${typeMatch}`)) ||
        (href === '/shortdrama' && decodedActive.startsWith('/shortdrama')) ||
        (href === '/live' && decodedActive.startsWith('/live')) ||
        (href === '/emby' && decodedActive.startsWith('/emby'))
      );
    },
    [active],
  );

  const getColorTheme = (href: string) => {
    const colorThemes: Record<
      string,
      { hover: string; active: string; gradient: string; color: string }
    > = {
      '/': {
        hover: 'group-hover:text-cyan-400',
        active: 'text-cyan-400',
        gradient: 'from-cyan-400 to-emerald-400',
        color: 'text-cyan-400',
      },
      '/source-browser': {
        hover: 'group-hover:text-emerald-400',
        active: 'text-emerald-400',
        gradient: 'from-emerald-400 to-green-500',
        color: 'text-emerald-400',
      },
      '/douban?type=movie': {
        hover: 'group-hover:text-red-400',
        active: 'text-red-400',
        gradient: 'from-red-500 to-pink-500',
        color: 'text-red-400',
      },
      '/douban?type=tv': {
        hover: 'group-hover:text-blue-400',
        active: 'text-blue-400',
        gradient: 'from-blue-500 to-indigo-500',
        color: 'text-blue-400',
      },
      '/shortdrama': {
        hover: 'group-hover:text-violet-400',
        active: 'text-violet-400',
        gradient: 'from-violet-500 to-fuchsia-500',
        color: 'text-violet-400',
      },
      '/douban?type=anime': {
        hover: 'group-hover:text-pink-400',
        active: 'text-pink-400',
        gradient: 'from-pink-500 to-rose-500',
        color: 'text-pink-400',
      },
      '/douban?type=show': {
        hover: 'group-hover:text-amber-400',
        active: 'text-amber-400',
        gradient: 'from-orange-500 to-amber-400',
        color: 'text-amber-400',
      },
      '/live': {
        hover: 'group-hover:text-teal-400',
        active: 'text-teal-400',
        gradient: 'from-teal-400 to-cyan-500',
        color: 'text-teal-400',
      },
      '/emby': {
        hover: 'group-hover:text-sky-400',
        active: 'text-sky-400',
        gradient: 'from-sky-500 to-blue-500',
        color: 'text-sky-400',
      },
    };

    if (href.includes('type=custom')) {
      return {
        hover: 'group-hover:text-yellow-400',
        active: 'text-yellow-400',
        gradient: 'from-yellow-400 to-amber-500',
        color: 'text-yellow-400',
      };
    }

    return colorThemes[href] || colorThemes['/'];
  };

  return (
    <>
      {showMoreMenu && (
        <div
          className='md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-700'
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className='absolute bottom-20 left-2 right-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-3xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800/30 overflow-hidden'
            onClick={(event) => event.stopPropagation()}
            style={{ maxHeight: 'calc(100vh - 10rem)', overflowY: 'auto' }}
          >
            <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl z-10'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                全部分类
              </h3>
              <button
                type='button'
                onClick={() => setShowMoreMenu(false)}
                className='p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors'
                aria-label='关闭'
              >
                <X className='w-5 h-5 text-gray-600 dark:text-gray-400' />
              </button>
            </div>
            <div className='grid grid-cols-4 gap-4 p-4'>
              {navItems.map((item) => {
                const activeItem = isActive(item.href);
                const Icon = item.icon;
                const theme = getColorTheme(item.href);

                return (
                  <FastLink
                    key={item.href}
                    href={item.href}
                    useTransitionNav
                    onClick={() => {
                      setActive(item.href);
                      setShowMoreMenu(false);
                    }}
                    className='flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 active:scale-95 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                  >
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-2xl ${
                        activeItem
                          ? `bg-linear-to-br ${theme.gradient}`
                          : 'bg-gray-100 dark:bg-gray-800'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          activeItem
                            ? 'text-white'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        activeItem
                          ? theme.color
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {item.label}
                    </span>
                  </FastLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className='hidden md:block fixed left-0 top-0 bottom-0 z-700 pointer-events-none'>
        <div
          className={`relative h-full transition-[width] duration-200 ${
            isCollapsed ? 'w-20' : 'w-44 xl:w-48'
          }`}
        >
          <div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r from-black/90 via-black/52 to-transparent transition-[width] duration-200 ${
              isCollapsed ? 'w-24' : 'w-64'
            }`}
          />
          <div
            className={`pointer-events-auto relative z-10 flex h-full flex-col py-7 text-white transition-[width,padding] duration-200 ${
              isCollapsed ? 'w-16 px-3' : 'w-40 px-5 xl:w-44'
            }`}
          >
            <div
              className={`flex items-center gap-2 ${
                isCollapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              <FastLink
                href='/'
                useTransitionNav
                onClick={() => setActive('/')}
                className={`flex min-w-0 items-center gap-2.5 ${
                  isCollapsed ? 'justify-center' : ''
                }`}
              >
                <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-cyan-400 via-green-400 to-yellow-300 shadow-lg shadow-cyan-400/25'>
                  <Play
                    className='ml-0.5 h-4 w-4 text-black'
                    fill='currentColor'
                  />
                </span>
                {!isCollapsed && (
                  <span className='truncate text-lg font-bold tracking-tight text-white drop-shadow-lg'>
                    {siteName}
                  </span>
                )}
              </FastLink>
              {!isCollapsed && (
                <button
                  type='button'
                  onClick={handleToggle}
                  className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white'
                  title='收起侧边栏'
                  aria-label='收起侧边栏'
                >
                  <Menu className='h-4 w-4' />
                </button>
              )}
            </div>

            {isCollapsed && (
              <button
                type='button'
                onClick={handleToggle}
                className='mt-4 flex h-9 w-full items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white'
                title='展开侧边栏'
                aria-label='展开侧边栏'
              >
                <Menu className='h-4 w-4' />
              </button>
            )}

            <ul
              className={`mt-9 flex flex-1 flex-col gap-2 overflow-y-auto scrollbar-hide ${
                isCollapsed ? 'pr-0' : 'pr-4'
              }`}
            >
              {navItems.map((item) => {
                const activeItem = isActive(item.href);
                const Icon = item.icon;
                const theme = getColorTheme(item.href);

                return (
                  <li key={item.href}>
                    <FastLink
                      href={item.href}
                      useTransitionNav
                      onClick={() => setActive(item.href)}
                      title={item.label}
                      className={`group flex h-12 items-center rounded-full text-[15px] font-semibold transition-all duration-200 ${
                        isCollapsed
                          ? 'justify-center px-0'
                          : 'gap-3 px-3.5'
                      } ${
                        activeItem
                          ? `${theme.active} bg-white/10 shadow-lg shadow-black/20`
                          : `text-zinc-300/90 hover:bg-white/10 hover:text-white ${theme.hover}`
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                          activeItem
                            ? 'scale-110 drop-shadow-[0_0_8px_rgba(34,211,238,0.55)]'
                            : 'opacity-80 group-hover:scale-110 group-hover:opacity-100'
                        }`}
                      />
                      {!isCollapsed && <span>{item.label}</span>}
                    </FastLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </nav>

      <nav className='fixed left-0 right-0 bottom-0 z-600 flex justify-center pointer-events-none md:hidden'>
        <GlassmorphismEffect
          intensity='medium'
          animated={false}
          className='pointer-events-auto w-full border border-white/20 dark:border-gray-700/20 rounded-2xl overflow-visible'
        >
          <ul
            className='flex items-center overflow-x-auto scrollbar-hide'
            style={{ minHeight: '3.5rem' }}
          >
            {navItems.slice(0, 4).map((item) => {
              const activeItem = isActive(item.href);
              const theme = getColorTheme(item.href);
              const Icon = item.icon;

              return (
                <li key={item.href} className='flex-1 shrink-0'>
                  <FastLink
                    href={item.href}
                    useTransitionNav
                    onClick={() => setActive(item.href)}
                    className='group flex flex-col items-center justify-center w-full h-14 gap-0.5 text-xs transition-all duration-200'
                  >
                    <Icon
                      className={`h-6 w-6 transition-all duration-200 ${
                        activeItem
                          ? theme.active
                          : 'text-gray-700 dark:text-gray-200'
                      }`}
                      style={{
                        filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))',
                      }}
                    />
                    <span
                      className={`text-[10px] transition-all duration-200 ${
                        activeItem
                          ? `${theme.active} font-semibold`
                          : 'text-gray-700 dark:text-gray-200'
                      }`}
                      style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}
                    >
                      {item.label}
                    </span>
                  </FastLink>
                </li>
              );
            })}

            <li className='flex-1 shrink-0'>
              <button
                type='button'
                onClick={() => setShowMoreMenu(true)}
                className='flex flex-col items-center justify-center w-full h-14 gap-0.5 text-xs transition-all duration-200'
              >
                <MoreHorizontal
                  className='h-6 w-6 text-gray-700 dark:text-gray-200 transition-all duration-200'
                  style={{
                    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))',
                  }}
                />
                <span
                  className='text-[10px] text-gray-700 dark:text-gray-200 transition-all duration-200'
                  style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}
                >
                  更多
                </span>
              </button>
            </li>
          </ul>
        </GlassmorphismEffect>
      </nav>
    </>
  );
};

export default ModernNav;
