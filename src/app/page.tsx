import { Suspense } from 'react';

import { getConfig } from '@/lib/config';
import { defaultHomePageConfig } from '@/lib/homepage-config';

import { CinematicLoadingFallback } from '@/components/CinematicLoadingFallback';

import HomeClient from './HomeClient';

export default async function Home() {
  const config = await getConfig();
  const homePageConfig = {
    ...defaultHomePageConfig,
    ...(config.HomePageConfig || {}),
  };

  return (
    <Suspense fallback={<CinematicLoadingFallback />}>
      <HomeClient initialConfig={homePageConfig} />
    </Suspense>
  );
}
