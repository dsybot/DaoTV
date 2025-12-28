/* eslint-disable no-console */
import * as cheerio from 'cheerio';
import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// URL 甯搁噺
const DOUBAN_WEB_BASE = 'https://movie.douban.com';

// Chrome/Mac 鐪熷疄 User-Agent
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  Referer: 'https://movie.douban.com/',
  'Sec-Ch-Ua':
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Cache-Control': 'no-cache',
};

// ============================================================================
// 鏁版嵁绫诲瀷瀹氫箟
// ============================================================================

interface ScrapedComment {
  id: string;
  created_at: string;
  content: string;
  useful_count: number;
  rating: { max: number; value: number; min: number } | null;
  author: {
    id: string;
    uid: string;
    name: string;
    avatar: string;
    alt: string;
  };
}

interface ScrapedRecommendation {
  id: string;
  title: string;
  images: { small: string; medium: string; large: string };
  alt: string;
}

interface ScrapedCelebrity {
  id: string;
  name: string;
  alt: string;
  category: string;
  role: string;
  avatars: { small: string; medium: string; large: string };
}

interface ScrapedFullData {
  // 鍩虹淇℃伅
  title: string;
  original_title: string;
  year: string;
  rating: { average: number; stars: string; count: number } | null;
  genres: string[];
  countries: string[];
  durations: string[];
  summary: string;
  poster: string;
  // 瀵屽獟浣撴暟鎹?  recommendations: ScrapedRecommendation[];
  hotComments: ScrapedComment[];
  directors: ScrapedCelebrity[];
  actors: ScrapedCelebrity[];
  // 鍏冩暟鎹?  scrapedAt: number;
}

// ============================================================================
// 鏍稿績鐖櫕鍑芥暟
// ============================================================================

/**
 * 浠庤眴鐡ｇ綉椤典竴娆℃€ф姄鍙栨墍鏈夋暟鎹? * 鍖呮嫭锛氬熀纭€淇℃伅銆佹帹鑽愬奖鐗囥€佺儹闂ㄧ煭璇勩€佸婕?婕斿憳
 */
