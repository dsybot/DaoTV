/* eslint-disable @typescript-eslint/no-explicit-any,react-hooks/exhaustive-deps */

'use client';

import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();
  const [isFlipping, setIsFlipping] = useState(false);

  const setThemeColor = (theme?: string) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = theme === 'dark' ? '#0c111c' : '#f9fbfe';
      document.head.appendChild(meta);
    } else {
      meta.setAttribute('content', theme === 'dark' ? '#0c111c' : '#f9fbfe');
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // 监听主题变化和路由变化，确保主题色始终同步
  useEffect(() => {
    if (mounted) {
      setThemeColor(resolvedTheme);
    }
  }, [mounted, resolvedTheme, pathname]);

  if (!mounted) {
    return <div className='w-10 h-10' />;
  }

  const toggleTheme = () => {
    const targetTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

    // 触发图标翻转动画
    setIsFlipping(true);
    setTimeout(() => setIsFlipping(false), 400);

    // 在动画中间点切换主题（200ms 时图标正好翻转到侧面看不见）
    setTimeout(() => {
      setThemeColor(targetTheme);
      setTheme(targetTheme);
    }, 200);
  };

  return (
    <button
      onClick={toggleTheme}
      className='relative w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:text-amber-500 dark:text-gray-300 dark:hover:text-amber-400 transition-colors duration-200 hover:scale-110 active:scale-95 group'
      style={{ perspective: '200px' }}
      aria-label='Toggle theme'
    >
      {/* 背景光晕 */}
      <div className='absolute inset-0 rounded-full bg-amber-400/0 group-hover:bg-amber-400/10 dark:group-hover:bg-amber-300/10 transition-colors duration-200' />

      {/* 图标 - 3D 翻转效果 */}
      <div
        className={`relative z-10 w-full h-full ${isFlipping ? 'animate-icon-flip' : ''}`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {resolvedTheme === 'dark' ? (
          <Sun className='w-full h-full drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]' />
        ) : (
          <Moon className='w-full h-full drop-shadow-[0_0_6px_rgba(99,102,241,0.3)]' />
        )}
      </div>
    </button>
  );
}
