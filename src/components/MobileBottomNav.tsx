/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Cat, Clover, Film, Globe, Home, MoreHorizontal, PanelLeft, PlaySquare, Radio, Search, Star, Tv, X } from 'lucide-react';
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
  onLayoutModeChange?: (mode: 'sidebar' | 'top') => void;
}

const MobileBottomNav = ({ activePath, onLayoutModeChange }: MobileBottomNavProps) => {
  const pathname = usePathname();

  // 当前激活路径：优先使用传入的 activePath，否则回退到浏览器地址
  const currentActive = activePath ?? pathname;

  // 更多菜单状态
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const [navItems, setNavItems] = useState([
    { icon: Home, label: '首页', href: '/' },
    {
      icon: Search,
      label: '搜索',
      href: '/search',
      desktopOnly: true, // 桌面端顶栏模式下显示
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
      // 为每个自定义分类创建导航项
      const customItems = runtimeConfig.CUSTOM_CATEGORIES.map((category: any, index: number) => ({
        icon: Star,
        label: category.name || category.label || '自定义',
        href: `/douban?type=custom&customIndex=${index}`,
      }));

      setNavItems((prevItems) => [...prevItems, ...customItems]);
    }
  }, []);

  const isActive = (href: string) => {
    const typeMatch = href.match(/type=([^&]+)/)?.[1];
    const customIndexMatch = href.match(/customIndex=([^&]+)/)?.[1];

    // 解码URL以进行正确的比较
    const decodedActive = decodeURIComponent(currentActive);
    const decodedItemHref = decodeURIComponent(href);

    // 详情页和播放页不高亮任何导航项
    if (decodedActive.startsWith('/detail') || decodedActive.startsWith('/play')) {
      return false;
    }

    // 自定义分类需要同时匹配type=custom和customIndex
    if (typeMatch === 'custom' && customIndexMatch) {
      return (
        decodedActive.startsWith('/douban') &&
        decodedActive.includes('type=custom') &&
        decodedActive.includes(`customIndex=${customIndexMatch}`)
      );
    }

    return (
      decodedActive === decodedItemHref ||
      (decodedActive.startsWith('/douban') &&
        decodedActive.includes(`type=${typeMatch}`) &&
        typeMatch !== 'custom') || // 排除custom类型，因为上面已经处理
      (href === '/shortdrama' && decodedActive.startsWith('/shortdrama'))
    );
  };

  return (
    <>
      {/* 更多菜单弹窗 - 仅移动端 */}
      {showMoreMenu && (
        <div
          className='md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[700]'
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className='absolute bottom-20 left-2 right-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-3xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800/30 overflow-hidden'
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: 'calc(100vh - 10rem)',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl z-10'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>全部分类</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className='p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors'
              >
                <X className='w-5 h-5 text-gray-600 dark:text-gray-400' />
              </button>
            </div>

            {/* 所有菜单项的网格布局 */}
            <div className='grid grid-cols-4 gap-4 p-4'>
              {navItems.filter((item: any) => !item.desktopOnly).map((item: any) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                // 颜色渐变映射
                const gradientMap: Record<string, string> = {
                  '/': 'from-green-500 to-emerald-500',
                  '/search': 'from-blue-500 to-cyan-500',
                  '/source-browser': 'from-emerald-500 to-green-500',
                  '/douban?type=movie': 'from-red-500 to-pink-500',
                  '/douban?type=tv': 'from-blue-600 to-indigo-600',
                  '/shortdrama': 'from-purple-500 to-violet-500',
                  '/douban?type=anime': 'from-pink-500 to-rose-500',
                  '/douban?type=show': 'from-orange-500 to-amber-500',
                  '/live': 'from-teal-500 to-cyan-500',
                };

                // 对于自定义分类，使用黄色渐变
                let gradient = gradientMap[item.href];
                if (!gradient && item.href.includes('type=custom')) {
                  gradient = 'from-yellow-500 to-amber-500';
                }
                gradient = gradient || 'from-gray-500 to-slate-500';

                // 颜色主题映射
                const colorMap: Record<string, string> = {
                  '/': 'text-green-500',
                  '/search': 'text-blue-500',
                  '/source-browser': 'text-emerald-500',
                  '/douban?type=movie': 'text-red-500',
                  '/douban?type=tv': 'text-blue-600',
                  '/shortdrama': 'text-purple-500',
                  '/douban?type=anime': 'text-pink-500',
                  '/douban?type=show': 'text-orange-500',
                  '/live': 'text-teal-500',
                };

                // 对于自定义分类，使用黄色
                let color = colorMap[item.href];
                if (!color && item.href.includes('type=custom')) {
                  color = 'text-yellow-500';
                }
                color = color || 'text-gray-500';

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMoreMenu(false)}
                    className='flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 active:scale-95 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                  >
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-2xl ${active
                        ? `bg-gradient-to-br ${gradient}`
                        : 'bg-gray-100 dark:bg-gray-800'
                        }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${active
                          ? 'text-white'
                          : 'text-gray-600 dark:text-gray-400'
                          }`}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium ${active
                        ? color
                        : 'text-gray-700 dark:text-gray-300'
                        }`}
                    >
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
        style={{
          /* 移动端：紧贴视口底部 */
          paddingBottom: 0,
        }}
      >
        <div
          className='pointer-events-auto w-full md:w-auto md:max-w-[calc(100vw-2rem)] bg-white/30 backdrop-blur-2xl border border-gray-200/20 dark:bg-gray-900/20 dark:border-gray-700/20 shadow-2xl shadow-black/10 dark:shadow-black/30 md:rounded-full rounded-2xl overflow-hidden md:mx-4'
        >
          <ul className='flex items-center overflow-x-auto scrollbar-hide md:justify-center md:gap-1 md:px-4 md:py-2'
            style={{
              /* 移动端样式 */
              minHeight: '3.5rem',
            }}
          >
            {navItems.map((item: any, index: number) => {
              const active = isActive(item.href);
              // 移动端隐藏桌面端专属项（搜索）
              const hideOnMobile = item.desktopOnly && !onLayoutModeChange;

              // 移动端只显示前4个非搜索项（首页、源浏览、电影、剧集），index 5+ 的项隐藏到"更多"菜单
              const hideOnMobileAfterFour = index >= 5;

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
              };

              // 对于自定义分类，使用黄色主题
              let theme = colorThemes[item.href];
              if (!theme && item.href.includes('type=custom')) {
                theme = { hover: 'md:group-hover:text-yellow-600 md:dark:group-hover:text-yellow-400', active: 'text-yellow-600 dark:text-yellow-400' };
              }
              theme = theme || colorThemes['/'];

              return (
                <li
                  key={item.href}
                  className={`flex-1 md:flex-initial flex-shrink-0 md:flex-shrink-0 ${hideOnMobile ? 'hidden md:flex' : ''} ${hideOnMobileAfterFour ? 'hidden md:flex' : ''} ${onLayoutModeChange ? 'md:animate-[slideInFromBottom_0.3s_ease-out] md:opacity-0' : ''
                    }`}
                  style={
                    onLayoutModeChange
                      ? {
                        animation: `slideInFromBottom 0.3s ease-out ${index * 0.05}s forwards`,
                      }
                      : undefined
                  }
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
                      className={`text-[10px] md:text-xs transition-all duration-200 ${active
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

            {/* 更多按钮 - 仅在移动端显示 */}
            <li className='flex-1 md:hidden flex-shrink-0'>
              <button
                onClick={() => setShowMoreMenu(true)}
                className='flex flex-col items-center justify-center w-full h-14 gap-0.5 text-xs transition-all duration-200'
              >
                <MoreHorizontal
                  className='h-6 w-6 text-gray-700 dark:text-gray-200 transition-all duration-200'
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }}
                />
                <span
                  className='text-[10px] text-gray-700 dark:text-gray-200 transition-all duration-200'
                  style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}
                >
                  更多
                </span>
              </button>
            </li>

            {/* 分隔线 - 仅在桌面端且提供了回调函数时显示 */}
            {onLayoutModeChange && (
              <li
                className='hidden md:flex items-center px-2 md:animate-[slideInFromBottom_0.3s_ease-out] md:opacity-0'
                style={{
                  animation: `slideInFromBottom 0.3s ease-out ${navItems.length * 0.05}s forwards`,
                }}
              >
                <div className='w-px h-8 bg-gradient-to-b from-transparent via-gray-300 to-transparent dark:via-gray-600'></div>
              </li>
            )}

            {/* 切换到侧边栏按钮 - 仅在桌面端且提供了回调函数时显示 */}
            {onLayoutModeChange && (
              <li
                className='hidden md:flex flex-shrink-0 md:animate-[slideInFromBottom_0.3s_ease-out] md:opacity-0'
                style={{
                  animation: `slideInFromBottom 0.3s ease-out ${(navItems.length + 1) * 0.05}s forwards`,
                }}
              >
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
    </>
  );
};

export default MobileBottomNav;
