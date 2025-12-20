/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  Cat,
  ChevronDown,
  Clover,
  Film,
  Globe,
  Home,
  MoreHorizontal,
  PanelLeft,
  PlaySquare,
  Radio,
  Search,
  Star,
  Tv,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface MobileBottomNavProps {
  activePath?: string;
  onLayoutModeChange?: (mode: 'sidebar' | 'top') => void;
}

const MobileBottomNav = ({ activePath, onLayoutModeChange }: MobileBottomNavProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // 构建完整的当前路径（包含查询参数）
  const currentFullPath = activePath ?? (searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname);

  // 更多菜单状态
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // 桌面端下拉菜单状态
  const [showDesktopDropdown, setShowDesktopDropdown] = useState(false);
  const dropdownRef = useRef<HTMLLIElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);

  // 动态计算的可见项数量
  const [maxVisibleCount, setMaxVisibleCount] = useState(20);
  // 下拉菜单位置
  const [dropdownPosition, setDropdownPosition] = useState({ top: 60, right: 100 });

  // 每个导航项的宽度（包括间距）
  const ITEM_WIDTH = 76; // px
  // 更多按钮宽度
  const MORE_BUTTON_WIDTH = 76;
  // 分隔线和侧边栏按钮宽度
  const EXTRA_BUTTONS_WIDTH = 150;
  // 导航栏内边距
  const NAV_PADDING = 32;

  const [navItems, setNavItems] = useState([
    { icon: Home, label: '首页', href: '/' },
    { icon: Search, label: '搜索', href: '/search', desktopOnly: true },
    { icon: Globe, label: '源浏览', href: '/source-browser' },
    { icon: Film, label: '电影', href: '/douban?type=movie' },
    { icon: Tv, label: '剧集', href: '/douban?type=tv' },
    { icon: PlaySquare, label: '短剧', href: '/shortdrama' },
    { icon: Cat, label: '动漫', href: '/douban?type=anime' },
    { icon: Clover, label: '综艺', href: '/douban?type=show' },
    { icon: Radio, label: '直播', href: '/live' },
  ]);

  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      // 只添加一个"自定义"按钮，不管有多少个自定义分类
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

  // 动态计算可见项数量
  useEffect(() => {
    if (!onLayoutModeChange) return; // 只在桌面端顶栏模式下计算

    const calculateVisibleCount = () => {
      // 获取左侧标题和右侧按钮组元素
      const titleEl = document.getElementById('nav-title');
      const buttonsEl = document.getElementById('nav-buttons');

      if (titleEl && buttonsEl) {
        const titleRect = titleEl.getBoundingClientRect();
        const buttonsRect = buttonsEl.getBoundingClientRect();
        // 可用宽度 = 右侧按钮左边 - 左侧标题右边 - 间距
        const availableWidth = buttonsRect.left - titleRect.right - 48; // 48px 为两侧间距
        // 计算能放下多少个导航项（预留更多按钮和侧边栏按钮的位置）
        const count = Math.floor((availableWidth - MORE_BUTTON_WIDTH - EXTRA_BUTTONS_WIDTH) / ITEM_WIDTH);
        setMaxVisibleCount(Math.max(3, count)); // 至少显示3个
      } else {
        // 降级方案：使用视口宽度
        const viewportWidth = window.innerWidth;
        const availableWidth = viewportWidth - 400; // 预留左右元素空间
        const count = Math.floor((availableWidth - MORE_BUTTON_WIDTH - EXTRA_BUTTONS_WIDTH) / ITEM_WIDTH);
        setMaxVisibleCount(Math.max(3, count));
      }
    };

    // 延迟执行以确保DOM已渲染
    const timer = setTimeout(calculateVisibleCount, 100);
    window.addEventListener('resize', calculateVisibleCount);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateVisibleCount);
    };
  }, [onLayoutModeChange]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(target)
      ) {
        setShowDesktopDropdown(false);
      }
    };

    if (showDesktopDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDesktopDropdown]);

  // 更新下拉菜单位置
  useEffect(() => {
    if (showDesktopDropdown && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showDesktopDropdown]);

  // 处理下拉菜单项点击
  const handleDropdownItemClick = useCallback((href: string) => {
    setShowDesktopDropdown(false);
    router.push(href);
  }, [router]);

  const isActive = useCallback(
    (href: string) => {
      const typeMatch = href.match(/type=([^&]+)/)?.[1];
      const decodedActive = decodeURIComponent(currentFullPath);
      const decodedItemHref = decodeURIComponent(href);

      if (decodedActive.startsWith('/detail') || decodedActive.startsWith('/play')) {
        return false;
      }

      return (
        decodedActive === decodedItemHref ||
        (decodedActive.startsWith('/douban') &&
          typeMatch &&
          decodedActive.includes(`type=${typeMatch}`)) ||
        (href === '/shortdrama' && decodedActive.startsWith('/shortdrama'))
      );
    },
    [currentFullPath]
  );

  // 计算桌面端可见项和隐藏项
  const visibleItems = navItems.slice(0, maxVisibleCount);
  const hiddenItems = navItems.slice(maxVisibleCount);
  const hasHiddenItems = hiddenItems.length > 0;
  const hasActiveHiddenItem = hiddenItems.some((item) => isActive(item.href));

  // 获取颜色主题
  const getColorTheme = (href: string) => {
    const colorThemes: Record<
      string,
      { hover: string; active: string; gradient: string; color: string }
    > = {
      '/': {
        hover: 'md:group-hover:text-green-600 md:dark:group-hover:text-green-400',
        active: 'text-green-600 dark:text-green-400',
        gradient: 'from-green-500 to-emerald-500',
        color: 'text-green-500',
      },
      '/search': {
        hover: 'md:group-hover:text-blue-600 md:dark:group-hover:text-blue-400',
        active: 'text-blue-600 dark:text-blue-400',
        gradient: 'from-blue-500 to-cyan-500',
        color: 'text-blue-500',
      },
      '/source-browser': {
        hover: 'md:group-hover:text-emerald-600 md:dark:group-hover:text-emerald-400',
        active: 'text-emerald-600 dark:text-emerald-400',
        gradient: 'from-emerald-500 to-green-500',
        color: 'text-emerald-500',
      },
      '/douban?type=movie': {
        hover: 'md:group-hover:text-red-600 md:dark:group-hover:text-red-400',
        active: 'text-red-600 dark:text-red-400',
        gradient: 'from-red-500 to-pink-500',
        color: 'text-red-500',
      },
      '/douban?type=tv': {
        hover: 'md:group-hover:text-blue-600 md:dark:group-hover:text-blue-400',
        active: 'text-blue-600 dark:text-blue-400',
        gradient: 'from-blue-600 to-indigo-600',
        color: 'text-blue-600',
      },
      '/shortdrama': {
        hover: 'md:group-hover:text-purple-600 md:dark:group-hover:text-purple-400',
        active: 'text-purple-600 dark:text-purple-400',
        gradient: 'from-purple-500 to-violet-500',
        color: 'text-purple-500',
      },
      '/douban?type=anime': {
        hover: 'md:group-hover:text-pink-600 md:dark:group-hover:text-pink-400',
        active: 'text-pink-600 dark:text-pink-400',
        gradient: 'from-pink-500 to-rose-500',
        color: 'text-pink-500',
      },
      '/douban?type=show': {
        hover: 'md:group-hover:text-orange-600 md:dark:group-hover:text-orange-400',
        active: 'text-orange-600 dark:text-orange-400',
        gradient: 'from-orange-500 to-amber-500',
        color: 'text-orange-500',
      },
      '/live': {
        hover: 'md:group-hover:text-teal-600 md:dark:group-hover:text-teal-400',
        active: 'text-teal-600 dark:text-teal-400',
        gradient: 'from-teal-500 to-cyan-500',
        color: 'text-teal-500',
      },
    };

    let theme = colorThemes[href];
    if (!theme && href.includes('type=custom')) {
      theme = {
        hover: 'md:group-hover:text-yellow-600 md:dark:group-hover:text-yellow-400',
        active: 'text-yellow-600 dark:text-yellow-400',
        gradient: 'from-yellow-500 to-amber-500',
        color: 'text-yellow-500',
      };
    }
    return theme || colorThemes['/'];
  };


  return (
    <>
      {/* 更多菜单弹窗 - 仅移动端 */}
      {showMoreMenu && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[700]"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="absolute bottom-20 left-2 right-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-3xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800/30 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: 'calc(100vh - 10rem)', overflowY: 'auto' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">全部分类</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4 p-4">
              {navItems
                .filter((item: any) => !item.desktopOnly)
                .map((item: any) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const theme = getColorTheme(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMoreMenu(false)}
                      className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 active:scale-95 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                    >
                      <div
                        className={`flex items-center justify-center w-12 h-12 rounded-2xl ${active ? `bg-gradient-to-br ${theme.gradient}` : 'bg-gray-100 dark:bg-gray-800'
                          }`}
                      >
                        <Icon className={`w-6 h-6 ${active ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                      </div>
                      <span className={`text-xs font-medium ${active ? theme.color : 'text-gray-700 dark:text-gray-300'}`}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      <nav
        className={`fixed left-0 right-0 z-[600] flex justify-center pointer-events-none ${onLayoutModeChange ? 'bottom-0 md:top-4 md:bottom-auto' : 'bottom-0'
          }`}
      >
        <div
          ref={navContainerRef}
          className="pointer-events-auto w-full md:w-auto md:max-w-[calc(100vw-2rem)] bg-white/30 backdrop-blur-2xl border border-gray-200/20 dark:bg-gray-900/20 dark:border-gray-700/20 shadow-2xl shadow-black/10 dark:shadow-black/30 md:rounded-full rounded-2xl overflow-visible md:mx-4 relative"
        >
          <ul
            className="flex items-center overflow-x-auto scrollbar-hide md:justify-center md:gap-1 md:px-4 md:py-2"
            style={{ minHeight: '3.5rem' }}
          >
            {visibleItems.map((item: any, index: number) => {
              const active = isActive(item.href);
              const hideOnMobile = item.desktopOnly;
              // 移动端：计算非desktopOnly项目的索引，超过4个隐藏
              const mobileItems = navItems.filter((i: any) => !i.desktopOnly);
              const mobileIndex = mobileItems.findIndex((i: any) => i.href === item.href);
              const hideOnMobileAfterFour = mobileIndex >= 4;
              const theme = getColorTheme(item.href);

              return (
                <li
                  key={item.href}
                  className={`flex-1 md:flex-initial flex-shrink-0 md:flex-shrink-0 ${hideOnMobile ? 'hidden md:flex' : ''} ${hideOnMobileAfterFour ? 'hidden md:flex' : ''
                    } ${onLayoutModeChange ? 'md:animate-[slideInFromBottom_0.3s_ease-out] md:opacity-0' : ''}`}
                  style={
                    onLayoutModeChange
                      ? { animation: `slideInFromBottom 0.3s ease-out ${index * 0.05}s forwards` }
                      : undefined
                  }
                >
                  <Link
                    href={item.href}
                    className="group flex flex-col items-center justify-center w-full h-14 gap-0.5 text-xs md:w-auto md:h-auto md:min-w-[70px] md:px-3 md:py-2 md:rounded-full md:hover:bg-white/40 md:dark:hover:bg-gray-800/40 transition-all duration-200"
                  >
                    <item.icon
                      className={`h-6 w-6 transition-all duration-200 ${active
                        ? `${theme.active} md:scale-110`
                        : `text-gray-700 dark:text-gray-200 ${theme.hover} md:group-hover:scale-110`
                        }`}
                      style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }}
                    />
                    <span
                      className={`text-[10px] md:text-xs transition-all duration-200 ${active ? `${theme.active} font-semibold` : `text-gray-700 dark:text-gray-200 ${theme.hover}`
                        }`}
                      style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}

            {/* 桌面端更多下拉菜单按钮 */}
            {hasHiddenItems && onLayoutModeChange && (
              <li
                className="hidden md:flex flex-shrink-0 relative"
                ref={dropdownRef}
                style={{ animation: `slideInFromBottom 0.3s ease-out ${visibleItems.length * 0.05}s forwards` }}
              >
                <button
                  onClick={() => setShowDesktopDropdown(!showDesktopDropdown)}
                  className={`group flex flex-col items-center justify-center gap-0.5 text-xs min-w-[70px] px-3 py-2 rounded-full hover:bg-white/40 dark:hover:bg-gray-800/40 transition-all duration-200 ${hasActiveHiddenItem ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-200'
                    }`}
                >
                  <div className="relative">
                    <ChevronDown
                      className={`h-6 w-6 transition-all duration-200 group-hover:scale-110 ${showDesktopDropdown ? 'rotate-180' : ''}`}
                      style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }}
                    />
                    {hasActiveHiddenItem && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full"></span>
                    )}
                  </div>
                  <span style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}>更多</span>
                </button>
              </li>
            )}

            {/* 更多按钮 - 仅在移动端显示 */}
            <li className="flex-1 md:hidden flex-shrink-0">
              <button
                onClick={() => setShowMoreMenu(true)}
                className="flex flex-col items-center justify-center w-full h-14 gap-0.5 text-xs transition-all duration-200"
              >
                <MoreHorizontal
                  className="h-6 w-6 text-gray-700 dark:text-gray-200 transition-all duration-200"
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }}
                />
                <span
                  className="text-[10px] text-gray-700 dark:text-gray-200 transition-all duration-200"
                  style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}
                >
                  更多
                </span>
              </button>
            </li>

            {/* 分隔线 */}
            {onLayoutModeChange && (
              <li
                className="hidden md:flex items-center px-2"
                style={{
                  animation: `slideInFromBottom 0.3s ease-out ${(visibleItems.length + (hasHiddenItems ? 1 : 0)) * 0.05}s forwards`,
                }}
              >
                <div className="w-px h-8 bg-gradient-to-b from-transparent via-gray-300 to-transparent dark:via-gray-600"></div>
              </li>
            )}

            {/* 切换到侧边栏按钮 */}
            {onLayoutModeChange && (
              <li
                className="hidden md:flex flex-shrink-0"
                style={{
                  animation: `slideInFromBottom 0.3s ease-out ${(visibleItems.length + (hasHiddenItems ? 2 : 1)) * 0.05}s forwards`,
                }}
              >
                <button
                  onClick={() => onLayoutModeChange('sidebar')}
                  className="group flex flex-col items-center justify-center gap-0.5 text-xs min-w-[70px] px-3 py-2 rounded-full hover:bg-white/40 dark:hover:bg-gray-800/40 text-gray-700 hover:text-indigo-600 dark:text-gray-200 dark:hover:text-indigo-400 transition-all duration-200"
                  title="切换到侧边栏"
                >
                  <PanelLeft
                    className="h-6 w-6 group-hover:scale-110 transition-all duration-200"
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }}
                  />
                  <span style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}>侧边栏</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      </nav>

      {/* 桌面端下拉菜单 - 放在nav外面避免被裁剪 */}
      {showDesktopDropdown && hasHiddenItems && onLayoutModeChange && (
        <div
          ref={dropdownMenuRef}
          className="hidden md:block fixed z-[800] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden min-w-[160px] pointer-events-auto"
          style={{
            top: dropdownPosition.top,
            right: dropdownPosition.right,
          }}
        >
          <div className="py-2">
            {hiddenItems.map((item: any) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const theme = getColorTheme(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => handleDropdownItemClick(item.href)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-colors text-left ${active ? 'bg-gray-100/50 dark:bg-gray-800/50' : ''}`}
                >
                  <Icon className={`h-5 w-5 ${active ? theme.color : 'text-gray-500 dark:text-gray-400'}`} />
                  <span className={`text-sm font-medium ${active ? theme.color : 'text-gray-700 dark:text-gray-300'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

export default MobileBottomNav;
