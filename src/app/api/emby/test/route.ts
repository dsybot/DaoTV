/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { EmbyClient } from '@/lib/emby.client';

export const runtime = 'nodejs';

/**
 * 娴嬭瘯 Emby 杩炴帴
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
        { success: false, error: '鏈嶅姟鍣ㄥ湴鍧€涓嶈兘涓虹┖' },
        { status: 400 },
      );
    }

    // 鍒涘缓涓存椂 EmbyClient 杩涜娴嬭瘯
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

    // 灏濊瘯鑾峰彇褰撳墠鐢ㄦ埛淇℃伅
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
        error: error.message || '杩炴帴澶辫触',
      },
      { status: 500 },
    );
  }
}
