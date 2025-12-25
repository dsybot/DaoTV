/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { ensureAdmin } from '@/lib/admin-auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// GET: 获取下载配置（已登录用户可访问）
export async function GET() {
  try {
    // 直接从数据库读取，不使用缓存，确保获取最新配置
    const config = await db.getAdminConfig();
    const enabled = config?.DownloadConfig?.enabled ?? true;

    return NextResponse.json(
      { enabled },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('获取下载配置失败:', error);
    return NextResponse.json(
      { enabled: true },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}

export async function POST(request: NextRequest) {
  // 权限检查
  try {
    await ensureAdmin(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '无权限' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { enabled } = body;

    // 获取当前配置
    const config = await getConfig();

    // 更新下载配置
    config.DownloadConfig = {
      enabled: enabled ?? true,
    };

    // 保存到数据库
    await db.saveAdminConfig(config);

    // 清除配置缓存
    clearConfigCache();

    console.log('下载配置已更新:', config.DownloadConfig);

    return NextResponse.json({
      success: true,
      message: '下载配置保存成功',
      config: config.DownloadConfig,
    });
  } catch (error) {
    console.error('保存下载配置失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '保存失败',
      },
      { status: 500 }
    );
  }
}
