/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Box, Cat, Clover, Film, Globe, Home, PanelLeft, PlaySquare, Radio, Search, Star, Tv } from 'lucide-react';
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
      icon: Search,
      label: '搜索',
      href: '/search',
      desktopOnly: true, // 桌面端底栏模式下显示
    },
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

  // 计算总项数（移动端不包含桌面端专属项）
  const totalItemsMobile = navItems.filter(item => !(item as any).desktopOnly).length;

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
        className='pointer-events-auto w-full md:w-auto bg-white/45 backdrop-blur-2xl border border-gray-200/20 dark:bg-gray-900/35 dark:border-gray-700/20 shadow-2xl shadow-black/10 dark:shadow-black/30 md:rounded-full rounded-2xl overflow-hidden md:mx-4'
      >
        <ul className='flex items-center overflow-x-auto md:overflow-visible scrollbar-hide md:justify-center md:gap-1 md:px-4 md:py-2'
          style={{
            /* 移动端样式 */
            minHeight: '3.5rem',
          }}
        >
          {navItems.map((item: any) => {
            const active = isActive(item.href);
            // 移动端隐藏桌面端专属项
            const hideOnMobile = item.desktopOnly && !onLayoutModeChange;
            
            // 为每个菜单项定义独特的颜色主题（与侧边栏保持一致）
            const colorThemes: Record<string, { hover: string; active: string }> = {
              '/': { hover: 'md:group-hover:text-green-600 md:dark:group-hover:text-green-400', active: 'text-green-600 dark:text-green-400' }, // 首页
              '/search': { hover: 'md:group-hover:text-blue-600 md:dark:group-hover:text-blue-400', active: 'text-blue-600 dark:text-blue-400' }, // 搜索
              '/source-browser': { hover: 'md:group-hover:text-emerald-600 md:dark:group-hover:text-emerald-400', active: 'text-emerald-600 dark:text-emerald-400' }, // 源浏览器
              '/douban?type=movie': { hover: 'md:group-hover:text-red-600 md:dark:group-hover:text-red-400', active: 'text-red-600 dark:text-red-400' }, // 电影
              '/douban?type=tv': { hover: 'md:group-hover:text-blue-600 md:dark:group-hover:text-blue-400', active: 'text-blue-600 dark:text-blue-400' }, // 剧集
              '/shortdrama': { hover: 'md:group-hover:text-purple-600 md:dark:group-hover:text-purple-400', active: 'text-purple-600 dark:text-purple-400' }, // 短剧
              '/douban?type=anime': { hover: 'md:group-hover:text-pink-600 md:dark:group-hover:text-pink-400', active: 'text-pink-600 dark:text-pink-400' }, // 动漫
              '/douban?type=show': { hover: 'md:group-hover:text-orange-600 md:dark:group-hover:text-orange-400', active: 'text-orange-600 dark:text-orange-400' }, // 综艺
              '/live': { hover: 'md:group-hover:text-teal-600 md:dark:group-hover:text-teal-400', active: 'text-teal-600 dark:text-teal-400' }, // 直播
              '/douban?type=custom': { hover: 'md:group-hover:text-yellow-600 md:dark:group-hover:text-yellow-400', active: 'text-yellow-600 dark:text-yellow-400' }, // 自定义
            };
            
            const theme = colorThemes[item.href] || colorThemes['/'];
            
            return (
              <li
                key={item.href}
                className={`flex-1 md:flex-initial flex-shrink-0 md:flex-shrink-0 ${hideOnMobile ? 'hidden md:flex' : ''}`}
              >
                <Link
                  href={item.href}
                  className='group flex flex-col items-center justify-center w-full h-14 gap-0.5 text-xs md:w-auto md:h-auto md:min-w-[70px] md:px-3 md:py-2 md:rounded-full md:hover:bg-white/40 md:dark:hover:bg-gray-800/40 transition-all duration-200'
                >
                  <item.icon
                    className={`h-6 w-6 transition-all duration-200 ${active
                      ? `${theme.active} md:scale-110`
                      : `text-gray-700 dark:text-gray-200 ${theme.hover} md:group-hover:scale-110`
                      }`}
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }}
                  />
                  <span
                    className={`text-[10px] md:text-xs transition-all duration-200 ${
                      active
                        ? `${theme.active} font-semibold`
                        : `text-gray-700 dark:text-gray-200 ${theme.hover}`
                    }`}
                    style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
          
          {/* 分隔线 - 仅在桌面端且提供了回调函数时显示 */}
          {onLayoutModeChange && (
            <li className='hidden md:flex items-center px-2'>
              <div className='w-px h-8 bg-gradient-to-b from-transparent via-gray-300 to-transparent dark:via-gray-600'></div>
            </li>
          )}
          
          {/* 切换到侧边栏按钮 - 仅在桌面端且提供了回调函数时显示 */}
          {onLayoutModeChange && (
            <li className='hidden md:flex flex-shrink-0'>
              <button
                onClick={() => onLayoutModeChange('sidebar')}
                className='group flex flex-col items-center justify-center gap-0.5 text-xs min-w-[70px] px-3 py-2 rounded-full hover:bg-white/40 dark:hover:bg-gray-800/40 text-gray-700 hover:text-indigo-600 dark:text-gray-200 dark:hover:text-indigo-400 transition-all duration-200'
                title='切换到侧边栏'
              >
                <PanelLeft 
                  className='h-6 w-6 group-hover:scale-110 transition-all duration-200' 
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }}
                />
                <span style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}>侧边栏</span>
              </button>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
