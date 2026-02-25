/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { dbManager } from '@/lib/db';

// GET - 获取用户 Emby 配置
export async function GET(request: NextRequest) {
  try {
    // 从 cookie 获取用户信息
    const authCookie = getAuthInfoFromCookie(request);

    if (!authCookie?.username) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const username = authCookie.username;
    const config = await dbManager.getUserEmbyConfig(username);

    return NextResponse.json({
      success: true,
      config: config || { sources: [] }
    });
  } catch (error: any) {
    console.error('获取用户 Emby 配置失败:', error);
    return NextResponse.json(
      { error: error.message || '获取配置失败' },
      { status: 500 }
    );
  }
}

// POST - 保存用户 Emby 配置
export async function POST(request: NextRequest) {
  try {
    // 从 cookie 获取用户信息
    const authCookie = getAuthInfoFromCookie(request);

    if (!authCookie?.username) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const username = authCookie.username;
    const body = await request.json();
    const { config } = body;

    if (!config || !config.sources || !Array.isArray(config.sources)) {
      return NextResponse.json(
        { error: '配置格式错误' },
        { status: 400 }
      );
    }

    // 验证配置格式
    for (const source of config.sources) {
      if (!source.key || !source.name || !source.ServerURL) {
        return NextResponse.json(
          { error: '源配置缺少必填字段 (key, name, ServerURL)' },
          { status: 400 }
        );
      }
    }

    await dbManager.saveUserEmbyConfig(username, config);

    return NextResponse.json({
      success: true,
      message: '配置保存成功'
    });
  } catch (error: any) {
    console.error('保存用户 Emby 配置失败:', error);
    return NextResponse.json(
      { error: error.message || '保存配置失败' },
      { status: 500 }
    );
  }
}

// DELETE - 删除用户 Emby 配置
export async function DELETE(request: NextRequest) {
  try {
    // 从 cookie 获取用户信息
    const authCookie = getAuthInfoFromCookie(request);

    if (!authCookie?.username) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const username = authCookie.username;
    await dbManager.deleteUserEmbyConfig(username);

    return NextResponse.json({
      success: true,
      message: '配置删除成功'
    });
  } catch (error: any) {
    console.error('删除用户 Emby 配置失败:', error);
    return NextResponse.json(
      { error: error.message || '删除配置失败' },
      { status: 500 }
    );
  }
}
