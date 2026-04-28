import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { encWbi, getBuvid3, getBilibiliHeaders } from '@/lib/bilibili-wbi';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('q') || searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: '搜索关键词不能为空' }, { status: 400 });
  }

  try {
    // 获取配置
    const config = await getConfig();
    const biliConfig = config.BilibiliConfig;

    // 检查是否启用
    if (!biliConfig?.enabled) {
      return NextResponse.json({
        success: false,
        error: 'B站搜索功能未启用'
      }, { status: 400 });
    }

    console.log(`🔍 B站搜索: "${keyword}"`);

    // 获取 buvid3
    const buvid3 = await getBuvid3();

    // 准备搜索参数
    const params = {
      keyword: keyword.trim(),
      page: 1,
      search_type: 'video'  // 搜索类型：video, media_bangumi, media_ft 等
    };

    // Wbi 签名
    const signedQuery = await encWbi(params);

    // 请求 B站搜索 API
    const response = await fetch(
      `https://api.bilibili.com/x/web-interface/wbi/search/all/v2?${signedQuery}`,
      {
        headers: getBilibiliHeaders(buvid3)
      }
    );

    if (!response.ok) {
      throw new Error(`B站 API 请求失败: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 0) {
      console.error('B站 API 返回错误:', data);
      return NextResponse.json({
        success: false,
        error: data.message || 'B站 API 返回错误'
      }, { status: 400 });
    }

    // 解析搜索结果
    const results = parseSearchResults(data.data);

    console.log(`✅ B站搜索完成: "${keyword}" - ${results.videos.length} 个视频, ${results.bangumi.length} 个番剧`);

    return NextResponse.json({
      success: true,
      keyword,
      videos: results.videos,
      bangumi: results.bangumi,
      total: results.total,
      source: 'bilibili'
    });

  } catch (error) {
    console.error('❌ B站搜索失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '搜索失败'
    }, { status: 500 });
  }
}

/**
 * 解析 B站搜索结果
 */
function parseSearchResults(data: any) {
  const videos: any[] = [];
  const bangumi: any[] = [];
  let total = 0;

  if (!data || !data.result) {
    return { videos, bangumi, total };
  }

  // 遍历搜索结果
  for (const item of data.result) {
    if (item.result_type === 'video' && item.data) {
      // 普通视频
      videos.push(...item.data.map((v: any) => ({
        type: 'video',
        bvid: v.bvid,
        aid: v.aid,
        title: v.title?.replace(/<[^>]*>/g, ''), // 移除 HTML 标签
        pic: v.pic?.startsWith('//') ? `https:${v.pic}` : v.pic,
        author: v.author,
        mid: v.mid,
        duration: v.duration,
        play: v.play,
        danmaku: v.video_review,
        pubdate: v.pubdate,
        description: v.description
      })));
    } else if (item.result_type === 'media_bangumi' && item.data) {
      // 番剧
      bangumi.push(...item.data.map((b: any) => ({
        type: 'bangumi',
        season_id: b.season_id,
        media_id: b.media_id,
        title: b.title?.replace(/<[^>]*>/g, ''),
        cover: b.cover?.startsWith('//') ? `https:${b.cover}` : b.cover,
        areas: b.areas,
        styles: b.styles,
        media_type: b.media_type,
        media_score: b.media_score,
        ep_size: b.ep_size,
        is_follow: b.is_follow,
        badges: b.badges
      })));
    }
  }

  total = videos.length + bangumi.length;

  return { videos, bangumi, total };
}
