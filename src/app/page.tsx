import { Suspense } from 'react';

import { getConfig } from '@/lib/config';
import { normalizeHomePageConfig } from '@/lib/homepage-config';

import { CinematicLoadingFallback } from '@/components/CinematicLoadingFallback';

import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const config = await getConfig();
  const homePageConfig = normalizeHomePageConfig(config.HomePageConfig);

  return (
    <Suspense
      fallback={
        <div className='fixed inset-0 z-50'>
          <CinematicLoadingFallback />
        </div>
      }
    >
      <HomeClient initialConfig={homePageConfig} />
    </Suspense>
  );
}
