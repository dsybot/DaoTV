'use client';

import Link from 'next/link';

import { BackButton } from './BackButton';
import { GlassmorphismEffect } from './GlassmorphismEffect';
import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface MobileHeaderProps {
  showBackButton?: boolean;
  showAIButton?: boolean;
  onAIClick?: () => void;
}

const MobileHeader = ({ showBackButton = false, showAIButton = false, onAIClick }: MobileHeaderProps) => {
  const { siteName } = useSite();
  return (
    <header className='md:hidden fixed top-0 left-0 right-0 z-999 w-full'>
      <GlassmorphismEffect
        intensity="light"
        animated={false}
        className='h-12 border-b border-white/20 dark:border-gray-700/20 relative'
      >
        <div className='h-full flex items-center justify-between px-4'>
          {/* 左侧：搜索按钮、AI按钮、返回按钮 */}
          <div className='flex items-center gap-2 z-10'>
            <Link
              href='/search'
              className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
            >
              <svg
                className='w-full h-full'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                />
              </svg>
            </Link>
            {/* AI推荐按钮 */}
            {showAIButton && onAIClick && (
              <button
                onClick={onAIClick}
                className='relative w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:text-purple-500 dark:text-gray-300 dark:hover:text-purple-400 transition-all duration-300 hover:scale-110 group'
                title='AI智能推荐'
                aria-label='AI Recommend'
              >
                {/* 微光背景效果 */}
                <div className='absolute inset-0 rounded-full bg-linear-to-br from-purple-400/0 to-pink-600/0 group-hover:from-purple-400/20 group-hover:to-pink-600/20 transition-all duration-300'></div>

                {/* 机器人图标 */}
                <svg className='w-full h-full relative z-10 group-hover:scale-110 transition-transform duration-300' viewBox='0 0 1024 1024' fill='currentColor'>
                  <path d='M683.7 922.7h-345c-73.5 0-133.3-59.8-133.3-133.3V459.8c0-73.5 59.8-133.3 133.3-133.3h345c73.5 0 133.3 59.8 133.3 133.3v329.6c0 73.5-59.8 133.3-133.3 133.3z m-345-506.9c-24.3 0-44.1 19.8-44.1 44.1v329.6c0 24.3 19.8 44.1 44.1 44.1h345c24.3 0 44.1-19.8 44.1-44.1V459.8c0-24.3-19.8-44.1-44.1-44.1h-345zM914.3 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-20 44.6-44.6 44.6zM111.7 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-19.9 44.6-44.6 44.6z' />
                  <path d='M511.2 415.8c-24.6 0-44.6-20-44.6-44.6V239.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6v131.9c0 24.6-20 44.6-44.6 44.6z' />
                  <path d='M511.2 276.6c-49.2 0-89.2-40-89.2-89.2s40-89.2 89.2-89.2 89.2 40 89.2 89.2-40 89.2-89.2 89.2z m0-89.2h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0z m0 0h0.2-0.2z m0 0h0.2-0.2z m0-0.1h0.2-0.2zM399 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9s50.9 22.8 50.9 50.9c0 28.1-22.8 50.9-50.9 50.9zM622.9 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9 28.1 0 50.9 22.8 50.9 50.9 0 28.1-22.8 50.9-50.9 50.9z' />
                </svg>
              </button>
            )}
            {showBackButton && <BackButton />}
          </div>

          {/* 中间：Logo（绝对居中） */}
          <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'>
            <Link
              href='/'
              className='text-2xl font-bold text-green-600 dark:text-green-400 tracking-tight hover:opacity-80 transition-opacity'
            >
              {siteName}
            </Link>
          </div>

          {/* 右侧按钮 */}
          <div className='flex items-center gap-2 z-10'>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </GlassmorphismEffect>
    </header>
  );
};

export default MobileHeader;
