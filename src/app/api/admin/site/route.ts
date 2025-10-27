/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = authInfo.username;

    const {
      SiteName,
      Announcement,
      SearchDownstreamMaxPage,
      SiteInterfaceCacheTime,
      DoubanProxyType,
      DoubanProxy,
      DoubanImageProxyType,
      DoubanImageProxy,
      DisableYellowFilter,
      FluidSearch,
      TMDBApiKey,
      TMDBLanguage,
      EnableTMDBActorSearch,
      EnableTMDBCarousel,
      ReleaseCalendarProxy,
    } = body as {
      SiteName: string;
      Announcement: string;
      SearchDownstreamMaxPage: number;
      SiteInterfaceCacheTime: number;
      DoubanProxyType: string;
      DoubanProxy: string;
      DoubanImageProxyType: string;
      DoubanImageProxy: string;
      DisableYellowFilter: boolean;
      FluidSearch: boolean;
      TMDBApiKey?: string;
      TMDBLanguage?: string;
      EnableTMDBActorSearch?: boolean;
      EnableTMDBCarousel?: boolean;
      ReleaseCalendarProxy?: string;
    };

    // 参数校验
    if (
      typeof SiteName !== 'string' ||
      typeof Announcement !== 'string' ||
      typeof SearchDownstreamMaxPage !== 'number' ||
      typeof SiteInterfaceCacheTime !== 'number' ||
      typeof DoubanProxyType !== 'string' ||
      typeof DoubanProxy !== 'string' ||
      typeof DoubanImageProxyType !== 'string' ||
      typeof DoubanImageProxy !== 'string' ||
      typeof DisableYellowFilter !== 'boolean' ||
      typeof FluidSearch !== 'boolean'
    ) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    const adminConfig = await getConfig();

    // 权限校验
    if (username !== process.env.USERNAME) {
      // 管理员
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === username
      );
      if (!user || user.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    console.log('[API] 接收到的 TMDB 设置:', {
      EnableTMDBActorSearch,
      EnableTMDBCarousel,
    });

    // 处理轮播图设置：如果是 undefined（新字段），使用数据库中的值或默认 false
    // 如果明确传了 true/false，则使用传入的值
    let finalEnableTMDBCarousel: boolean;
    if (EnableTMDBCarousel !== undefined) {
      // 前端明确传了值（true 或 false）
      finalEnableTMDBCarousel = EnableTMDBCarousel;
    } else if (adminConfig.SiteConfig.EnableTMDBCarousel !== undefined) {
      // 数据库中有值，保持原值
      finalEnableTMDBCarousel = adminConfig.SiteConfig.EnableTMDBCarousel;
    } else {
      // 首次添加此字段，默认关闭
      finalEnableTMDBCarousel = false;
    }

    // 更新缓存中的站点设置
    adminConfig.SiteConfig = {
      SiteName,
      Announcement,
      SearchDownstreamMaxPage,
      SiteInterfaceCacheTime,
      DoubanProxyType,
      DoubanProxy,
      DoubanImageProxyType,
      DoubanImageProxy,
      DisableYellowFilter,
      FluidSearch,
      TMDBApiKey: TMDBApiKey || '',
      TMDBLanguage: TMDBLanguage || 'zh-CN',
      EnableTMDBActorSearch: EnableTMDBActorSearch ?? false,
      EnableTMDBCarousel: finalEnableTMDBCarousel,
      ReleaseCalendarProxy: ReleaseCalendarProxy || '',
    };

    console.log('[API] 将要保存到数据库的 TMDB 设置:', {
      EnableTMDBActorSearch: adminConfig.SiteConfig.EnableTMDBActorSearch,
      EnableTMDBCarousel: adminConfig.SiteConfig.EnableTMDBCarousel,
    });

    // 写入数据库
    await db.saveAdminConfig(adminConfig);

    // 清除配置缓存，强制下次重新从数据库读取
    clearConfigCache();

    // 🔥 关键修复：强制刷新所有页面的服务端缓存
    // 这会清除 Vercel Edge 和 Serverless Functions 的缓存
    try {
      revalidatePath('/', 'layout'); // 刷新根layout
      revalidatePath('/admin', 'page'); // 刷新管理页面
      console.log('[API] 已触发页面缓存刷新');
    } catch (e) {
      console.warn('[API] 页面缓存刷新失败（非阻塞）:', e);
    }

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', // 不缓存结果
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('更新站点配置失败:', error);
    return NextResponse.json(
      {
        error: '更新站点配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