async function _scrapeDoubanData(subjectId: string): Promise<ScrapedFullData> {
  console.log(`[Douban Scraper] 寮€濮嬬埇鍙? ${subjectId}`);
  const startTime = Date.now();

  const url = `${DOUBAN_WEB_BASE}/subject/${subjectId}/`;

  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`鐖彇澶辫触: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // ========== 鍩虹淇℃伅 ==========
  const title =
    $('span[property="v:itemreviewed"]').text().trim() ||
    $('title').text().split(' ')[0];
  const originalTitle =
    $('span.pl:contains("鍙堝悕")').next().text().trim() || '';
  const year = $('span.year').text().replace(/[()]/g, '').trim() || '';

  // 璇勫垎
  const ratingAvg = parseFloat($('strong.rating_num').text().trim()) || 0;
  const ratingStars = $('span.rating_per').first().text().trim() || '';
  const ratingCount =
    parseInt($('span[property="v:votes"]').text().trim()) || 0;

  // 绫诲瀷銆佸湴鍖恒€佹椂闀?  const genres: string[] = [];
  $('span[property="v:genre"]').each((_, el) => {
    genres.push($(el).text().trim());
  });

  const countries: string[] = [];
  const countryText = $('span.pl:contains("鍒剁墖鍥藉")').parent().text();
  const countryMatch = countryText.match(/鍒剁墖鍥藉\/鍦板尯:\s*(.+)/);
  if (countryMatch) {
    countries.push(...countryMatch[1].split('/').map((s) => s.trim()));
  }

  const durations: string[] = [];
  $('span[property="v:runtime"]').each((_, el) => {
    durations.push($(el).text().trim());
  });

  // 绠€浠?(瀹屾暣鐗?
  let summary = '';
  const $hiddenSummary = $('span.all.hidden');
  if ($hiddenSummary.length) {
    summary = $hiddenSummary.text().trim();
  } else {
    summary = $('span[property="v:summary"]').text().trim();
  }
  summary = summary.replace(/\s+/g, ' ').trim();

  // 娴锋姤
  const poster = $('#mainpic img').attr('src') || '';

  // ========== 鎺ㄨ崘褰辩墖 ==========
  const recommendations: ScrapedRecommendation[] = [];
  $('#recommendations .recommendations-bd dl').each((_, element) => {
    const $item = $(element);
    const $link = $item.find('dd a');
    const $img = $item.find('dt img');

    const href = $link.attr('href') || '';
    const idMatch = href.match(/subject\/(\d+)/);
    const recId = idMatch ? idMatch[1] : '';
    const recTitle = $link.text().trim();
    const recPoster = $img.attr('src') || '';

    if (recId && recTitle) {
      recommendations.push({
        id: recId,
        title: recTitle,
        images: {
          small: recPoster,
          medium: recPoster.replace('s_ratio', 'm_ratio'),
          large: recPoster.replace('s_ratio', 'l_ratio'),
        },
        alt: href,
      });
    }
  });

  // ========== 鐑棬鐭瘎 ==========
  const hotComments: ScrapedComment[] = [];
  $('#hot-comments .comment-item').each((_, element) => {
    const $item = $(element);

    const $avatar = $item.find('.avatar a img');
    const $userLink = $item.find('.comment-info a');
    const avatarUrl = $avatar.attr('src') || '';
    const userName = $userLink.text().trim();
    const userLink = $userLink.attr('href') || '';

    const ratingClass = $item.find('.comment-info .rating').attr('class') || '';
    const ratingMatch = ratingClass.match(/allstar(\d+)/);
    const ratingValue = ratingMatch ? parseInt(ratingMatch[1]) / 10 : 0;

    const content = $item.find('.short').text().trim();
    const time =
      $item.find('.comment-time').attr('title') ||
      $item.find('.comment-time').text().trim();
    const usefulCount = parseInt($item.find('.vote-count').text().trim()) || 0;
    const commentId =
      $item.attr('data-cid') || `hot_${Date.now()}_${Math.random()}`;

    if (content) {
      hotComments.push({
        id: commentId,
        created_at: time,
        content,
        useful_count: usefulCount,
        rating: ratingValue > 0 ? { max: 5, value: ratingValue, min: 0 } : null,
        author: {
          id: userLink.split('/').filter(Boolean).pop() || '',
          uid: userName,
          name: userName,
          avatar: avatarUrl
            .replace('/u/pido/', '/u/')
            .replace('s_ratio', 'm_ratio'),
          alt: userLink,
        },
      });
    }
  });

  // ========== 瀵兼紨/婕斿憳 (浠庝富椤佃В鏋? ==========
  const directors: ScrapedCelebrity[] = [];
  const actors: ScrapedCelebrity[] = [];

  // 瀵兼紨
  $('a[rel="v:directedBy"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const idMatch = href.match(/celebrity\/(\d+)/);
    const name = $el.text().trim();

    if (name) {
      directors.push({
        id: idMatch ? idMatch[1] : '',
        name,
        alt: href,
        category: '瀵兼紨',
        role: '瀵兼紨',
        avatars: { small: '', medium: '', large: '' },
      });
    }
  });

  // 婕斿憳
  $('a[rel="v:starring"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const idMatch = href.match(/celebrity\/(\d+)/);
    const name = $el.text().trim();

    if (name) {
      actors.push({
        id: idMatch ? idMatch[1] : '',
        name,
        alt: href,
        category: '婕斿憳',
        role: '',
        avatars: { small: '', medium: '', large: '' },
      });
    }
  });

  // 灏濊瘯浠?celebrities 鍖哄潡鑾峰彇澶村儚
  $('#celebrities .celebrity').each((_, element) => {
    const $item = $(element);
    const $link = $item.find('a.name');
    const $avatar = $item.find('.avatar');

    const href = $link.attr('href') || '';
    const idMatch = href.match(/celebrity\/(\d+)/);
    const celId = idMatch ? idMatch[1] : '';
    const name = $link.text().trim();
    const role = $item.find('.role').text().trim();

    // 鍙岄噸鍖归厤澶村儚 URL
    let avatarUrl = '';

    // 鏂规硶 1: CSS 鑳屾櫙鍥?    const avatarStyle = $avatar.attr('style') || '';
    const bgMatch = avatarStyle.match(/background-image:\s*url\(([^)]+)\)/);
    if (bgMatch) {
      avatarUrl = bgMatch[1].replace(/['"]|&quot;/g, '');
    }

    // 鏂规硶 2: IMG 鏍囩 (fallback)
    if (!avatarUrl) {
      const $img = $avatar.find('img');
      avatarUrl = $img.attr('src') || $img.attr('data-src') || '';
    }

    // 鏂规硶 3: 鐩存帴浠?a 鏍囩涓嬬殑 img
    if (!avatarUrl) {
      const $directImg = $item.find('a img.avatar, a img[class*="avatar"]');
      avatarUrl = $directImg.attr('src') || '';
    }

    // 楂樻竻鍥炬浛鎹? /s/ -> /l/, /m/ -> /l/
    avatarUrl = avatarUrl
      .replace(/\/s\//, '/l/')
      .replace(/\/m\//, '/l/')
      .replace('/s_ratio/', '/l_ratio/')
      .replace('/m_ratio/', '/l_ratio/')
      .replace('/small/', '/large/')
      .replace('/medium/', '/large/');

    if (name) {
      const isDirector = role.includes('瀵兼紨');
      const target = isDirector ? directors : actors;

      // 鏇存柊鎴栨坊鍔?      const existing = target.find((c) => c.id === celId || c.name === name);
      if (existing) {
        // 鍙湁褰撴柊澶村儚鏈夋晥鏃舵墠鏇存柊
        if (avatarUrl) {
          existing.avatars = {
            small: avatarUrl
              .replace('/l/', '/s/')
              .replace('/l_ratio/', '/s_ratio/'),
            medium: avatarUrl
              .replace('/l/', '/m/')
              .replace('/l_ratio/', '/m_ratio/'),
            large: avatarUrl,
          };
        }
        if (role) existing.role = role;
      } else {
        target.push({
          id: celId || `cel_${Date.now()}_${Math.random()}`,
          name,
          alt: href,
          category: isDirector ? '瀵兼紨' : '婕斿憳',
          role,
          avatars: {
            small: avatarUrl
              ? avatarUrl
                  .replace('/l/', '/s/')
                  .replace('/l_ratio/', '/s_ratio/')
              : '',
            medium: avatarUrl
              ? avatarUrl
                  .replace('/l/', '/m/')
                  .replace('/l_ratio/', '/m_ratio/')
              : '',
            large: avatarUrl || '',
          },
        });
      }
    }
  });

  const elapsed = Date.now() - startTime;
  console.log(`[Douban Scraper] 瀹屾垚: ${subjectId} (${elapsed}ms)`);

  return {
    title,
    original_title: originalTitle,
    year,
    rating:
      ratingAvg > 0
        ? { average: ratingAvg, stars: ratingStars, count: ratingCount }
        : null,
    genres,
    countries,
    durations,
    summary,
    poster,
    recommendations,
    hotComments,
    directors,
    actors,
    scrapedAt: Date.now(),
  };
}

// ============================================================================
// 鏈嶅姟绔紦瀛樺皝瑁?(24灏忔椂)
// ============================================================================

/**
 * 浣跨敤 Next.js unstable_cache 鍖呰９鐖櫕鍑芥暟
 * - 绗竴娆¤闂細瑙﹀彂鐖櫕
 * - 鍚庣画璇锋眰鐩存帴璇诲彇缂撳瓨
 * - 24灏忔椂鍚庤嚜鍔ㄩ噸鏂伴獙璇? */
const scrapeDoubanData = unstable_cache(_scrapeDoubanData, ['douban-scraper'], {
  revalidate: 86400, // 24灏忔椂缂撳瓨
  tags: ['douban'],
});

// 鐙珛鐨勮瘎璁虹埇鍙栵紙甯︾紦瀛橈級
const scrapeComments = unstable_cache(
  async (
    subjectId: string,
    start = 0,
    count = 10,
  ): Promise<{ comments: ScrapedComment[]; total: number }> => {
    const url = `${DOUBAN_WEB_BASE}/subject/${subjectId}/comments?start=${start}&limit=${count}&status=P&sort=new_score`;

    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`鐖彇鐭瘎澶辫触: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const comments: ScrapedComment[] = [];

    $('.comment-item').each((_, element) => {
      const $item = $(element);

      const $avatar = $item.find('.avatar a img');
      const $userLink = $item.find('.comment-info a');
      const avatarUrl = $avatar.attr('src') || '';
      const userName = $userLink.text().trim();
      const userLink = $userLink.attr('href') || '';

      const ratingClass =
        $item.find('.comment-info .rating').attr('class') || '';
      const ratingMatch = ratingClass.match(/allstar(\d+)/);
      const ratingValue = ratingMatch ? parseInt(ratingMatch[1]) / 10 : 0;

      const content = $item.find('.short').text().trim();
      const time =
        $item.find('.comment-time').attr('title') ||
        $item.find('.comment-time').text().trim();
      const usefulCount =
        parseInt($item.find('.vote-count').text().trim()) || 0;
      const commentId =
        $item.attr('data-cid') || `scrape_${Date.now()}_${Math.random()}`;

      if (content) {
        comments.push({
          id: commentId,
          created_at: time,
          content,
          useful_count: usefulCount,
          rating:
            ratingValue > 0 ? { max: 5, value: ratingValue, min: 0 } : null,
          author: {
            id: userLink.split('/').filter(Boolean).pop() || '',
            uid: userName,
            name: userName,
            avatar: avatarUrl
              .replace('/u/pido/', '/u/')
              .replace('s_ratio', 'm_ratio'),
            alt: userLink,
          },
        });
      }
    });

    const totalText = $('.mod-hd h2 span').text();
    const totalMatch = totalText.match(/鍏ㄩ儴\s*(\d+)\s*鏉?);
    const total = totalMatch ? parseInt(totalMatch[1]) : comments.length;

    return { comments, total };
  },
  ['douban-comments'],
  { revalidate: 3600, tags: ['douban'] },
);

