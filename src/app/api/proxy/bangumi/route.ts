import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';

/**
 * Bangumi API proxy route.
 * Solves client-side CORS issues when calling Bangumi directly.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json(
      { error: 'Missing path parameter' },
      { status: 400 },
    );
  }

  try {
    const apiUrl = `https://api.bgm.tv/${path}`;
    const cacheTime = await getCacheTime();

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'LunaTV/1.0 (https://github.com/yourusername/LunaTV)',
        Accept: 'application/json',
      },
      next: {
        revalidate: cacheTime,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Bangumi API returned ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
      },
    });
  } catch (error) {
    console.error('Bangumi API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Bangumi API' },
      { status: 500 },
    );
  }
}
