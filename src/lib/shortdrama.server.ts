/* eslint-disable no-console */

import { getConfig } from './config';
import type { SearchResult, ShortDramaParseResult } from './types';
import { DEFAULT_USER_AGENT } from './user-agent';
import { cleanHtmlTags } from './utils';

const DEFAULT_SHORT_DRAMA_API = 'https://wwzy.tv/api.php/provide/vod';

type ShortDramaSource = {
  key: string;
  name: string;
  api: string;
};

type CmsDetailItem = {
  vod_id?: string | number;
  vod_name?: string;
  vod_pic?: string;
  vod_pic_slide?: string;
  vod_remarks?: string;
  vod_year?: string;
  vod_content?: string;
  vod_blurb?: string;
  vod_actor?: string;
  vod_score?: string | number;
  vod_douban_id?: number;
  type_name?: string;
  vod_play_url?: string;
};

function getShortDramaSources(
  config: Awaited<ReturnType<typeof getConfig>>,
): ShortDramaSource[] {
  const configuredSources = config.SourceConfig.filter(
    (source) => source.type === 'shortdrama' && !source.disabled,
  ).map((source) => ({
    key: source.key,
    name: source.name,
    api: source.api,
  }));

  if (configuredSources.length > 0) {
    return configuredSources;
  }

  const primaryApiUrl = config.ShortDramaConfig?.primaryApiUrl?.trim();
  return [
    {
      key: 'shortdrama-default',
      name: '默认短剧源',
      api: primaryApiUrl || DEFAULT_SHORT_DRAMA_API,
    },
  ];
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/^http:\/\//i, 'https://');
}

function parseEpisodesFromVodPlayUrl(vodPlayUrl?: string): {
  episodes: string[];
  titles: string[];
} {
  let episodes: string[] = [];
  let titles: string[] = [];

  if (!vodPlayUrl) {
    return { episodes, titles };
  }

  const playGroups = vodPlayUrl.split('$$$');
  for (const group of playGroups) {
    const groupEpisodes: string[] = [];
    const groupTitles: string[] = [];

    for (const item of group.split('#')) {
      const parts = item.split('$');
      if (parts.length !== 2) continue;

      const title = parts[0]?.trim();
      const rawUrl = parts[1]?.trim();
      if (!rawUrl) continue;

      groupTitles.push(title || `第${groupTitles.length + 1}集`);
      groupEpisodes.push(normalizeUrl(rawUrl));
    }

    if (groupEpisodes.length > episodes.length) {
      episodes = groupEpisodes;
      titles = groupTitles;
    }
  }

  return { episodes, titles };
}

