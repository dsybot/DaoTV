/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';

// GET: 获取弹幕API配置
export async function GET() {
  try {
    const config = await getConfig();
    const danmuApiConfig = config.DanmuApiConfig || {
      enabled: true,
      useCustomApi: false,
      customApiUrl: '',
      customToken: '',
      timeout: 15,
    };

    return NextResponse.json(danmuApiConfig);
  } catch (error) {
    console.error('获取弹幕API配置失败:', error);
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    );
  }
}

// POST: 保存弹幕API配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled, useCustomApi, customApiUrl, customToken, timeout } = body;

    // 验证参数
    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled 必须是布尔值' },
        { status: 400 }
      );
    }

    if (typeof useCustomApi !== 'boolean') {
      return NextResponse.json(
        { error: 'useCustomApi 必须是布尔值' },
        { status: 400 }
      );
    }

    if (useCustomApi) {
      if (!customApiUrl || typeof customApiUrl !== 'string') {
        return NextResponse.json(
          { error: '使用自定义API时必须提供有效的 customApiUrl' },
          { status: 400 }
        );
      }

      // 验证URL格式
      try {
        new URL(customApiUrl);
      } catch {
        return NextResponse.json(
          { error: 'customApiUrl 必须是有效的URL' },
          { status: 400 }
        );
      }
    }

    if (timeout && (typeof timeout !== 'number' || timeout < 5 || timeout > 60)) {
      return NextResponse.json(
        { error: 'timeout 必须是 5-60 之间的数字' },
        { status: 400 }
      );
    }

    // 获取当前配置
    const config = await getConfig();

    // 更新弹幕API配置
    config.DanmuApiConfig = {
      enabled,
      useCustomApi,
      customApiUrl: customApiUrl || '',
      customToken: customToken || '',
      timeout: timeout || 15,
    };

    // 保存到数据库
    const db = await getDb();
    await db.set('admin_config', JSON.stringify(config));

    console.log('弹幕API配置已更新:', config.DanmuApiConfig);

    return NextResponse.json({
      success: true,
      config: config.DanmuApiConfig,
    });
  } catch (error) {
    console.error('保存弹幕API配置失败:', error);
    return NextResponse.json(
      { error: '保存配置失败' },
      { status: 500 }
    );
  }
}
