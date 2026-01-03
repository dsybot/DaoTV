/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { ReleaseCalendarItem } from './types';

// ==================== Wikipedia 爬虫 ====================

/**
 * 爬取 Wikipedia 中国电影列表
 */
export async function scrapeWikipediaChineseMovies(): Promise<ReleaseCalendarItem[]> {
  const items: ReleaseCalendarItem[] = [];
  const now = Date.now();

  try {
    // Wikipedia 中国大陆电影列表
    const url = 'https://zh.wikipedia.org/zh-hans/2026%E5%B9%B4%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%86%E7%94%B5%E5%BD%B1%E4%BD%9C%E5%93%81%E5%88%97%E8%A1%A8';

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      console.error(`Wikipedia 请求失败: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // 解析表格：<table class="wikitable">
    const tableRegex = /<table class="wikitable"[^>]*>([\s\S]*?)<\/table>/g;
    const tables = [];
    let tableMatch;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      tables.push(tableMatch[1]);
    }

    for (const tableContent of tables) {
      // 解析表格行
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
      let rowMatch;
      let isHeaderRow = true;

      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        if (isHeaderRow) {
          isHeaderRow = false;
          continue; // 跳过表头
        }

        const row = rowMatch[1];

        // 提取单元格
        const cells: string[] = [];
        const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(row)) !== null) {
          cells.push(cellMatch[1]);
        }

        if (cells.length < 3) continue;

        // 解析数据：日期、片名、英文名、导演
        const dateCell = cells[0] || cells[1]; // 有些表格日期可能在不同列
        const titleCell = cells[1] || cells[2];
        const englishTitleCell = cells[2] || cells[3];
        const directorCell = cells[3] || cells[4];

        // 提取日期 (1月10日 或 2026-01-10)
        const dateMatch = dateCell.match(/(\d{1,2})月(\d{1,2})日|(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!dateMatch) continue;

        let releaseDate: string;
        if (dateMatch[3]) {
          // 格式：2026-01-10
          releaseDate = `${dateMatch[3]}-${dateMatch[4].padStart(2, '0')}-${dateMatch[5].padStart(2, '0')}`;
        } else {
          // 格式：1月10日
          const month = dateMatch[1].padStart(2, '0');
          const day = dateMatch[2].padStart(2, '0');
          releaseDate = `2026-${month}-${day}`;
        }

        // 只保留今天及以后的数据
        const today = new Date().toISOString().split('T')[0];
        if (releaseDate < today) continue;

        // 提取片名（去除 HTML 标签和链接）
        const title = cleanHtml(titleCell).trim();
        if (!title || title === '暂无' || title.length < 2) continue;

        // 提取英文名
        const englishTitle = cleanHtml(englishTitleCell).trim();

        // 提取导演
        const director = cleanHtml(directorCell).trim() || '未知';

        const item: ReleaseCalendarItem = {
          id: `wiki_cn_movie_${releaseDate}_${generateId(title)}`,
          title: title,
          type: 'movie',
          director: director,
          actors: '未知', // Wikipedia 表格可能没有演员信息
          region: '中国大陆',
          genre: '未知',
          releaseDate: releaseDate,
          source: 'wikipedia',
          createdAt: now,
          updatedAt: now,
        };

        items.push(item);
      }
    }

    console.log(`✅ Wikipedia 中国电影数据抓取成功: ${items.length} 部`);
    return items;
  } catch (error) {
    console.error('抓取 Wikipedia 中国电影失败:', error);
    return [];
  }
}

/**
 * 爬取 Wikipedia 中国电视剧列表
 */
export async function scrapeWikipediaChineseTVShows(): Promise<ReleaseCalendarItem[]> {
  const items: ReleaseCalendarItem[] = [];
  const now = Date.now();

  try {
    // Wikipedia 中国大陆电视剧列表
    const url = 'https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%86%E7%94%B5%E8%A7%86%E5%89%A7%E5%88%97%E8%A1%A8_(2026%E5%B9%B4)';

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      console.error(`Wikipedia 请求失败: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // 解析表格
    const tableRegex = /<table class="wikitable"[^>]*>([\s\S]*?)<\/table>/g;
    const tables = [];
    let tableMatch;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      tables.push(tableMatch[1]);
    }

    for (const tableContent of tables) {
      // 解析表格行
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
      let rowMatch;
      let isHeaderRow = true;

      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        if (isHeaderRow) {
          isHeaderRow = false;
          continue; // 跳过表头
        }

        const row = rowMatch[1];

        // 提取单元格
        const cells: string[] = [];
        const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(row)) !== null) {
          cells.push(cellMatch[1]);
        }

        if (cells.length < 3) continue;

        // 解析数据：日期、剧名、导演等
        const dateCell = cells[0] || '';
        const titleCell = cells[1] || '';
        const directorCell = cells[2] || '';

        // 提取日期
        const dateMatch = dateCell.match(/(\d{1,2})月(\d{1,2})日|(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!dateMatch) continue;

        let releaseDate: string;
        if (dateMatch[3]) {
          releaseDate = `${dateMatch[3]}-${dateMatch[4].padStart(2, '0')}-${dateMatch[5].padStart(2, '0')}`;
        } else {
          const month = dateMatch[1].padStart(2, '0');
          const day = dateMatch[2].padStart(2, '0');
          releaseDate = `2026-${month}-${day}`;
        }

        // 只保留今天及以后的数据
        const today = new Date().toISOString().split('T')[0];
        if (releaseDate < today) continue;

        // 提取剧名
        const title = cleanHtml(titleCell).trim();
        if (!title || title === '暂无' || title.length < 2) continue;

        // 提取导演
        const director = cleanHtml(directorCell).trim() || '未知';

        const item: ReleaseCalendarItem = {
          id: `wiki_cn_tv_${releaseDate}_${generateId(title)}`,
          title: title,
          type: 'tv',
          director: director,
          actors: '未知',
          region: '中国大陆',
          genre: '未知',
          releaseDate: releaseDate,
          source: 'wikipedia',
          createdAt: now,
          updatedAt: now,
        };

        items.push(item);
      }
    }

    console.log(`✅ Wikipedia 中国电视剧数据抓取成功: ${items.length} 部`);
    return items;
  } catch (error) {
    console.error('抓取 Wikipedia 中国电视剧失败:', error);
    return [];
  }
}

