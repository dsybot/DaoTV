'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { isAIRecommendFeatureDisabled } from '@/lib/ai-recommend.client';

import AIRecommendModal from './AIRecommendModal';
import MobileHeader from './MobileHeader';
import ModernNav from './ModernNav';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

const PageLayout = ({ children, activePath = '/' }: PageLayoutProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAIRecommendModal, setShowAIRecommendModal] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean>(false);
  const [desktopSearchQuery, setDesktopSearchQuery] = useState('');

  useEffect(() => {
    const disabled = isAIRecommendFeatureDisabled();
    setAiEnabled(!disabled);
  }, []);

  useEffect(() => {
    if (pathname === '/search') {
      setDesktopSearchQuery(searchParams.get('q') || '');
      return;
    }

    setDesktopSearchQuery('');
  }, [pathname, searchParams]);

  const shouldShowAIButton = aiEnabled && activePath !== '/admin';
  const isHomePage = pathname === '/' && activePath === '/';
  const mainSpacingClass =
    isHomePage
      ? 'md:mt-0'
      : 'md:mt-24 md:pl-56 xl:pl-60 md:pr-6 xl:pr-8';

  const handleDesktopSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = desktopSearchQuery.trim().replace(/\s+/g, ' ');

    if (!trimmed) {
      router.push('/search');
      return;
    }

    setDesktopSearchQuery(trimmed);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className='w-full min-h-screen'>
      <MobileHeader
        showBackButton={['/play', '/live'].includes(activePath)}
        showAIButton={shouldShowAIButton}
        onAIClick={() => setShowAIRecommendModal(true)}
      />

      <div className='flex w-full min-h-screen md:min-h-auto'>
        <div className='relative min-w-0 flex-1 transition-all duration-300'>
          <div className='hidden md:block fixed inset-x-0 top-0 z-999 pointer-events-none'>
            <div className='relative h-20 w-full'>
              <form
                onSubmit={handleDesktopSearch}
                className='pointer-events-auto absolute left-1/2 top-4 w-[min(40rem,42vw)] -translate-x-1/2'
              >
                <div className='group relative h-12 overflow-hidden rounded-full border border-white/10 bg-black/40 shadow-2xl shadow-black/20 backdrop-blur-[18px] transition-all duration-300 hover:bg-black/50 focus-within:border-white/25 focus-within:bg-black/50'>
                  <input
                    type='text'
                    value={desktopSearchQuery}
                    onChange={(event) =>
                      setDesktopSearchQuery(event.target.value)
                    }
                    placeholder='搜索影片、剧集、综艺...'
                    className='h-full w-full bg-transparent py-3 pl-7 pr-14 text-sm font-medium text-white outline-none placeholder:text-white/55'
                    autoComplete='off'
                  />
                  <button
                    type='submit'
                    className='absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white/75 transition-all duration-200 hover:bg-white/10 hover:text-white'
                    aria-label='搜索'
                  >
                    <Search className='h-5 w-5' />
                  </button>
                </div>
              </form>

              <div
                id='nav-buttons'
                className='pointer-events-auto absolute right-6 top-4'
              >
                <div className='flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5 shadow-2xl shadow-black/20 backdrop-blur-[18px] [&>button]:!text-white/80 [&>div>button]:!text-white/80'>
                  {shouldShowAIButton && (
                    <button
                      onClick={() => setShowAIRecommendModal(true)}
                      className='relative flex h-10 w-10 items-center justify-center rounded-full p-2 text-white/80 transition-all duration-300 hover:bg-white/10 hover:text-cyan-300 group'
                      title='AI智能推荐'
                      aria-label='AI Recommend'
                    >
                      <svg
                        className='relative z-10 h-6 w-6 transition-transform duration-300 group-hover:scale-110'
                        viewBox='0 0 1024 1024'
                        fill='currentColor'
                      >
                        <path d='M683.7 922.7h-345c-73.5 0-133.3-59.8-133.3-133.3V459.8c0-73.5 59.8-133.3 133.3-133.3h345c73.5 0 133.3 59.8 133.3 133.3v329.6c0 73.5-59.8 133.3-133.3 133.3z m-345-506.9c-24.3 0-44.1 19.8-44.1 44.1v329.6c0 24.3 19.8 44.1 44.1 44.1h345c24.3 0 44.1-19.8 44.1-44.1V459.8c0-24.3-19.8-44.1-44.1-44.1h-345zM914.3 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-20 44.6-44.6 44.6zM111.7 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-19.9 44.6-44.6 44.6z' />
                        <path d='M511.2 415.8c-24.6 0-44.6-20-44.6-44.6V239.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6v131.9c0 24.6-20 44.6-44.6 44.6z' />
                        <path d='M511.2 276.6c-49.2 0-89.2-40-89.2-89.2s40-89.2 89.2-89.2 89.2 40 89.2 89.2-40 89.2-89.2 89.2z m0-89.2h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0z m0 0h0.2-0.2z m0 0h0.2-0.2z m0-0.1h0.2-0.2zM399 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9s50.9 22.8 50.9 50.9c0 28.1-22.8 50.9-50.9 50.9zM622.9 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9 28.1 0 50.9 22.8 50.9 50.9 0 28.1-22.8 50.9-50.9 50.9z' />
                      </svg>
                    </button>
                  )}
                  <ThemeToggle />
                  <UserMenu />
                </div>
              </div>
            </div>
          </div>

          <main
            className={`flex-1 md:min-h-0 mt-12 mb-24 md:mb-0 ${
              mainSpacingClass
            }`}
          >
            {children}
          </main>
        </div>
      </div>

      <ModernNav activePath={activePath} />

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
