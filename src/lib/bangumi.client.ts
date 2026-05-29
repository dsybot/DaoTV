'use client';

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
  const response = await fetch(buildBangumiProxyUrl('calendar'));
  const data = await response.json();
  return data;
}

export { buildBangumiProxyUrl };
