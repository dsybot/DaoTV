import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // 从配置API获取观影室服务器信息
    const configResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/watch-room/config`,
      {
        method: 'POST',
      }
    );

    if (!configResponse.ok) {
      return NextResponse.json(
        { success: false, error: '获取配置失败' },
        { status: 500 }
      );
    }

    const config = await configResponse.json();

    if (!config.enabled || !config.serverUrl || !config.authKey) {
      return NextResponse.json({
        success: false,
        error: '观影室未配置或未启用',
      });
    }

    // 请求统计信息
    const statsUrl = `${config.serverUrl.replace(/\/$/, '')}/stats`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(statsUrl, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.authKey}`,
          Accept: 'application/json',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: `服务器返回错误: HTTP ${response.status}`,
        });
      }

      const stats = await response.json();

      return NextResponse.json({
        success: true,
        data: stats,
      });
    } catch (fetchError: any) {
      clearTimeout(timeout);

      if (fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          error: '请求超时（10秒）',
        });
      }

      return NextResponse.json({
        success: false,
        error: `无法连接到服务器: ${fetchError.message}`,
      });
    }
  } catch (error: any) {
    console.error('获取统计信息失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取统计信息失败' },
      { status: 500 }
    );
  }
}