// ============================================================================
// 璺敱澶勭悊
// ============================================================================

function needsScraping(
  path: string,
): 'full' | 'comments' | null {
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes('/comments') || lowerPath.includes('/reviews')) {
    return 'comments';
  }
  // 濡傛灉鍙槸 subject/{id}锛岃繑鍥炲畬鏁存暟鎹?  if (/movie\/subject\/\d+\/?$/.test(path)) {
    return 'full';
  }
  return null;
}

function extractSubjectId(path: string): string | null {
  const match = path.match(/subject\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * GET /api/douban/proxy
 * 璞嗙摚鏁版嵁浠ｇ悊 (鏅鸿兘鐖櫕 + 24灏忔椂缂撳瓨)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const start = parseInt(searchParams.get('start') || '0');
    const count = parseInt(searchParams.get('count') || '10');

    if (!path) {
      return NextResponse.json(
        { error: '缂哄皯蹇呰鍙傛暟: path', code: 400 },
        { status: 400 },
      );
    }

    const scrapeType = needsScraping(path);
    const subjectId = extractSubjectId(path);

    // ========== 鐖櫕妯″紡 ==========
    if (scrapeType && subjectId) {
      console.log(`[Douban Proxy] 鐖櫕妯″紡: ${scrapeType} for ${subjectId}`);

      let data: unknown;

      switch (scrapeType) {
        case 'full':
          data = await scrapeDoubanData(subjectId);
          break;
        case 'comments':
          data = await scrapeComments(subjectId, start, count);
          break;
      }

      return NextResponse.json(data, {
        headers: {
          'Cache-Control':
            'public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200',
          'X-Data-Source': 'scraper-cached',
        },
      });
    }

    // 濡傛灉涓嶆槸鏀寔鐨勮矾寰勶紝杩斿洖閿欒
    return NextResponse.json(
      {
        error: '涓嶆敮鎸佺殑璺緞',
        message: '褰撳墠浠呮敮鎸? movie/subject/{id} 鍜?movie/subject/{id}/comments',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('[Douban Proxy] Error:', error);

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: '璇锋眰瓒呮椂', code: 504 },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error: '浠ｇ悊璇锋眰澶辫触',
        details: error instanceof Error ? error.message : '鏈煡閿欒',
      },
      { status: 500 },
    );
  }
}
