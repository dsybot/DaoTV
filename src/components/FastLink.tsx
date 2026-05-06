'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
  useCallback,
} from 'react';

type LinkPrefetch = boolean | 'auto' | null;

const intentPrefetchedHrefs = new Set<string>();

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

interface FastLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  /**
   * Force a full page refresh instead of SPA navigation.
   * Useful for pages that need to bypass React's rendering pipeline.
   */
  forceRefresh?: boolean;
  /**
   * Kept for backward compatibility with older callers.
   */
  useTransitionNav?: boolean;
  /**
   * Additional onClick handler
   */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  onFocus?: (e: FocusEvent<HTMLAnchorElement>) => void;
  onPointerEnter?: (e: PointerEvent<HTMLAnchorElement>) => void;
  onTouchStart?: (e: TouchEvent<HTMLAnchorElement>) => void;
  /**
   * Next.js route prefetching.
   * Defaults to false to avoid warming every visible dynamic route.
   */
  prefetch?: LinkPrefetch;
  /**
   * Also prefetch once the user shows intent to navigate.
   */
  intentPrefetch?: boolean;
  /**
   * Accessibility label
   */
  'aria-label'?: string;
  /**
   * Target attribute for opening in new tab
   */
  target?: string;
  /**
   * Rel attribute for security when using target="_blank"
   */
  rel?: string;
  title?: string;
  /**
   * Data attributes for styling
   */
  'data-active'?: boolean | string;
  /**
   * Style object
   */
  style?: CSSProperties;
}

/**
 * FastLink - High-performance navigation component
 *
 * Compatibility wrapper around Next Link.
 * `useTransitionNav` is intentionally ignored so navigation stays native.
 */
export function FastLink({
  href,
  children,
  className,
  forceRefresh = false,
  onClick,
  onFocus,
  onPointerEnter,
  onTouchStart,
  prefetch = false,
  intentPrefetch = true,
  'aria-label': ariaLabel,
  target,
  rel,
  title,
  'data-active': dataActive,
  style,
}: FastLinkProps) {
  const router = useRouter();

  const prefetchOnIntent = useCallback(() => {
    if (
      !intentPrefetch ||
      forceRefresh ||
      target === '_blank' ||
      isExternalHref(href) ||
      intentPrefetchedHrefs.has(href)
    ) {
      return;
    }

    intentPrefetchedHrefs.add(href);
    try {
      router.prefetch(href);
    } catch {
      intentPrefetchedHrefs.delete(href);
    }
  }, [forceRefresh, href, intentPrefetch, router, target]);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);

    if (e.defaultPrevented) {
      return;
    }

    const isModifiedClick =
      e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || target === '_blank';

    if (
      isModifiedClick ||
      !forceRefresh ||
      isExternalHref(href)
    ) {
      return;
    }

    e.preventDefault();
    window.location.assign(href);
  };

  const handleFocus = (e: FocusEvent<HTMLAnchorElement>) => {
    onFocus?.(e);
    if (!e.defaultPrevented) {
      prefetchOnIntent();
    }
  };

  const handlePointerEnter = (e: PointerEvent<HTMLAnchorElement>) => {
    onPointerEnter?.(e);
    if (!e.defaultPrevented) {
      prefetchOnIntent();
    }
  };

  const handleTouchStart = (e: TouchEvent<HTMLAnchorElement>) => {
    onTouchStart?.(e);
    if (!e.defaultPrevented) {
      prefetchOnIntent();
    }
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      onFocus={handleFocus}
      onPointerEnter={handlePointerEnter}
      onTouchStart={handleTouchStart}
      className={className}
      prefetch={prefetch}
      aria-label={ariaLabel}
      target={target}
      title={title}
      rel={target === '_blank' ? rel || 'noopener noreferrer' : rel}
      data-active={dataActive}
      style={style}
    >
      {children}
    </Link>
  );
}
