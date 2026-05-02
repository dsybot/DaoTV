'use client';

import { useEffect, useState } from 'react';

import { CinematicLoadingFallback } from './CinematicLoadingFallback';

export function MinimumTimeLoadingFallback() {
  const [shouldShow, setShouldShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldShow(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  if (!shouldShow) {
    return null;
  }

  return <CinematicLoadingFallback />;
}
