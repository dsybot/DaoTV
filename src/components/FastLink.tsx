'use client';

import Link from 'next/link';
import { type CSSProperties, type MouseEvent, type ReactNode } from 'react';

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
  'aria-label': ariaLabel,
  target,
  rel,
  title,
  'data-active': dataActive,
  style,
}: FastLinkProps) {
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
      href.startsWith('http://') ||
      href.startsWith('https://')
    ) {
      return;
    }

    e.preventDefault();
    window.location.assign(href);
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={className}
      prefetch={false}
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