// ==================== 豆瓣搜索补充 ====================

/**
 * 使用豆瓣搜索补充电影/电视剧信息（海报、评分）
 */
export async function enrichWithDoubanSearch(item: ReleaseCalendarItem): Promise<ReleaseCalendarItem> {
  try {
    // 用片名搜索豆瓣
    const searchUrl = `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(item.title)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Referer': 'https://www.douban.com/',
      },
    });

    if (!response.ok) {
      console.warn(`豆瓣搜索失败: ${response.status} for ${item.title}`);
      return item;
    }

    const html = await response.text();

    // 解析 window.__DATA__
    const dataMatch = html.match(/window\.__DATA__\s*=\s*({.*?});/s);
    if (!dataMatch) {
      return item;
    }

    const searchData = JSON.parse(dataMatch[1]);
    const items = searchData.items || [];

    if (items.length === 0) {
      return item;
    }

    // 取第一个结果（通常是最相关的）
    const firstResult = items[0];

    // 补充信息
    const enrichedItem: ReleaseCalendarItem = {
      ...item,
      cover: firstResult.cover_url || item.cover,
      // 保留原有字段，添加豆瓣相关信息
    };

    // 如果有评分，可以添加到 description 或其他字段
    if (firstResult.rating?.value) {
      const rating = firstResult.rating.value.toFixed(1);
      enrichedItem.description = `豆瓣评分: ${rating}`;
    }

    // 从 abstract 提取更多信息（类型、演员等）
    if (firstResult.abstract) {
      const abstract = firstResult.abstract;

      // 提取类型
      const genreMatch = abstract.match(/类型:\s*([^\n]+)/);
      if (genreMatch && enrichedItem.genre === '未知') {
        enrichedItem.genre = genreMatch[1].trim();
      }

      // 提取主演
      const actorsMatch = abstract.match(/主演:\s*([^\n]+)/);
      if (actorsMatch && enrichedItem.actors === '未知') {
        enrichedItem.actors = actorsMatch[1].trim();
      }
    }

    // 从 abstract_2 提取演员信息
    if (firstResult.abstract_2 && enrichedItem.actors === '未知') {
      enrichedItem.actors = firstResult.abstract_2.trim();
    }

    console.log(`✅ 豆瓣补充成功: ${item.title} - 封面: ${enrichedItem.cover ? '有' : '无'}`);
    return enrichedItem;
  } catch (error) {
    console.error(`豆瓣搜索补充失败 for ${item.title}:`, error);
    return item;
  }
}

/**
 * 批量补充豆瓣信息（带延迟避免被封）
 */
export async function batchEnrichWithDouban(items: ReleaseCalendarItem[]): Promise<ReleaseCalendarItem[]> {
  const enrichedItems: ReleaseCalendarItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 添加随机延迟（500-1500ms）
    if (i > 0) {
      const delay = 500 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const enrichedItem = await enrichWithDoubanSearch(item);
    enrichedItems.push(enrichedItem);

    console.log(`进度: ${i + 1}/${items.length}`);
  }

  return enrichedItems;
}

// ==================== 工具函数 ====================

/**
 * 清理 HTML 标签
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<a[^>]*>([^<]*)<\/a>/g, '$1') // 移除链接，保留文本
    .replace(/<[^>]+>/g, '') // 移除所有 HTML 标签
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * 生成唯一ID
 */
function generateId(title: string): string {
  return title.replace(/[^\w\u4e00-\u9fa5]/g, '').substring(0, 20);
}
