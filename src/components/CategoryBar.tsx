'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// 简单的 className 合并函数
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

interface CategoryBarProps {
  /** 分组数据: { 分组名: 频道数组 } */
  groupedChannels: { [key: string]: unknown[] };
  /** 当前选中的分组 */
  selectedGroup: string;
  /** 切换分组回调 */
  onGroupChange: (group: string) => void;
  /** 是否禁用（切换直播源时） */
  disabled?: boolean;
  /** 禁用时的提示文字 */
  disabledMessage?: string;
}

/**
 * 直播频道分类选择器组件 (工业级重构版 - LunaTV 紫色主题)
 * - 强制单行显示，支持横向滚动
 * - 移动端：隐藏滚动条，手指滑屏
 * - PC 端：隐藏滚动条，两侧箭头控制 + 渐变遮罩
 * - 精准边界检测，防止高分屏小数点误差
 */
export default function CategoryBar({
  groupedChannels,
  selectedGroup,
  onGroupChange,
  disabled = false,
  disabledMessage = '切换直播源中...',
}: CategoryBarProps) {
  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 分组按钮引用数组
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 箭头显示状态
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  // 组件挂载状态
  const [isMounted, setIsMounted] = useState(false);
  // 手动滚动状态（防止与自动居中冲突）
  const [isManualScrolling, setIsManualScrolling] = useState(false);
  const manualScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 滚动距离（每次点击箭头滚动的像素，约为容器宽度的 50%）
  const SCROLL_DISTANCE = 300;
  // 边界检测阈值（防止高分屏小数点误差）
  const BOUNDARY_THRESHOLD = 2;

  // 获取分组列表
  const groups = Object.keys(groupedChannels);

  /**
   * 精准边界检测 - 更新箭头显示状态
   * 使用 2px 阈值防止高分屏下的小数点导致判断失误
   */
  const checkScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;

    // 左箭头：scrollLeft > 2px 时显示
    setShowLeftArrow(scrollLeft > BOUNDARY_THRESHOLD);
    // 右箭头：未滚动到底部时显示（留 2px 误差）
    setShowRightArrow(
      scrollLeft < scrollWidth - clientWidth - BOUNDARY_THRESHOLD,
    );
  }, []);

  /**
   * 向左滚动
   */
  const scrollLeft = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 设置手动滚动标志
    setIsManualScrolling(true);

    // 清除之前的定时器
    if (manualScrollTimeoutRef.current) {
      clearTimeout(manualScrollTimeoutRef.current);
    }

    container.scrollBy({
      left: -SCROLL_DISTANCE,
      behavior: 'smooth',
    });

    // 600ms 后重置手动滚动标志（等待滚动动画完成）
    manualScrollTimeoutRef.current = setTimeout(() => {
      setIsManualScrolling(false);
    }, 600);
  }, []);

  /**
   * 向右滚动
   */
  const scrollRight = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 设置手动滚动标志
    setIsManualScrolling(true);

    // 清除之前的定时器
    if (manualScrollTimeoutRef.current) {
      clearTimeout(manualScrollTimeoutRef.current);
    }

    container.scrollBy({
      left: SCROLL_DISTANCE,
      behavior: 'smooth',
    });

    // 600ms 后重置手动滚动标志（等待滚动动画完成）
    manualScrollTimeoutRef.current = setTimeout(() => {
      setIsManualScrolling(false);
    }, 600);
  }, []);

  /**
   * 将选中的分组滚动到视口中央
   * 使用 ref 避免依赖 selectedGroup，防止频繁重建
   */
  const scrollToActiveGroup = useCallback(() => {
    // 如果正在手动滚动，不执行自动居中（防止冲突）
    if (isManualScrolling) return;

    const currentGroup = selectedGroup;
    if (!currentGroup) return;

    const groupKeys = Object.keys(groupedChannels);
    const groupIndex = groupKeys.indexOf(currentGroup);
    if (groupIndex === -1) return;

    const button = buttonRefs.current[groupIndex];
    if (!button) return;

    // 使用 setTimeout 延迟执行，确保 DOM 已更新
    setTimeout(() => {
      button.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }, 0);
  }, [isManualScrolling, selectedGroup, groupedChannels]);

  /**
   * 组件挂载后初始化
   * - 延迟检测确保 DOM 完全渲染
   * - 绑定 scroll 和 resize 事件
   */
  useEffect(() => {
    setIsMounted(true);

    const container = scrollContainerRef.current;
    if (!container) return;

    // 立即检测一次
    checkScroll();

    // 延迟 100ms 再检测一次，确保 DOM 完全渲染
    const initTimer = setTimeout(checkScroll, 100);
    // 再延迟 300ms 检测，处理字体加载等延迟渲染
    const delayTimer = setTimeout(checkScroll, 300);

    // 绑定 scroll 事件（使用 passive 提升性能）
    container.addEventListener('scroll', checkScroll, { passive: true });
    // 绑定 resize 事件
    window.addEventListener('resize', checkScroll);

    return () => {
      clearTimeout(initTimer);
      clearTimeout(delayTimer);
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  // 分组数据变化时重新检测
  useEffect(() => {
    if (isMounted) {
      // 延迟检测，等待新内容渲染
      const timer = setTimeout(checkScroll, 50);
      return () => clearTimeout(timer);
    }
  }, [groupedChannels, isMounted, checkScroll]);

  // 当选中分组变化时，滚动到对应位置（但排除手动滚动时）
  useEffect(() => {
    // 只在组件已挂载且不是手动滚动时才自动居中
    if (isMounted && !isManualScrolling) {
      // 使用更长的延迟，确保手动滚动标志正确设置
      const timer = setTimeout(() => {
        scrollToActiveGroup();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedGroup, isMounted, scrollToActiveGroup, isManualScrolling]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (manualScrollTimeoutRef.current) {
        clearTimeout(manualScrollTimeoutRef.current);
      }
    };
  }, []);

  // 如果没有分组，不渲染
  if (groups.length === 0) return null;

  return (
    <div className='mb-3 shrink-0'>
      {/* 禁用状态提示 */}
      {disabled && disabledMessage && (
        <div className='flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 pb-2'>
          <div className='w-2 h-2 bg-amber-500 rounded-full animate-pulse' />
          {disabledMessage}
        </div>
      )}

      {/* 分类选择器容器 */}
      <div className='relative flex items-center gap-2 pb-3'>
        {/* 分组标签滚动容器 */}
        <div className='relative flex-1 min-w-0'>
          {/* 左侧箭头按钮 - 仅 PC 端显示 */}
          <button
            onClick={scrollLeft}
            disabled={!showLeftArrow}
            className={cn(
              'hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-20',
              'w-9 h-9 items-center justify-center',
              'rounded-full backdrop-blur-md',
              'bg-black/40 dark:bg-black/60',
              'text-white shadow-lg',
              'transition-all duration-200 ease-out',
              'hover:bg-purple-500 hover:scale-110 hover:shadow-xl',
              'active:scale-95',
              'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
              showLeftArrow
                ? 'opacity-100 pointer-events-auto translate-x-0'
                : 'opacity-0 pointer-events-none -translate-x-2',
            )}
            aria-label='向左滚动'
          >
            <ChevronLeft className='w-5 h-5' />
          </button>

          {/* 右侧箭头按钮 - 仅 PC 端显示 */}
          <button
            onClick={scrollRight}
            disabled={!showRightArrow}
            className={cn(
              'hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-20',
              'w-9 h-9 items-center justify-center',
              'rounded-full backdrop-blur-md',
              'bg-black/40 dark:bg-black/60',
              'text-white shadow-lg',
              'transition-all duration-200 ease-out',
              'hover:bg-purple-500 hover:scale-110 hover:shadow-xl',
              'active:scale-95',
              'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
              showRightArrow
                ? 'opacity-100 pointer-events-auto translate-x-0'
                : 'opacity-0 pointer-events-none translate-x-2',
            )}
            aria-label='向右滚动'
          >
            <ChevronRight className='w-5 h-5' />
          </button>

          {/* 左侧渐变遮罩 - 仅 PC 端显示 */}
          <div
            className={cn(
              'hidden lg:block absolute left-0 top-0 bottom-0 w-12 z-10',
              'bg-gradient-to-r from-gray-50 dark:from-gray-900 to-transparent',
              'pointer-events-none transition-opacity duration-300',
              showLeftArrow ? 'opacity-100' : 'opacity-0',
            )}
          />

          {/* 右侧渐变遮罩 - 仅 PC 端显示 */}
          <div
            className={cn(
              'hidden lg:block absolute right-0 top-0 bottom-0 w-12 z-10',
              'bg-gradient-to-l from-gray-50 dark:from-gray-900 to-transparent',
              'pointer-events-none transition-opacity duration-300',
              showRightArrow ? 'opacity-100' : 'opacity-0',
            )}
          />

          {/* 横向滚动的分类标签列表 */}
          <div
            ref={scrollContainerRef}
            className={cn(
              'flex gap-2 overflow-x-auto',
              'lg:px-10', // PC 端添加内边距，防止被按钮遮挡
              'scroll-smooth',
            )}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* 隐藏 Webkit 滚动条的样式 */}
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>

            {groups.map((group, index) => {
              const isActive = group === selectedGroup;
              const channelCount = groupedChannels[group].length;

              return (
                <button
                  key={group}
                  data-group={group}
                  ref={(el) => {
                    buttonRefs.current[index] = el;
                  }}
                  onClick={() => onGroupChange(group)}
                  disabled={disabled}
                  className={cn(
                    'shrink-0 px-4 py-2 rounded-full text-sm font-medium',
                    'transition-all duration-200 whitespace-nowrap',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1',
                    disabled && 'opacity-50 cursor-not-allowed',
                    !disabled &&
                      isActive &&
                      'bg-purple-500 text-white shadow-lg shadow-purple-500/30 scale-105',
                    !disabled &&
                      !isActive &&
                      'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-102 active:scale-98',
                  )}
                >
                  {group}
                  <span
                    className={cn(
                      'ml-1.5 text-xs',
                      isActive
                        ? 'text-white/80'
                        : 'text-gray-500 dark:text-gray-400',
                    )}
                  >
                    ({channelCount})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
