/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useRef, useState } from 'react';

interface CapsuleSwitchProps {
  options: { label: string; value: string; icon?: React.ReactNode }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
  variant?: 'default' | 'soft';
}

const CapsuleSwitch: React.FC<CapsuleSwitchProps> = ({
  options,
  active,
  onChange,
  className,
  variant = 'default',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });

  const activeIndex = options.findIndex((opt) => opt.value === active);

  // 更新指示器位置
  const updateIndicatorPosition = (autoScroll = false) => {
    const button = buttonRefs.current[activeIndex];
    const container = containerRef.current;

    if (activeIndex < 0 || !button || !container) return;

    if (variant === 'soft' && scrollContainerRef.current) {
      const scrollContainer = scrollContainerRef.current;
      const left = button.offsetLeft;
      const width = button.offsetWidth;

      if (width > 0) {
        setIndicatorStyle({ left, width });

        if (autoScroll && !isScrollingRef.current) {
          const buttonRect = button.getBoundingClientRect();
          const scrollRect = scrollContainer.getBoundingClientRect();
          const isVisible =
            buttonRect.left >= scrollRect.left && buttonRect.right <= scrollRect.right;

          if (!isVisible) {
            scrollContainer.scrollTo({
              left: left - scrollContainer.offsetWidth / 2 + width / 2,
              behavior: 'smooth',
            });
          }
        }
      }

      return;
    }

    const buttonRect = button.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    if (buttonRect.width > 0) {
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    }
  };

  // 组件挂载时立即计算初始位置
  useEffect(() => {
    const timeoutId = setTimeout(() => updateIndicatorPosition(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // 监听选中项变化
  useEffect(() => {
    const timeoutId = setTimeout(() => updateIndicatorPosition(true), 0);
    return () => clearTimeout(timeoutId);
  }, [activeIndex]);

  useEffect(() => {
    if (variant !== 'soft') return;
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      isScrollingRef.current = true;
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      updateIndicatorPosition(false);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [activeIndex, variant]);

  if (variant === 'soft') {
    return (
      <div
        ref={containerRef}
        className={`relative inline-flex max-w-full rounded-full bg-gray-300/80 p-1 dark:bg-gray-700 ${
          className || ''
        }`}
      >
        <div
          ref={scrollContainerRef}
          className='relative flex overflow-x-auto scrollbar-hide'
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {indicatorStyle.width > 0 && (
            <div
              className='absolute bottom-0 top-0 rounded-full bg-white shadow-sm transition-all duration-300 ease-out pointer-events-none dark:bg-gray-500'
              style={{
                left: `${indicatorStyle.left}px`,
                width: `${indicatorStyle.width}px`,
              }}
            />
          )}

          {options.map((opt, index) => {
            const isActive = active === opt.value;
            return (
              <button
                key={opt.value}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                onClick={() => onChange(opt.value)}
                className={`relative z-10 flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 sm:px-4 sm:py-2 sm:text-sm ${
                  isActive
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                }`}
              >
                {opt.icon && (
                  <span className='inline-flex items-center'>{opt.icon}</span>
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="inline-block">
      <div
        ref={containerRef}
        className={`relative inline-flex bg-linear-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-full p-1 shadow-lg ${className || ''
          }`}
      >
        {/* 滑动的渐变背景指示器 */}
        {indicatorStyle.width > 0 && (
          <div
            className='absolute top-1 bottom-1 bg-linear-to-r from-green-500 via-emerald-500 to-teal-500 dark:from-green-600 dark:via-emerald-600 dark:to-teal-600 rounded-full shadow-xl transition-all duration-300 ease-out'
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(20, 184, 166, 0.3)',
            }}
          />
        )}

        {options.map((opt, index) => {
          const isActive = active === opt.value;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              onClick={() => onChange(opt.value)}
              className={`relative z-10 w-16 px-3 py-1 text-xs sm:w-20 sm:py-2 sm:text-sm rounded-full font-bold transition-all duration-200 cursor-pointer ${isActive
                ? 'text-white dark:text-white drop-shadow-lg'
                : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CapsuleSwitch;
