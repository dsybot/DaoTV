'use client';

import { ClientCache } from './client-cache';

export interface BangumiCalendarData {
  weekday: {
    en: string;
    cn?: string;
    ja?: string;
    id?: number;
  };
  items: {
    id: number;
    name: string;
    name_cn?: string;
    rating?: {
      total?: number;
      count?: Record<string, number>;
      score?: number;
    };
    air_date?: string;
    air_weekday?: number;
    rank?: number;
    images?: {
      large?: string;
      common?: string;
      medium?: string;
      small?: string;
      grid?: string;
    };
    collection?: {
      doing?: number;
    };
    url?: string;
    type?: number;
    summary?: string;
  }[];
}

function buildBangumiProxyUrl(path: string): string {
  const params = new URLSearchParams({ path });
  if (typeof window !== 'undefined') {
    const apiType = localStorage.getItem('bangumiApiType');
    const apiProxy = localStorage.getItem('bangumiApiProxy');
    if (apiType && apiType !== 'server') params.set('apiType', apiType);
    if (apiProxy) params.set('apiProxy', apiProxy);
  }
  return `/api/proxy/bangumi?${params.toString()}`;
}

export async function GetBangumiCalendarData(): Promise<BangumiCalendarData[]> {
  const cacheKey = 'bangumi-calendar';
  try {
    const cached = await ClientCache.get(cacheKey);
    if (cached) return cached;
  } catch {}

  try {
    const response = await fetch(buildBangumiProxyUrl('calendar'));
    if (!response.ok) {
      throw new Error(`Bangumi proxy returned ${response.status}`);
    }
    const data = await response.json();

    if (Array.isArray(data)) {
      try {
        await ClientCache.set(cacheKey, data, 2 * 60 * 60);
      } catch {}
      return data;
    }

    console.warn(
      '[Bangumi] Calendar API returned non-array data, attempting fallback to cmliussss proxy',
    );
    throw new Error('Invalid calendar data format');
  } catch (error) {
    if (typeof window !== 'undefined') {
      const currentApiType = localStorage.getItem('bangumiApiType');
      if (currentApiType !== 'cmliussss') {
        console.warn(
          '[Bangumi] Falling back to cmliussss proxy due to API error:',
          error,
        );
        localStorage.setItem('bangumiApiType', 'cmliussss');

        try {
          const fallbackResponse = await fetch(buildBangumiProxyUrl('calendar'));
          const fallbackData = await fallbackResponse.json();

          if (Array.isArray(fallbackData)) {
            console.log(
              '[Bangumi] Fallback to cmliussss proxy succeeded, persisting this choice',
            );
            try {
              await ClientCache.set(cacheKey, fallbackData, 2 * 60 * 60);
            } catch {}
            return fallbackData;
          }
        } catch (fallbackError) {
          console.error(
            '[Bangumi] Fallback to cmliussss also failed:',
            fallbackError,
          );
          if (currentApiType) {
            localStorage.setItem('bangumiApiType', currentApiType);
          } else {
            localStorage.removeItem('bangumiApiType');
          }
        }
      }
    }

    console.error(
      '[Bangumi] All attempts to fetch calendar data failed, returning empty array',
    );
    return [];
  }
}

export async function fetchBangumiSubject(id: number): Promise<{
  id: string;
  title: string;
  year: string;
  rate: string | null;
  genres: string[];
  directors: string[];
  cast: string[];
  plot_summary: string;
} | null> {
  const cacheKey = `bangumi-quick-info-${id}`;
  try {
    const cached = await ClientCache.get(cacheKey);
    if (cached) return cached;
  } catch {}

  try {
    const res = await fetch(buildBangumiProxyUrl(`v0/subjects/${id}`));
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.name) return null;

    const result = {
      id: String(id),
      title: data.name_cn || data.name || '',
      year: data.date?.slice(0, 4) || '',
      rate: data.rating?.score ? Number(data.rating.score).toFixed(1) : null,
      genres: (data.tags || [])
        .slice(0, 5)
        .map((t: { name?: string }) => t.name)
        .filter(Boolean),
      directors: [],
      cast: [],
      plot_summary: data.summary || '',
    };

    try {
      await ClientCache.set(cacheKey, result, 4 * 60 * 60);
    } catch {}
    return result;
  } catch {
    return null;
  }
}

export { buildBangumiProxyUrl };
