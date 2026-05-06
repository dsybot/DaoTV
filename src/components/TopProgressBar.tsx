'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import RouteLoadingShell from './RouteLoadingShell';

export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const isNavigatingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failSafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const clearTimers = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (failSafeTimeoutRef.current) {
      clearTimeout(failSafeTimeoutRef.current);
      failSafeTimeoutRef.current = null;
    }
  };

  const start = () => {
    clearTimers();
    isNavigatingRef.current = true;
    setVisible(true);
    setProgress(8);
    setShowOverlay(true);
    failSafeTimeoutRef.current = setTimeout(() => {
      if (isNavigatingRef.current) {
        done();
      }
    }, 15000);

    intervalRef.current = setInterval(() => {
      setProgress((current) => {
        if (current < 35) return current + 8;
        if (current < 70) return current + 4;
        if (current < 88) return current + 1.5;
        return current;
      });
    }, 180);
  };

  const done = () => {
    clearTimers();
    setProgress(100);
    setShowOverlay(false);
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
      isNavigatingRef.current = false;
    }, 220);
  };

  useEffect(() => {
    const mutableRouter = router as any;
    const originalPush = mutableRouter.push;
    const originalReplace = mutableRouter.replace;
    const originalBack = mutableRouter.back;
    const originalForward = mutableRouter.forward;

    const shouldStartForUrl = (targetUrl: unknown) => {
      if (typeof window === 'undefined' || typeof targetUrl !== 'string') {
        return true;
      }

      try {
        const target = new URL(targetUrl, window.location.href);
        const currentPathname = window.location.pathname;
        const currentRoute = `${window.location.pathname}${window.location.search}`;
        const targetRoute = `${target.pathname}${target.search}`;
        return (
          currentPathname === '/play' ||
          currentPathname === '/live' ||
          targetRoute !== currentRoute
        );
      } catch {
        return true;
      }
    };

    mutableRouter.push = (...args: unknown[]) => {
      if (shouldStartForUrl(args[0])) start();
      return originalPush.apply(mutableRouter, args);
    };

    mutableRouter.replace = (...args: unknown[]) => {
      if (shouldStartForUrl(args[0])) start();
      return originalReplace.apply(mutableRouter, args);
    };

    mutableRouter.back = (...args: unknown[]) => {
      start();
      return originalBack.apply(mutableRouter, args);
    };

    mutableRouter.forward = (...args: unknown[]) => {
      start();
      return originalForward.apply(mutableRouter, args);
    };

    const handleAnchorClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor?.href || anchor.target || anchor.download) return;

      try {
        const currentOrigin = window.location.origin;
        const targetUrl = new URL(anchor.href, currentOrigin);
        const currentRoute = `${window.location.pathname}${window.location.search}`;
        const targetRoute = `${targetUrl.pathname}${targetUrl.search}`;
        if (
          targetUrl.origin === currentOrigin &&
          targetUrl.href !== window.location.href &&
          targetRoute !== currentRoute
        ) {
          start();
        }
      } catch {
        // Ignore malformed href values.
      }
    };

    const handlePopState = () => start();

    document.addEventListener('click', handleAnchorClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      mutableRouter.push = originalPush;
      mutableRouter.replace = originalReplace;
      mutableRouter.back = originalBack;
      mutableRouter.forward = originalForward;
      document.removeEventListener('click', handleAnchorClick, true);
      window.removeEventListener('popstate', handlePopState);
      clearTimers();
    };
  }, [router]);

  useEffect(() => {
    if (isNavigatingRef.current) {
      done();
    }
  }, [pathname, searchParams]);

  if (!visible && progress === 0 && !showOverlay) return null;

  return (
    <>
      {showOverlay && <RouteLoadingShell overlay />}
      <div
        className='fixed left-0 right-0 top-0 z-9999 h-[2px] bg-transparent pointer-events-none'
        aria-hidden='true'
      >
        <div
          className='h-full bg-linear-to-r from-cyan-400 via-emerald-400 to-lime-300 shadow-[0_0_12px_rgba(45,212,191,0.65)] transition-[width,opacity] duration-200 ease-out'
          style={{
            width: `${progress}%`,
            opacity: visible ? 1 : 0,
          }}
        />
      </div>
    </>
  );
}
