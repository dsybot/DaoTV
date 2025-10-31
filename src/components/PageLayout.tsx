'use client';

import { useEffect, useState } from 'react';

import { BackButton } from './BackButton';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import Sidebar from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import AIRecommendModal from './AIRecommendModal';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

// 布局模式类型
type LayoutMode = 'sidebar' | 'bottom';

const PageLayout = ({ children, activePath = '/' }: PageLayoutProps) => {
  const [showAIRecommendModal, setShowAIRecommendModal] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean>(false); // 默认不显示，检查后再决定
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('sidebar'); // 布局模式状态

  // 从 localStorage 初始化布局模式
  useEffect(() => {
    const savedLayout = localStorage.getItem('layoutMode') as LayoutMode;
    if (savedLayout === 'sidebar' || savedLayout === 'bottom') {
      setLayoutMode(savedLayout);
    }
  }, []);

  // 切换布局模式的函数
  const toggleLayoutMode = (mode: LayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem('layoutMode', mode);
  };

  // 检查AI功能是否启用
  useEffect(() => {
    const checkAIEnabled = async () => {
      try {
        const response = await fetch('/api/admin/ai-recommend');
        if (response.ok) {
          const data = await response.json();
          setAiEnabled(data.enabled === true); // 只有明确启用才显示
        } else {
          // API 失败时默认隐藏（安全起见）
          setAiEnabled(false);
        }
      } catch (error) {
        // 发生错误时默认隐藏
        setAiEnabled(false);
      }
    };
    checkAIEnabled();

    // 监听配置更新事件，实时同步AI按钮显示状态
    const handleConfigUpdate = () => {
      console.log('配置更新，重新检查AI状态');
      checkAIEnabled();
    };
    
    window.addEventListener('adminConfigUpdated', handleConfigUpdate);
    return () => {
      window.removeEventListener('adminConfigUpdated', handleConfigUpdate);
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
      <div className={`flex w-full min-h-screen md:min-h-auto ${layoutMode === 'sidebar' ? 'md:grid md:grid-cols-[auto_1fr]' : ''}`}>
        {/* 侧边栏 - 根据布局模式显示 */}
        {layoutMode === 'sidebar' && (
          <div className='hidden md:block'>
            <Sidebar 
              activePath={activePath} 
              onLayoutModeChange={toggleLayoutMode}
            />
          </div>
        )}

        {/* 主内容区域 */}
        <div className='relative min-w-0 flex-1 transition-all duration-300'>
          {/* 桌面端左上角返回按钮 */}
          {['/play', '/live'].includes(activePath) && (
            <div className='absolute top-3 left-1 z-20 hidden md:flex'>
              <BackButton />
            </div>
          )}

          {/* 桌面端顶部按钮 */}
          <div className='absolute top-2 right-4 z-20 hidden md:flex items-center gap-2'>
            {/* AI推荐按钮 */}
            {shouldShowAIButton && (
              <button
                onClick={() => setShowAIRecommendModal(true)}
                className='relative w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:text-purple-500 dark:text-gray-300 dark:hover:text-purple-400 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-purple-500/30 dark:hover:shadow-purple-400/30 group'
                title='AI智能推荐'
                aria-label='AI Recommend'
              >
                {/* 微光背景效果 */}
                <div className='absolute inset-0 rounded-full bg-gradient-to-br from-purple-400/0 to-pink-600/0 group-hover:from-purple-400/20 group-hover:to-pink-600/20 dark:group-hover:from-purple-300/20 dark:group-hover:to-pink-500/20 transition-all duration-300'></div>

                {/* 机器人图标 */}
                <svg className='w-full h-full relative z-10 group-hover:scale-110 transition-transform duration-300' viewBox='0 0 1024 1024' fill='currentColor'>
                  <path d='M683.7 922.7h-345c-73.5 0-133.3-59.8-133.3-133.3V459.8c0-73.5 59.8-133.3 133.3-133.3h345c73.5 0 133.3 59.8 133.3 133.3v329.6c0 73.5-59.8 133.3-133.3 133.3z m-345-506.9c-24.3 0-44.1 19.8-44.1 44.1v329.6c0 24.3 19.8 44.1 44.1 44.1h345c24.3 0 44.1-19.8 44.1-44.1V459.8c0-24.3-19.8-44.1-44.1-44.1h-345zM914.3 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-20 44.6-44.6 44.6zM111.7 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-19.9 44.6-44.6 44.6z' />
                  <path d='M511.2 415.8c-24.6 0-44.6-20-44.6-44.6V239.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6v131.9c0 24.6-20 44.6-44.6 44.6z' />
                  <path d='M511.2 276.6c-49.2 0-89.2-40-89.2-89.2s40-89.2 89.2-89.2 89.2 40 89.2 89.2-40 89.2-89.2 89.2z m0-89.2h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0z m0 0h0.2-0.2z m0 0h0.2-0.2z m0-0.1h0.2-0.2zM399 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9s50.9 22.8 50.9 50.9c0 28.1-22.8 50.9-50.9 50.9zM622.9 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9 28.1 0 50.9 22.8 50.9 50.9 0 28.1-22.8 50.9-50.9 50.9z' />
                </svg>
              </button>
            )}
            <ThemeToggle />
            <UserMenu />
          </div>

          {/* 主内容 */}
          <main
            className={`flex-1 md:min-h-0 mt-12 md:mt-0 ${layoutMode === 'bottom' ? 'mb-14' : 'md:mb-0 mb-14'}`}
            style={{
              paddingBottom: layoutMode === 'bottom' ? 'calc(3.5rem + env(safe-area-inset-bottom))' : undefined,
            }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* 底部导航 - 移动端始终显示，桌面端根据布局模式显示 */}
      <div className={layoutMode === 'bottom' ? '' : 'md:hidden'}>
        <MobileBottomNav 
          activePath={activePath} 
        />
      </div>

      {/* 独立的布局切换按钮 - 仅在桌面端底栏模式下显示 */}
      {layoutMode === 'bottom' && (
        <button
          onClick={() => toggleLayoutMode('sidebar')}
          className='hidden md:flex fixed right-4 z-[601] flex-col items-center justify-center gap-0.5 text-xs w-16 h-16 rounded-full bg-white/40 backdrop-blur-2xl border border-gray-200/20 dark:bg-gray-900/30 dark:border-gray-700/20 shadow-2xl shadow-black/10 dark:shadow-black/30 hover:bg-white/50 dark:hover:bg-gray-900/40 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-all duration-200 group'
          style={{
            bottom: 'max(5.5rem, calc(3.5rem + env(safe-area-inset-bottom) + 1rem))',
          }}
          title='切换到侧边栏'
        >
          <svg className='h-6 w-6 group-hover:scale-110 transition-transform duration-200' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
            <line x1='9' y1='3' x2='9' y2='21'></line>
          </svg>
          <span className='text-[10px]'>侧边栏</span>
        </button>
      )}

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
