'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { isAIRecommendFeatureDisabled } from '@/lib/ai-recommend.client';

import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import AIRecommendModal from './AIRecommendModal';
import { useSite } from './SiteProvider';
import { GlassmorphismEffect } from './GlassmorphismEffect';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

const PageLayout = ({ children, activePath = '/' }: PageLayoutProps) => {
  const { siteName } = useSite();
  const [showAIRecommendModal, setShowAIRecommendModal] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean>(false);

  // 检查 AI 功能是否开启
  useEffect(() => {
    if (isAIRecommendFeatureDisabled()) {
      setAiEnabled(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/admin/ai-recommend');
        if (!cancelled) {
          if (response.ok) {
            const data = await response.json();
            setAiEnabled(data.enabled === true);
          } else {
            setAiEnabled(false);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setAiEnabled(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 判断是否显示 AI 按钮（除了管理员页面）
  const shouldShowAIButton = aiEnabled && activePath !== '/admin';

  return (
    <div className='w-full min-h-screen'>
      {/* 移动端头部 */}
      <MobileHeader
        showBackButton={['/play', '/live'].includes(activePath)}
        showAIButton={shouldShowAIButton}
        onAIClick={() => setShowAIRecommendModal(true)}
      />

      {/* 主要布局容器 */}
      <div className='flex w-full min-h-screen md:min-h-auto'>
        {/* 主内容区域 */}
        <div className='relative min-w-0 flex-1 transition-all duration-300'>
          {/* 桌面端顶部栏 - 采用悬浮样式 */}
          <div className='hidden md:flex fixed top-4 left-0 right-0 z-999 pointer-events-none'>
            <div className='w-full max-w-[1920px] mx-auto px-6 flex items-center justify-between'>
              {/* 左侧：网站标题 - 悬浮样式 */}
              <Link href='/' id='nav-title' className='shrink-0 pointer-events-auto'>
                <GlassmorphismEffect intensity="medium" animated={true} className='rounded-full px-4 py-2 border border-white/40 dark:border-gray-700/40'>
                  <div className='text-xl font-bold bg-linear-to-r from-green-600 via-emerald-600 to-teal-600 dark:from-green-400 dark:via-emerald-400 dark:to-teal-400 bg-clip-text text-transparent hover:scale-105 transition-transform duration-200'>
                    {siteName}
                  </div>
                </GlassmorphismEffect>
              </Link>

              {/* 右侧：功能按钮 - 悬浮样式 */}
              <div id='nav-buttons' className='pointer-events-auto'>
                <GlassmorphismEffect intensity="medium" animated={true} className='flex items-center gap-2 rounded-full px-3 py-2 border border-white/40 dark:border-gray-700/40'>
                  {/* AI推荐按钮 */}
                  {shouldShowAIButton && (
                    <button
                      onClick={() => setShowAIRecommendModal(true)}
                      className='relative w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:text-purple-500 dark:text-gray-300 dark:hover:text-purple-400 transition-all duration-300 hover:scale-110 hover:bg-purple-500/10 group'
                      title='AI智能推荐'
                      aria-label='AI Recommend'
                    >
                      <svg className='w-6 h-6 relative z-10 transition-transform duration-300 group-hover:scale-110' viewBox='0 0 1024 1024' fill='currentColor'>
                        <path d='M683.7 922.7h-345c-73.5 0-133.3-59.8-133.3-133.3V459.8c0-73.5 59.8-133.3 133.3-133.3h345c73.5 0 133.3 59.8 133.3 133.3v329.6c0 73.5-59.8 133.3-133.3 133.3z m-345-506.9c-24.3 0-44.1 19.8-44.1 44.1v329.6c0 24.3 19.8 44.1 44.1 44.1h345c24.3 0 44.1-19.8 44.1-44.1V459.8c0-24.3-19.8-44.1-44.1-44.1h-345zM914.3 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-20 44.6-44.6 44.6zM111.7 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-19.9 44.6-44.6 44.6z' />
                        <path d='M511.2 415.8c-24.6 0-44.6-20-44.6-44.6V239.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6v131.9c0 24.6-20 44.6-44.6 44.6z' />
                        <path d='M511.2 276.6c-49.2 0-89.2-40-89.2-89.2s40-89.2 89.2-89.2 89.2 40 89.2 89.2-40 89.2-89.2 89.2z m0-89.2h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0z m0 0h0.2-0.2z m0 0h0.2-0.2z m0-0.1h0.2-0.2zM399 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9s50.9 22.8 50.9 50.9c0 28.1-22.8 50.9-50.9 50.9zM622.9 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9 28.1 0 50.9 22.8 50.9 50.9 0 28.1-22.8 50.9-50.9 50.9z' />
                      </svg>
                    </button>
                  )}
                  <ThemeToggle />
                  <UserMenu />
                </GlassmorphismEffect>
              </div>
            </div>
          </div>

          {/* 主内容 */}
          <main className='flex-1 md:min-h-0 mt-12 md:mt-24 mb-24 md:mb-0'>
            {children}
          </main>
        </div>
      </div>

      {/* 导航栏 - 移动端在底部显示，桌面端在顶部显示 */}
      <MobileBottomNav activePath={activePath} />

      {/* AI推荐模态框 - 全局显示 */}
      {shouldShowAIButton && (
        <AIRecommendModal
          isOpen={showAIRecommendModal}
          onClose={() => setShowAIRecommendModal(false)}
        />
      )}
    </div>
  );
};

export default PageLayout;
