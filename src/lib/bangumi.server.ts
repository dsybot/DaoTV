/* eslint-disable no-console */

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

export async function GetBangumiCalendarData(): Promise<BangumiCalendarData[]> {
  try {
    const response = await fetch('https://api.bgm.tv/calendar', {
      headers: {
        'User-Agent': 'LunaTV/1.0 (https://github.com/yourusername/LunaTV)',
        Accept: 'application/json',
      },
      next: {
        revalidate: 300,
      },
    });

    if (!response.ok) {
      throw new Error(`Bangumi API returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取Bangumi日历数据失败:', error);
    return [];
  }
}
