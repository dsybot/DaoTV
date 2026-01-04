/**
 * EPG 诊断 API
 * 用于在浏览器中查看 EPG 匹配情况
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCachedLiveChannels } from '@/lib/live';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceKey = searchParams.get('source');

    if (!sourceKey) {
      return NextResponse.json({ error: '缺少 source 参数，用法: /api/live/epg-debug?source=你的直播源key' }, { status: 400 });
    }

    const channelData = await getCachedLiveChannels(sourceKey);

    if (!channelData) {
      return NextResponse.json({
        error: '未找到直播源数据',
        solution: '请先在后台管理页面添加并刷新直播源'
      }, { status: 404 });
    }

    // 统计信息
    const totalChannels = channelData.channels.length;
    const channelsWithTvgId = channelData.channels.filter(c => c.tvgId).length;
    const channelsWithoutTvgId = totalChannels - channelsWithTvgId;
    const epgChannelIds = Object.keys(channelData.epgs);
    const channelsWithEpg = epgChannelIds.length;

    // 前10个频道的详细信息
    const sampleChannels = channelData.channels.slice(0, 10).map(c => {
      const hasEpg = !!channelData.epgs[c.tvgId || c.name];
      const epgKey = c.tvgId || c.name;
      return {
        name: c.name,
        tvgId: c.tvgId || '(无 tvg-id)',
        epgKey: epgKey,
        hasEpg: hasEpg,
        programCount: hasEpg ? channelData.epgs[epgKey].length : 0,
        firstProgram: hasEpg ? channelData.epgs[epgKey][0] : null
      };
    });

    // EPG 前5个频道
    const epgSample = epgChannelIds.slice(0, 5).map(key => ({
      key,
      programCount: channelData.epgs[key].length,
      firstProgram: channelData.epgs[key][0]
    }));

    // 诊断问题
    const issues = [];

    if (!channelData.epgUrl) {
      issues.push({
        level: 'error',
        message: 'EPG URL 未配置',
        solution: '在后台管理页面的直播源配置中填写 EPG URL'
      });
    }

    if (channelsWithoutTvgId > 0) {
      issues.push({
        level: 'warning',
        message: `有 ${channelsWithoutTvgId} 个频道缺少 tvg-id`,
        solution: '系统会自动使用频道名称进行模糊匹配'
      });
    }

    if (channelData.epgUrl && channelsWithEpg === 0) {
      issues.push({
        level: 'error',
        message: 'EPG URL 已配置但没有匹配到任何频道',
        solution: '检查 EPG URL 是否正确，或查看服务器日志了解详情'
      });
    }

    const matchRate = totalChannels > 0 ? ((channelsWithEpg / totalChannels) * 100).toFixed(1) : '0';

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          epgUrl: channelData.epgUrl || '(未配置)',
          totalChannels,
          channelsWithTvgId,
          channelsWithoutTvgId,
          channelsWithEpg,
          matchRate: `${matchRate}%`,
        },
        issues,
        sampleChannels,
        epgSample,
        tip: '如果匹配率为 0%，请查看服务器控制台日志（运行 pnpm dev 的终端）'
      }
    });
  } catch (error) {
    console.error('[EPG Debug] 错误:', error);
    return NextResponse.json(
      {
        error: 'EPG 诊断失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
