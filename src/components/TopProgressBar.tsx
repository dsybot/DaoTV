'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CinematicLoadingFallback } from './CinematicLoadingFallback';

const OVERLAY_SHOW_DELAY_MS = 120;
const OVERLAY_FADE_DURATION_MS = 220;
const NAVIGATION_FAILSAFE_MS = 15000;

export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const isNavigatingRef = useRef(false);
  const isOverlayMountedRef = useRef(false);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failSafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
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

  const unmountOverlay = useCallback(() => {
    isOverlayMountedRef.current = false;
    setMounted(false);
    isNavigatingRef.current = false;
  }, []);

  const done = useCallback(() => {
    clearTimers();

    if (!isOverlayMountedRef.current) {
      isNavigatingRef.current = false;
      return;
    }

    setActive(false);
    hideTimeoutRef.current = setTimeout(() => {
      unmountOverlay();
    }, OVERLAY_FADE_DURATION_MS);
  }, [clearTimers, unmountOverlay]);

  const start = useCallback(() => {
    clearTimers();
    isNavigatingRef.current = true;

    if (isOverlayMountedRef.current) {
      setActive(true);
    } else {
      showTimeoutRef.current = setTimeout(() => {
        isOverlayMountedRef.current = true;
        setMounted(true);

        requestAnimationFrame(() => {
          setActive(true);
        });
      }, OVERLAY_SHOW_DELAY_MS);
    }

    failSafeTimeoutRef.current = setTimeout(() => {
      if (isNavigatingRef.current) {
        done();
      }
    }, NAVIGATION_FAILSAFE_MS);
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

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        transitionDuration: `${OVERLAY_FADE_DURATION_MS}ms`,
      }}
      aria-hidden='true'
    >
      <CinematicLoadingFallback />
    </div>
  );
}
