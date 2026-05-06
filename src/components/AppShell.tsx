'use client';

import { Bot, ExternalLink, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useMemo, useState, useSyncExternalStore } from 'react';

import { isAIRecommendFeatureDisabled } from '@/lib/ai-recommend.client';

import AIRecommendModal from './AIRecommendModal';
import MobileHeader from './MobileHeader';
import ModernNav from './ModernNav';
import SearchSuggestions from './SearchSuggestions';
import { UserMenu } from './UserMenu';

interface AppShellProps {
  children: ReactNode;
}

interface RuntimeConfigWithAI {
  AI_RECOMMEND_ENABLED?: boolean;
  [key: string]: unknown;
}

type RuntimeWindow = Window & {
  RUNTIME_CONFIG?: RuntimeConfigWithAI;
};

const STANDALONE_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/oidc-register',
  '/warning',
  '/source-test',
  '/watch-room/screen',
];

function isStandaloneRoute(pathname: string) {
  return STANDALONE_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function getActivePath(
  pathname: string,
  searchParams: { get(name: string): string | null },
) {
  if (pathname === '/') return '/';
  if (pathname.startsWith('/admin')) return '/admin';
  if (pathname.startsWith('/detail')) return '/detail';
  if (pathname.startsWith('/douban')) {
    return `/douban?type=${searchParams.get('type') || 'movie'}`;
  }
  if (pathname.startsWith('/emby')) return '/emby';
  if (pathname.startsWith('/live')) return '/live';
  if (pathname.startsWith('/play-stats')) return '/play-stats';
  if (pathname.startsWith('/play')) return '/play';
  if (pathname.startsWith('/release-calendar')) return '/release-calendar';
  if (pathname.startsWith('/search')) return '/search';
  if (pathname.startsWith('/shortdrama')) return '/shortdrama';
  if (pathname.startsWith('/source-browser')) return '/source-browser';
  if (pathname.startsWith('/tvbox')) return '/tvbox';
  if (pathname.startsWith('/watch-room')) return '/watch-room';
  return pathname;
}

function getAIEnabledSnapshot() {
  return !isAIRecommendFeatureDisabled();
}

function getServerAIEnabledSnapshot() {
  return false;
}

function applyRuntimeAIEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;

  const runtimeWindow = window as RuntimeWindow;
  const nextConfig = {
    ...runtimeWindow.RUNTIME_CONFIG,
    AI_RECOMMEND_ENABLED: enabled,
  };
  runtimeWindow.RUNTIME_CONFIG = nextConfig;
  window.dispatchEvent(
    new CustomEvent('runtimeConfigUpdated', { detail: nextConfig }),
  );
}

async function refreshAIEnabledFromServer() {
  try {
    const response = await fetch('/api/admin/ai-recommend', {
      cache: 'no-store',
    });
    if (!response.ok) return;

    const data = (await response.json()) as { enabled?: unknown };
    applyRuntimeAIEnabled(data.enabled !== false);
  } catch {
    // Keep the current runtime value if the admin config endpoint is unavailable.
  }
}

function subscribeAIEnabled(onStoreChange: () => void) {
  const handleAdminConfigUpdated = () => {
    void refreshAIEnabledFromServer();
  };

  window.addEventListener('runtimeConfigUpdated', onStoreChange);
  window.addEventListener('adminConfigUpdated', handleAdminConfigUpdated);

  return () => {
    window.removeEventListener('runtimeConfigUpdated', onStoreChange);
    window.removeEventListener('adminConfigUpdated', handleAdminConfigUpdated);
  };
}

function startRouteProgress() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('dao-route-progress-start'));
}