async function fetchShortDramaDetailItem(
  api: string,
  id: number,
): Promise<CmsDetailItem | null> {
  const response = await fetch(
    `${api}?ac=detail&ids=${encodeURIComponent(String(id))}`,
    {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const list = Array.isArray(data?.list) ? data.list : [];
  return (list[0] as CmsDetailItem | undefined) || null;
}

export async function getShortDramaDetailFromSources(
  id: number,
): Promise<SearchResult | null> {
  const config = await getConfig();
  const sources = getShortDramaSources(config);

  let lastError: unknown = null;

  for (const source of sources) {
    try {
      const item = await fetchShortDramaDetailItem(source.api, id);
      if (!item) continue;

      const { episodes, titles } = parseEpisodesFromVodPlayUrl(
        item.vod_play_url,
      );
      if (episodes.length === 0) {
        continue;
      }

      return {
        id: String(id),
        title: item.vod_name || '',
        poster: item.vod_pic?.trim() || '',
        episodes,
        episodes_titles:
          titles.length > 0
            ? titles
            : Array.from(
                { length: episodes.length },
                (_, index) => `第${index + 1}集`,
              ),
        source: 'shortdrama',
        source_name: source.name,
        class: '',
        year:
          item.vod_year?.match(/\d{4}/)?.[0] ||
          new Date().getFullYear().toString(),
        desc: cleanHtmlTags(item.vod_content || item.vod_blurb || ''),
        type_name: item.type_name || '短剧',
        douban_id: item.vod_douban_id,
        remarks: item.vod_remarks,
        drama_name: item.vod_name || '',
        metadata: {
          author: item.vod_actor || '',
          backdrop: item.vod_pic_slide || item.vod_pic || '',
          vote_average: Number.parseFloat(String(item.vod_score || 0)) || 0,
        },
      };
    } catch (error) {
      lastError = error;
      console.error(
        `[ShortDrama Server] ${source.name} detail fetch failed:`,
        error,
      );
    }
  }

  if (lastError) {
    console.error(
      '[ShortDrama Server] All shortdrama sources failed for detail fetch',
    );
  }

  return null;
}

export async function parseShortDramaFromSources(
  id: number,
  episode: number,
  useProxy = true,
): Promise<ShortDramaParseResult> {
  const detail = await getShortDramaDetailFromSources(id);

  if (!detail || !detail.episodes || detail.episodes.length === 0) {
    return {
      code: 1,
      msg: '该短剧暂无可用播放源',
    };
  }

  const normalizedEpisodeIndex = Number.isFinite(episode) ? episode : 0;
  const safeIndex = Math.min(
    Math.max(normalizedEpisodeIndex, 0),
    detail.episodes.length - 1,
  );
  const originalUrl = normalizeUrl(detail.episodes[safeIndex] || '');

  if (!originalUrl) {
    return {
      code: 1,
      msg: '该集暂时无法播放，请稍后再试',
    };
  }

  const finalUrl = useProxy
    ? `/api/proxy/shortdrama?url=${encodeURIComponent(originalUrl)}`
    : originalUrl;
  const currentEpisode = safeIndex + 1;

  return {
    code: 0,
    data: {
      videoId: id,
      videoName: detail.title || '',
      currentEpisode,
      totalEpisodes: detail.episodes.length,
      parsedUrl: finalUrl,
      proxyUrl: useProxy ? finalUrl : '',
      cover: detail.poster || '',
      description: detail.desc || '',
      episode: {
        index: currentEpisode,
        label: detail.episodes_titles?.[safeIndex] || `第${currentEpisode}集`,
        parsedUrl: finalUrl,
        proxyUrl: useProxy ? finalUrl : undefined,
        title: detail.episodes_titles?.[safeIndex] || `第${currentEpisode}集`,
      },
    },
    metadata: detail.metadata,
  };
}

export async function parseShortDramaBatchFromSources(
  id: number,
  episodes: number[],
  useProxy = true,
): Promise<ShortDramaParseResult[]> {
  const detail = await getShortDramaDetailFromSources(id);
  if (!detail || !detail.episodes || detail.episodes.length === 0) {
    return [];
  }

  return episodes.map((episode) => {
    const normalizedEpisodeIndex = Number.isFinite(episode) ? episode : 0;
    const safeIndex = Math.min(
      Math.max(normalizedEpisodeIndex, 0),
      detail.episodes.length - 1,
    );
    const originalUrl = normalizeUrl(detail.episodes[safeIndex] || '');

    if (!originalUrl) {
      return {
        code: 1,
        msg: `第${episode}集暂时无法播放`,
      } satisfies ShortDramaParseResult;
    }

    const finalUrl = useProxy
      ? `/api/proxy/shortdrama?url=${encodeURIComponent(originalUrl)}`
      : originalUrl;
    const currentEpisode = safeIndex + 1;

    return {
      code: 0,
      data: {
        videoId: id,
        videoName: detail.title || '',
        currentEpisode,
        totalEpisodes: detail.episodes.length,
        parsedUrl: finalUrl,
        proxyUrl: useProxy ? finalUrl : '',
        cover: detail.poster || '',
        description: detail.desc || '',
        episode: {
          index: currentEpisode,
          label: detail.episodes_titles?.[safeIndex] || `第${currentEpisode}集`,
          parsedUrl: finalUrl,
          proxyUrl: useProxy ? finalUrl : undefined,
          title: detail.episodes_titles?.[safeIndex] || `第${currentEpisode}集`,
        },
      },
      metadata: detail.metadata,
    } satisfies ShortDramaParseResult;
  });
}

export async function parseShortDramaAllFromSources(
  id: number,
  useProxy = true,
): Promise<ShortDramaParseResult[]> {
  const detail = await getShortDramaDetailFromSources(id);
  if (!detail || !detail.episodes || detail.episodes.length === 0) {
    return [];
  }

  return detail.episodes.map((episodeUrl, index) => {
    const originalUrl = normalizeUrl(episodeUrl || '');
    const finalUrl = useProxy
      ? `/api/proxy/shortdrama?url=${encodeURIComponent(originalUrl)}`
      : originalUrl;
    const currentEpisode = index + 1;

    return {
      code: originalUrl ? 0 : 1,
      msg: originalUrl ? undefined : `第${currentEpisode}集暂时无法播放`,
      data: originalUrl
        ? {
            videoId: id,
            videoName: detail.title || '',
            currentEpisode,
            totalEpisodes: detail.episodes.length,
            parsedUrl: finalUrl,
            proxyUrl: useProxy ? finalUrl : '',
            cover: detail.poster || '',
            description: detail.desc || '',
            episode: {
              index: currentEpisode,
              label: detail.episodes_titles?.[index] || `第${currentEpisode}集`,
              parsedUrl: finalUrl,
              proxyUrl: useProxy ? finalUrl : undefined,
              title: detail.episodes_titles?.[index] || `第${currentEpisode}集`,
            },
          }
        : undefined,
      metadata: detail.metadata,
    } satisfies ShortDramaParseResult;
  });
}
