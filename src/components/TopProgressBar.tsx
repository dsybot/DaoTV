'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const isNavigatingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failSafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
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
  }, []);

  const done = useCallback(() => {
    clearTimers();
    setProgress(100);
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
      isNavigatingRef.current = false;
    }, 220);
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    isNavigatingRef.current = true;
    setVisible(true);
    setProgress(8);
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
  }, [clearTimers, done]);

  useEffect(() => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const shouldStartForUrl = (targetUrl: string | URL | null | undefined) => {
      if (!targetUrl) return false;

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

    window.history.pushState = function pushState(data, unused, url) {
      if (shouldStartForUrl(url)) start();
      return originalPushState.call(this, data, unused, url);
    };

    window.history.replaceState = function replaceState(data, unused, url) {
      if (shouldStartForUrl(url)) start();
      return originalReplaceState.call(this, data, unused, url);
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
    const handleRouteProgressStart = () => start();

    document.addEventListener('click', handleAnchorClick, true);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener(
      'dao-route-progress-start',
      handleRouteProgressStart,
    );

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      document.removeEventListener('click', handleAnchorClick, true);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener(
        'dao-route-progress-start',
        handleRouteProgressStart,
      );
      clearTimers();
    };
  }, [clearTimers, start]);

  useEffect(() => {
    if (isNavigatingRef.current) {
      queueMicrotask(done);
    }
  }, [done, pathname, searchParams]);

  if (!visible && progress === 0) return null;

  return (
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
  );
}