function DesktopSearchControls({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [desktopSearchQuery, setDesktopSearchQuery] = useState(initialQuery);
  const [showDesktopSuggestions, setShowDesktopSuggestions] = useState(false);

  const navigateToSearch = (href: string) => {
    startRouteProgress();
    router.push(href);
  };

  const handleDesktopSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = desktopSearchQuery.trim().replace(/\s+/g, ' ');

    if (!trimmed) {
      navigateToSearch('/search');
      return;
    }

    setDesktopSearchQuery(trimmed);
    setShowDesktopSuggestions(false);
    navigateToSearch(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleDesktopInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDesktopSearchQuery(event.target.value);
    setShowDesktopSuggestions(true);
  };

  const handleDesktopSuggestionSelect = (suggestion: string) => {
    const trimmed = suggestion.trim().replace(/\s+/g, ' ');
    setDesktopSearchQuery(trimmed);
    setShowDesktopSuggestions(false);
    navigateToSearch(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleDesktopSearchMore = () => {
    const trimmed = desktopSearchQuery.trim().replace(/\s+/g, ' ');
    setShowDesktopSuggestions(false);
    navigateToSearch(
      trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search',
    );
  };

  return (
    <form
      onSubmit={handleDesktopSearch}
      className='dao-desktop-search pointer-events-auto absolute top-4 flex w-[min(44rem,46vw)] -translate-x-1/2 items-start gap-2'
    >
      <div className='group relative h-12 flex-1 rounded-full border border-white/10 bg-black/40 shadow-2xl shadow-black/20 backdrop-blur-[18px] transition-all duration-300 hover:bg-black/50 focus-within:border-white/25 focus-within:bg-black/50'>
        <input
          type='text'
          value={desktopSearchQuery}
          onChange={handleDesktopInputChange}
          onFocus={() => setShowDesktopSuggestions(true)}
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
        <SearchSuggestions
          query={desktopSearchQuery}
          isVisible={showDesktopSuggestions}
          onSelect={handleDesktopSuggestionSelect}
          onClose={() => setShowDesktopSuggestions(false)}
          onEnterKey={() => {
            const trimmed = desktopSearchQuery.trim().replace(/\s+/g, ' ');
            if (!trimmed) return;
            setDesktopSearchQuery(trimmed);
            setShowDesktopSuggestions(false);
            navigateToSearch(`/search?q=${encodeURIComponent(trimmed)}`);
          }}
        />
      </div>
      <button
        type='button'
        onClick={handleDesktopSearchMore}
        className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/75 shadow-2xl shadow-black/20 backdrop-blur-[18px] transition-all duration-200 hover:bg-black/50 hover:text-white'
        title='搜索更多'
        aria-label='搜索更多'
      >
        <ExternalLink className='h-5 w-5' />
      </button>
    </form>
  );
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showAIRecommendModal, setShowAIRecommendModal] = useState(false);
  const aiEnabled = useSyncExternalStore(
    subscribeAIEnabled,
    getAIEnabledSnapshot,
    getServerAIEnabledSnapshot,
  );

  const activePath = useMemo(
    () => getActivePath(pathname, searchParams),
    [pathname, searchParams],
  );
  const isStandalone = isStandaloneRoute(pathname);
  const desktopSearchQuery =
    pathname === '/search' ? searchParams.get('q') || '' : '';
  const desktopSearchKey = `${pathname}:${desktopSearchQuery}`;

  const shouldShowAIButton = aiEnabled && activePath !== '/admin';
  const isHomePage = pathname === '/' && activePath === '/';
  const mainSpacingClass = isHomePage
    ? 'dao-home-main md:mt-0'
    : 'dao-content-main md:mt-24';

  if (isStandalone) {
    return <>{children}</>;
  }

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
              <DesktopSearchControls
                key={desktopSearchKey}
                initialQuery={desktopSearchQuery}
              />

              <div
                id='nav-buttons'
                className='pointer-events-auto absolute right-6 top-4'
              >
                <div className='flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5 shadow-2xl shadow-black/20 backdrop-blur-[18px] [&>button]:!text-white/80 [&>div>button]:!text-white/80'>
                  {shouldShowAIButton && (
                    <button
                      type='button'
                      onClick={() => setShowAIRecommendModal(true)}
                      className='relative flex h-10 w-10 items-center justify-center rounded-full p-2 text-white/80 transition-all duration-300 hover:bg-white/10 hover:text-cyan-300 group'
                      title='AI智能推荐'
                      aria-label='AI Recommend'
                    >
                      <Bot className='relative z-10 h-5 w-5 transition-transform duration-300 group-hover:scale-110' />
                    </button>
                  )}
                  <UserMenu />
                </div>
              </div>
            </div>
          </div>

          <main
            className={`flex-1 md:min-h-0 mt-12 mb-24 md:mb-0 ${mainSpacingClass}`}
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
}
