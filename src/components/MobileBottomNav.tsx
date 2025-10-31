/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Box, Cat, Clover, Film, Globe, Home, PlaySquare, Radio, Search, Star, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface MobileBottomNavProps {
  /**
   * 主动指定当前激活的路径。当未提供时，自动使用 usePathname() 获取的路径。
   */
  activePath?: string;
  /**
   * 切换布局模式的回调函数
   */
  onLayoutModeChange?: (mode: 'sidebar' | 'bottom') => void;
}

const MobileBottomNav = ({ activePath, onLayoutModeChange }: MobileBottomNavProps) => {
  const pathname = usePathname();

  // 当前激活路径：优先使用传入的 activePath，否则回退到浏览器地址
  const currentActive = activePath ?? pathname;

  const [navItems, setNavItems] = useState([
    { icon: Home, label: '首页', href: '/' },
    {
      icon: Globe,
      label: '源浏览',
      href: '/source-browser',
    },
    {
      icon: Film,
      label: '电影',
      href: '/douban?type=movie',
    },
    {
      icon: Tv,
      label: '剧集',
      href: '/douban?type=tv',
    },
    {
      icon: PlaySquare,
      label: '短剧',
      href: '/shortdrama',
    },
    {
      icon: Cat,
      label: '动漫',
      href: '/douban?type=anime',
    },
    {
      icon: Clover,
      label: '综艺',
      href: '/douban?type=show',
    },
    {
      icon: Radio,
      label: '直播',
      href: '/live',
    },
  ]);

  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      setNavItems((prevItems) => [
        ...prevItems,
        {
          icon: Star,
          label: '自定义',
          href: '/douban?type=custom',
        },
      ]);
    }
  }, []);

  const isActive = (href: string) => {
    const typeMatch = href.match(/type=([^&]+)/)?.[1];

    // 解码URL以进行正确的比较
    const decodedActive = decodeURIComponent(currentActive);
    const decodedItemHref = decodeURIComponent(href);

    return (
      decodedActive === decodedItemHref ||
      (decodedActive.startsWith('/douban') &&
        decodedActive.includes(`type=${typeMatch}`)) ||
      (href === '/shortdrama' && decodedActive.startsWith('/shortdrama'))
    );
  };

  // 计算总项数
  const totalItemsMobile = navItems.length;

  return (
    <nav
      className='fixed left-0 right-0 z-[600] flex justify-center pointer-events-none'
      style={{
        /* 紧贴视口底部，同时在内部留出安全区高度 */
        bottom: 0,
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div 
        className='pointer-events-auto w-full md:w-auto bg-white/40 backdrop-blur-2xl border border-gray-200/20 dark:bg-gray-900/30 dark:border-gray-700/20 shadow-2xl shadow-black/10 dark:shadow-black/30 md:rounded-full rounded-2xl overflow-hidden md:mx-4'
      >
        <ul className='flex items-center overflow-x-auto md:overflow-visible scrollbar-hide md:justify-center md:gap-1 md:px-4 md:py-2'
          style={{
            /* 移动端样式 */
            minHeight: '3.5rem',
          }}
        >
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li
                key={item.href}
                className='flex-1 md:flex-initial flex-shrink-0 md:flex-shrink-0'
              >
                <Link
                  href={item.href}
                  className='flex flex-col items-center justify-center w-full h-14 gap-0.5 text-xs md:w-auto md:h-auto md:min-w-[70px] md:px-3 md:py-2 md:rounded-full md:hover:bg-white/40 md:dark:hover:bg-gray-800/40 transition-all duration-200'
                >
                  <item.icon
                    className={`h-6 w-6 transition-all duration-200 ${active
                      ? 'text-green-600 dark:text-green-400 md:scale-110'
                      : 'text-gray-500 dark:text-gray-400 md:hover:text-green-600 md:dark:hover:text-green-400 md:hover:scale-110'
                      }`}
                  />
                  <span
                    className={`text-[10px] md:text-xs transition-all duration-200 ${
                      active
                        ? 'text-green-600 dark:text-green-400 font-semibold'
                        : 'text-gray-600 dark:text-gray-300 md:hover:text-green-600 md:dark:hover:text-green-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
          {/* 搜索按钮 - 仅在桌面端且提供了回调函数时显示 */}
          {onLayoutModeChange && (
            <li className='hidden md:flex flex-shrink-0'>
              <Link
                href='/search'
                className='flex flex-col items-center justify-center gap-0.5 text-xs min-w-[70px] px-3 py-2 rounded-full hover:bg-white/40 dark:hover:bg-gray-800/40 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-all duration-200 group'
                title='搜索'
              >
                <Search className='h-6 w-6 group-hover:scale-110 transition-transform duration-200' />
                <span>搜索</span>
              </Link>
            </li>
          )}
          {/* 切换到侧边栏按钮 - 仅在桌面端且提供了回调函数时显示 */}
          {onLayoutModeChange && (
            <li className='hidden md:flex flex-shrink-0'>
              <button
                onClick={() => onLayoutModeChange('sidebar')}
                className='flex flex-col items-center justify-center gap-0.5 text-xs min-w-[70px] px-3 py-2 rounded-full hover:bg-white/40 dark:hover:bg-gray-800/40 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-all duration-200 group'
                title='切换到侧边栏'
              >
                <Box className='h-6 w-6 group-hover:scale-110 transition-transform duration-200' />
                <span>侧边栏</span>
              </button>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
