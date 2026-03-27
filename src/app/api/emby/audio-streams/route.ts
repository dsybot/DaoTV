/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { embyManager } from '@/lib/emby-manager';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get('itemId');
  const embyKey = searchParams.get('embyKey') || undefined;

  console.log('========== [/api/emby/audio-streams] API CALLED ==========', {
    itemId,
    embyKey,
  });

  if (!itemId) {
    return NextResponse.json({ error: '缺少 itemId 参数' }, { status: 400 });
  }

  try {
    const authCookie = getAuthInfoFromCookie(request);

    if (!authCookie?.username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const username = authCookie.username;

    const client = await embyManager.getClientForUser(username, embyKey);

    console.log(
      '========== [/api/emby/audio-streams] 开始获取音轨，itemId:',
      itemId,
    );
    const audioStreams = await client.getAudioStreams(itemId);
    console.log(
      '========== [/api/emby/audio-streams] 获取到音轨数据:',
      audioStreams,
    );

    return NextResponse.json({
      audioStreams: audioStreams.map((stream) => ({
        index: stream.index,
        display_title: stream.displayTitle,
        language: stream.language,
        codec: stream.codec,
        is_default: stream.isDefault,
      })),
    });
  } catch (error) {
    console.error('========== [/api/emby/audio-streams] 获取音轨失败:', error);
    return NextResponse.json(
      { error: '获取音轨失败: ' + (error as Error).message },
      { status: 500 },
    );
  }
}
