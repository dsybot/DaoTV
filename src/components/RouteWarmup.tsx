'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const DEFAULT_WARMUP_ROUTES = [
  '/douban?type=movie',
  '/douban?type=tv',
  '/shortdrama',
  '/source-browser',
  '/release-calendar',
];

const warmedRoutes = new Set<string>();

function shouldSkipWarmup() {
  if (typeof navigator === 'undefined') return true;
  if (!document.cookie.includes('user_auth=')) return true;

  const connection = (
    navigator as Navigator & {
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
      };
    }
  ).connection;

  return (
    connection?.saveData === true ||
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g'
  );
}

export default function RouteWarmup() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (shouldSkipWarmup()) return;

    let cancelled = false;
    const timeoutIds: Array<ReturnType<typeof setTimeout>> = [];

    const currentRoute = `${window.location.pathname}${window.location.search}`;
    const routes = DEFAULT_WARMUP_ROUTES.filter(
      (route) => route !== currentRoute && route !== pathname,
    );

    const warmRoute = (route: string) => {
      if (cancelled || warmedRoutes.has(route)) return;
      warmedRoutes.add(route);
      try {
        router.prefetch(route);
      } catch {
        warmedRoutes.delete(route);
      }
    };

    const idleWindow = window as IdleWindow;

    routes.forEach((route, index) => {
      const run = () => warmRoute(route);
      if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
        const idleId = idleWindow.requestIdleCallback(run, {
          timeout: 2500 + index * 700,
        });
        timeoutIds.push(
          setTimeout(() => idleWindow.cancelIdleCallback?.(idleId), 6000),
        );
      } else {
        timeoutIds.push(setTimeout(run, 900 + index * 900));
      }
    });

    return () => {
      cancelled = true;
      timeoutIds.forEach(clearTimeout);
    };
  }, [pathname, router]);

  return null;
}
