/* eslint-disable @typescript-eslint/no-explicit-any,react-hooks/exhaustive-deps */

'use client';

import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState, useRef } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

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
    // 渲染一个占位符以避免布局偏移
    return <div className='w-10 h-10' />;
  }

  const toggleTheme = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isAnimating) return;

    const targetTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeColor(targetTheme);

    // 检查是否支持 View Transitions API
    if (!(document as any).startViewTransition) {
      setTheme(targetTheme);
      return;
    }

    // 获取点击位置
    const x = e.clientX;
    const y = e.clientY;

    // 计算最大半径（从点击位置到最远角落的距离）
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    setIsAnimating(true);

    // 使用 View Transitions API 实现圆形扩散动画
    const transition = (document as any).startViewTransition(() => {
      setTheme(targetTheme);
    });

    // 设置 CSS 变量用于动画
    document.documentElement.style.setProperty('--theme-toggle-x', `${x}px`);
    document.documentElement.style.setProperty('--theme-toggle-y', `${y}px`);
    document.documentElement.style.setProperty('--theme-toggle-radius', `${maxRadius}px`);

    try {
      await transition.finished;
    } finally {
      setIsAnimating(false);
    }
  };

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      disabled={isAnimating}
      className='relative w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:text-amber-500 dark:text-gray-300 dark:hover:text-amber-400 transition-all duration-200 hover:scale-110 group disabled:opacity-70'
      aria-label='Toggle theme'
    >
      {/* 微光背景效果 */}
      <div className='absolute inset-0 rounded-full bg-linear-to-br from-amber-400/0 to-amber-600/0 group-hover:from-amber-400/20 group-hover:to-amber-600/20 dark:group-hover:from-amber-300/20 dark:group-hover:to-amber-500/20 transition-all duration-200'></div>

      {/* 图标容器 - 带旋转动画 */}
      <div className={`relative z-10 w-full h-full ${isAnimating ? 'animate-spin-once' : ''}`}>
        {resolvedTheme === 'dark' ? (
          <Sun className='w-full h-full group-hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] transition-all duration-300' />
        ) : (
          <Moon className='w-full h-full group-hover:drop-shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-300' />
        )}
      </div>
    </button>
  );
}
