/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';
import { getDetailFromApi, searchFromApi } from '@/lib/downstream';
import { rankSearchResults } from '@/lib/search-ranking';
import {
  buildResolutionFilterFromSearchParams,
  filterSearchResultsByResolution,
} from '@/lib/video-quality';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';

type TvboxRawFields = {
  remarks?: string;
  note?: string;
  remark?: string;
  year?: string | number;
  area?: string;
  actor?: string;
  director?: string;
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const sourceKey = searchParams.get('source');
    const ac = (searchParams.get('ac') || '').toLowerCase();
    const detailId = searchParams.get('ids') || searchParams.get('id') || searchParams.get('vod_id');
    const wantsDetail = ac === 'detail' || Boolean(detailId);
    const query = searchParams.get('wd');
    const filterParam = searchParams.get('filter') || 'on';
    const strictMode = searchParams.get('strict') === '1';
    const resolutionFilter = buildResolutionFilterFromSearchParams(searchParams);

    if (!sourceKey || (!query && !wantsDetail)) {
      return NextResponse.json(
        {
          code: 400,
          msg: '缺少必要参数: source 或 wd',
          list: [],
        },
        { status: 400 },
      );
    }

    const config = await getConfig();
    const shouldFilter = filterParam === 'on' || filterParam === 'enable';
    const targetSource = config.SourceConfig.find((s) => s.key === sourceKey);

    if (!targetSource) {
      return NextResponse.json(
        {
          code: 404,
          msg: `未找到视频源: ${sourceKey}`,
          list: [],
        },
        { status: 404 },
      );
    }

    if (targetSource.disabled) {
      return NextResponse.json(
        {
          code: 403,
          msg: `视频源已被禁用: ${sourceKey}`,
          list: [],
        },
        { status: 403 },
      );
    }

    if (wantsDetail) {
      if (!detailId) {
        return NextResponse.json({ code: 400, msg: '缺少详情参数: ids 或 id', list: [] }, { status: 400 });
      }
      try {
        const detail = await getDetailFromApi(
          { key: targetSource.key, name: targetSource.name, api: targetSource.api, detail: targetSource.detail },
          detailId,
        );
        const raw = detail as typeof detail & TvboxRawFields;
        const playUrl = formatTvboxPlayUrl(detail.episodes, detail.episodes_titles);
        return NextResponse.json({
          code: 1, msg: 'success', page: 1, pagecount: 1, limit: 1, total: 1,
          list: [{
            vod_id: detail.id,
            vod_name: detail.title,
            vod_pic: detail.poster,
            vod_remarks: String(raw.remarks || raw.note || raw.remark || '') || detail.resolution || '',
            vod_year: String(raw.year || ''),
            vod_area: String(raw.area || ''),
            vod_actor: String(raw.actor || ''),
            vod_director: String(raw.director || ''),
            vod_content: detail.desc || '',
            type_name: detail.type_name || '',
            vod_play_from: playUrl ? targetSource.name || 'LunaTV' : '',
            vod_play_url: playUrl,
          }],
        }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
      } catch (error) {
        return NextResponse.json({ code: 1, msg: error instanceof Error ? error.message : '详情获取失败', list: [] }, { status: 200 });
      }
    }

    const searchQuery = query || '';

    console.log(
      `[TVBox Search Proxy] source=${sourceKey}, query="${searchQuery}", filter=${filterParam}, strict=${strictMode}`,
    );

    let results = await searchFromApi(
      {
        key: targetSource.key,
        name: targetSource.name,
        api: targetSource.api,
        detail: targetSource.detail,
      },
      searchQuery,
    );

    console.log(
      `[TVBox Search Proxy] Fetched ${results.length} results from upstream`,
    );

    if (shouldFilter) {
      const beforeFilterCount = results.length;
      results = results.filter((result) => {
        const typeName = result.type_name || '';

        if (targetSource.is_adult) {
          return false;
        }

        if (yellowWords.some((word: string) => typeName.includes(word))) {
          return false;
        }

        return true;
      });

      console.log(
        `[TVBox Search Proxy] Adult filter: ${beforeFilterCount} → ${results.length} (filtered ${beforeFilterCount - results.length})`,
      );
    }

    if (results.length > 0) {
      results = rankSearchResults(results, searchQuery);
      console.log('[TVBox Search Proxy] Applied smart ranking');
    }

    // 🎬 分辨率过滤（resolution 已在 downstream 解析阶段装饰）
    if (resolutionFilter.minLevel > 0) {
      const beforeCount = results.length;
      results = filterSearchResultsByResolution(results, resolutionFilter);
      console.log(`[TVBox Search Proxy] Resolution filter (>=${resolutionFilter.minLevel}p): ${beforeCount} → ${results.length}`);
    }

    if (strictMode && results.length > 0) {
      const queryLower = searchQuery.toLowerCase().trim();
      const beforeStrictCount = results.length;

      results = results.filter((result) => {
        const title = (result.title || '').toLowerCase().trim();

        if (title === queryLower) return true;
        if (title.startsWith(queryLower)) return true;

        const regex = new RegExp(`\\b${queryLower}\\b`, 'i');
        if (regex.test(title)) return true;

        if (levenshteinDistance(title, queryLower) <= 2) return true;

        return false;
      });

      console.log(
        `[TVBox Search Proxy] Strict mode: ${beforeStrictCount} → ${results.length}`,
      );
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `[TVBox Search Proxy] Completed in ${processingTime}ms, returning ${results.length} results`,
    );

    const response = {
      code: 1,
      msg: 'success',
      page: 1,
      pagecount: 1,
      limit: results.length,
      total: results.length,
      list: results.map((r) => {
        const raw = r as TvboxRawFields;
        return {
          vod_id: r.id,
          vod_name: r.title,
          vod_pic: r.poster,
          vod_remarks: String(r.remarks || raw.note || raw.remark || '') || r.resolution || '',
          vod_year: raw.year || '',
          vod_area: raw.area || '',
          vod_actor: raw.actor || '',
          vod_director: raw.director || '',
          vod_content: r.desc || '',
          type_name: r.type_name || '',
          vod_play_from: r.episodes ? 'LunaTV' : '',
          vod_play_url: r.episodes ? formatTvboxPlayUrl(r.episodes, r.episodes_titles) : '',
        };
      }),
    };

    const cacheTime = await getCacheTime();
    return NextResponse.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'X-Processing-Time': `${processingTime}ms`,
        'X-Result-Count': `${results.length}`,
        'X-Filter-Applied': shouldFilter ? 'true' : 'false',
      },
    });
  } catch (error) {
    console.error('[TVBox Search Proxy] Error:', error);
    return NextResponse.json(
      {
        code: 500,
        msg: error instanceof Error ? error.message : '搜索失败',
        list: [],
      },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function formatTvboxPlayUrl(episodes: string[] | undefined, episodeTitles: string[] | undefined = []): string {
  if (!Array.isArray(episodes) || episodes.length === 0) return '';
  return episodes
    .map((url, index) => {
      const cleanUrl = typeof url === 'string' ? url.trim() : '';
      if (!cleanUrl) return '';
      const rawTitle = episodeTitles[index] || '';
      const title = rawTitle.replace(/[$#]/g, ' ').trim() || `第${index + 1}集`;
      return `${title}$${cleanUrl}`;
    })
    .filter(Boolean)
    .join('#');
}

function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[len1][len2];
}
