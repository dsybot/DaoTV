import { Suspense } from 'react';

import { getConfig } from '@/lib/config';

import { CinematicLoadingFallback } from '@/components/CinematicLoadingFallback';

import HomeClient from './HomeClient';

export default async function Home() {
  const config = await getConfig();
  const homePageConfig = config.HomePageConfig || {
    showHeroBanner: true,
    showContinueWatching: true,
    showUpcomingReleases: true,
    showHotMovies: true,
    showHotTvShows: true,
    showNewAnime: true,
    showHotVariety: true,
    showHotShortDramas: true,
  };

  return (
    <Suspense fallback={<CinematicLoadingFallback />}>
      <HomeClient initialConfig={homePageConfig} />
    </Suspense>
  );
}
