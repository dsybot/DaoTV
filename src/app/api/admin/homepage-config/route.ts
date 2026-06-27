/* eslint-disable no-console */

import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { defaultHomePageConfig } from '@/lib/homepage-config';

export const runtime = 'nodejs';

async function requireAdmin(username: string) {
  const config = await getConfig();

  if (username === process.env.USERNAME) {
    return config;
  }

  const user = config.UserConfig.Users.find((u) => u.username === username);
  if (!user || user.role !== 'admin' || user.banned) {
    return null;
  }

  return config;
}

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      { error: '不支持本地存储进行管理员配置' },
      { status: 400 },
    );
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const config = await requireAdmin(authInfo.username);
    if (!config) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    config.HomePageConfig = {
      ...defaultHomePageConfig,
      showHeroBanner: body.showHeroBanner ?? true,
      showContinueWatching: body.showContinueWatching ?? true,
      showUpcomingReleases: body.showUpcomingReleases ?? true,
      showHotMovies: body.showHotMovies ?? true,
      showHotTvShows: body.showHotTvShows ?? true,
      showNewAnime: body.showNewAnime ?? true,
      showHotVariety: body.showHotVariety ?? true,
      showHotShortDramas: body.showHotShortDramas ?? true,
    };

    await db.saveAdminConfig(config);
    clearConfigCache();
    revalidatePath('/');

    return NextResponse.json(
      {
        success: true,
        message: 'Home page config updated',
      },
      {
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  } catch (error) {
    console.error('保存首页配置失败:', error);
    return NextResponse.json({ error: '保存失败，请重试' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      { error: '不支持本地存储进行管理员配置' },
      { status: 400 },
    );
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await requireAdmin(authInfo.username);
    if (!config) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    return NextResponse.json(
      {
        success: true,
        config: config.HomePageConfig || defaultHomePageConfig,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('获取首页配置失败:', error);
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
  }
}
