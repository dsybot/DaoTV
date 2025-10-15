import { BackButton } from './BackButton';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import Sidebar from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
  showAIButton?: boolean;
  onAIClick?: () => void;
}

const PageLayout = ({ children, activePath = '/', showAIButton = false, onAIClick }: PageLayoutProps) => {
  return (
    <div className='w-full min-h-screen'>
      {/* 移动端头部 */}
      <MobileHeader showBackButton={['/play', '/live'].includes(activePath)} />

      {/* 主要布局容器 */}
      <div className='flex md:grid md:grid-cols-[auto_1fr] w-full min-h-screen md:min-h-auto'>
        {/* 侧边栏 - 桌面端显示，移动端隐藏 */}
        <div className='hidden md:block'>
          <Sidebar activePath={activePath} />
        </div>

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
            {showAIButton && onAIClick && (
              <button
                onClick={onAIClick}
                className='relative w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:text-purple-500 dark:text-gray-300 dark:hover:text-purple-400 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-purple-500/30 dark:hover:shadow-purple-400/30 group'
                title='AI智能推荐'
                aria-label='AI Recommend'
              >
                {/* 微光背景效果 */}
                <div className='absolute inset-0 rounded-full bg-gradient-to-br from-purple-400/0 to-pink-600/0 group-hover:from-purple-400/20 group-hover:to-pink-600/20 dark:group-hover:from-purple-300/20 dark:group-hover:to-pink-500/20 transition-all duration-300'></div>

                {/* 机器人图标 */}
                <svg className='w-full h-full relative z-10 group-hover:scale-110 transition-transform duration-300' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' viewBox='0 0 24 24'>
                  <rect x='4' y='8' width='16' height='12' rx='2'/>
                  <path d='M9 8V6a3 3 0 0 1 6 0v2'/>
                  <circle cx='9' cy='13' r='1'/>
                  <circle cx='15' cy='13' r='1'/>
                  <path d='M9 17h6'/>
                  <path d='M2 12h2'/>
                  <path d='M20 12h2'/>
                </svg>
              </button>
            )}
            <ThemeToggle />
            <UserMenu />
          </div>

          {/* 主内容 */}
          <main
            className='flex-1 md:min-h-0 mb-14 md:mb-0 md:mt-0 mt-12'
            style={{
              paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))',
            }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* 移动端底部导航 */}
      <div className='md:hidden'>
        <MobileBottomNav activePath={activePath} />
      </div>
    </div>
  );
};

export default PageLayout;
