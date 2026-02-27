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
      DoubanDetailProxy,
      DisableYellowFilter,
      ShowAdultContent,
      FluidSearch,
      EnableWebLive,
      EnablePuppeteer,
      DoubanCookies,
      TMDBApiKey,
      TMDBApiKeys,
      TMDBLanguage,
      EnableTMDBActorSearch,
      TMDBWorkerProxy,
      LoginBgDesktop,
      LoginBgMobile,
      cronConfig,
    } = body as {
      SiteName: string;
      Announcement: string;
      SearchDownstreamMaxPage: number;
      SiteInterfaceCacheTime: number;
      DoubanProxyType: string;
      DoubanProxy: string;
      DoubanImageProxyType: string;
      DoubanImageProxy: string;
      DoubanDetailProxy?: string;
      DisableYellowFilter: boolean;
      ShowAdultContent: boolean;
      FluidSearch: boolean;
      EnableWebLive: boolean;
      EnablePuppeteer: boolean;
      DoubanCookies?: string;
      TMDBApiKey?: string;
      TMDBApiKeys?: string[];
      TMDBLanguage?: string;
      EnableTMDBActorSearch?: boolean;
      TMDBWorkerProxy?: string;
      LoginBgDesktop?: string;
      LoginBgMobile?: string;
      cronConfig?: {
        enableAutoRefresh: boolean;
        maxRecordsPerRun: number;
        onlyRefreshRecent: boolean;
        recentDays: number;
        onlyRefreshOngoing: boolean;
      };
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
      typeof FluidSearch !== 'boolean' ||
      typeof EnablePuppeteer !== 'boolean'
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
    });

    // 更新缓存中的站点设置，保留现有的自定义去广告配置
    adminConfig.SiteConfig = {
      ...adminConfig.SiteConfig, // 保留所有现有字段
      SiteName,
      Announcement,
      SearchDownstreamMaxPage,
      SiteInterfaceCacheTime,
      DoubanProxyType,
      DoubanProxy,
      DoubanImageProxyType,
      DoubanImageProxy,
      DoubanDetailProxy: DoubanDetailProxy || '',
      DisableYellowFilter,
      ShowAdultContent,
      FluidSearch,
      EnableWebLive: EnableWebLive ?? false,
      TMDBApiKey: TMDBApiKey || '',
      TMDBApiKeys: (TMDBApiKeys || []).filter((k: string) => k && k.trim()),  // 过滤空值
      TMDBLanguage: TMDBLanguage || 'zh-CN',
      EnableTMDBActorSearch: EnableTMDBActorSearch ?? false,
      TMDBWorkerProxy: TMDBWorkerProxy || '',
      LoginBgDesktop: LoginBgDesktop || '',
      LoginBgMobile: LoginBgMobile || '',
    };

    console.log('[API] 将要保存到数据库的 TMDB 设置:', {
      EnableTMDBActorSearch: adminConfig.SiteConfig.EnableTMDBActorSearch,
    });

    // 更新豆瓣配置
    if (!adminConfig.DoubanConfig) {
      adminConfig.DoubanConfig = {
        enablePuppeteer: false,
      };
    }
    adminConfig.DoubanConfig.enablePuppeteer = EnablePuppeteer;
    adminConfig.DoubanConfig.cookies = DoubanCookies || undefined;

    // 更新 Cron 配置
    if (cronConfig) {
      if (!adminConfig.CronConfig) {
        adminConfig.CronConfig = {
          enableAutoRefresh: true,
          maxRecordsPerRun: 100,
          onlyRefreshRecent: true,
          recentDays: 30,
          onlyRefreshOngoing: true,
        };
      }
      adminConfig.CronConfig = {
        enableAutoRefresh: cronConfig.enableAutoRefresh,
        maxRecordsPerRun: cronConfig.maxRecordsPerRun,
        onlyRefreshRecent: cronConfig.onlyRefreshRecent,
        recentDays: cronConfig.recentDays,
        onlyRefreshOngoing: cronConfig.onlyRefreshOngoing,
      };
    }

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

    // 🔥 添加强制no-cache headers，防止Docker环境下Next.js Router Cache问题
    // 参考：https://github.com/vercel/next.js/issues/62071
    return NextResponse.json(
      { ok: true, shouldReload: true }, // 添加shouldReload标志通知前端刷新页面
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
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
