/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { EmbyClient } from '@/lib/emby.client';

export const runtime = 'nodejs';

/**
 * Test Emby connectivity for user-configured sources.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ServerURL,
      ApiKey,
      Username,
      Password,
      ClientName,
      DeviceName,
      DeviceId,
      ClientVersion,
      removeEmbyPrefix,
    } = body;

    if (!ServerURL) {
      return NextResponse.json(
        { success: false, error: '服务器地址不能为空' },
        { status: 400 },
      );
    }

    const client = new EmbyClient({
      ServerURL,
      ApiKey,
      Username,
      Password,
      ClientName,
      DeviceName,
      DeviceId,
      ClientVersion,
      removeEmbyPrefix,
    });

    const user = await client.getCurrentUser();

    return NextResponse.json({
      success: true,
      user: {
        Id: user.Id,
        Name: user.Name,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || '连接失败',
      },
      { status: 500 },
    );
  }
}
