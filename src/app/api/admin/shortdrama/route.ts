import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, clearConfigCache } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// GET: 获取短剧配置
export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await getConfig();
    const shortDramaConfig = config.ShortDramaConfig || {
      primaryApiUrl: 'https://api.r2afosne.dpdns.org',
      alternativeApiUrl: '',
      enableAlternative: false,
    };

    return NextResponse.json({ config: shortDramaConfig });
  } catch (error) {
    console.error('获取短剧配置失败:', error);
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    );
  }
}

// POST: 更新短剧配置（仅管理员）
export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await getConfig();

    // 检查是否为管理员
    const user = config.UserConfig.Users.find(
      (u) => u.username === authInfo.username
    );
    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const body = await request.json();
    const { primaryApiUrl, alternativeApiUrl, enableAlternative } = body;

    // 更新配置
    config.ShortDramaConfig = {
      primaryApiUrl: primaryApiUrl || 'https://api.r2afosne.dpdns.org',
      alternativeApiUrl: alternativeApiUrl || '',
      enableAlternative: enableAlternative || false,
    };

    // 保存配置
    await db.saveAdminConfig(config);
    clearConfigCache();

    return NextResponse.json({ success: true, config: config.ShortDramaConfig });
  } catch (error) {
    console.error('更新短剧配置失败:', error);
    return NextResponse.json(
      { error: '更新配置失败' },
      { status: 500 }
    );
  }
}
