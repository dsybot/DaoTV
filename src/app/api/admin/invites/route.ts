/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';

import { ensureAdmin } from '@/lib/admin-auth';
import { getAuthInfoFromCookie } from '@/lib/auth';
import {
  createInviteCode,
  getAllActiveInviteCodes,
  removeInviteCode,
} from '@/lib/invite-code';

export const runtime = 'nodejs';

/**
 * GET /api/admin/invites
 * 获取所有活跃邀请码列表
 */
export async function GET(req: NextRequest) {
  try {
    // 验证管理员权限
    await ensureAdmin(req);

    const codes = await getAllActiveInviteCodes();

    return NextResponse.json({
      ok: true,
      codes,
      total: codes.length,
    });
  } catch (error) {
    console.error('[Admin Invites] 获取邀请码列表失败:', error);
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ error: '获取邀请码列表失败' }, { status: 500 });
  }
}

/**
 * POST /api/admin/invites
 * 生成新的邀请码
 */
export async function POST(req: NextRequest) {
  try {
    // 验证管理员权限
    await ensureAdmin(req);

    // 获取用户名
    const authInfo = getAuthInfoFromCookie(req);
    const username = authInfo?.username || process.env.USERNAME || 'admin';

    const body = await req.json();
    const { maxUses = 10, expiresIn = 604800 } = body; // 默认10次，7天

    // 验证参数
    if (maxUses < 1 || maxUses > 1000) {
      return NextResponse.json(
        { error: '使用次数必须在 1-1000 之间' },
        { status: 400 }
      );
    }

    if (expiresIn < 3600 || expiresIn > 31536000) {
      return NextResponse.json(
        { error: '过期时间必须在 1小时-1年 之间' },
        { status: 400 }
      );
    }

    const code = await createInviteCode(username, maxUses, expiresIn);

    return NextResponse.json({
      ok: true,
      code,
      message: '邀请码生成成功',
    });
  } catch (error) {
    console.error('[Admin Invites] 生成邀请码失败:', error);
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ error: '生成邀请码失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/invites?code=XXX
 * 删除邀请码
 */
export async function DELETE(req: NextRequest) {
  try {
    // 验证管理员权限
    await ensureAdmin(req);

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: '缺少邀请码参数' }, { status: 400 });
    }

    const success = await removeInviteCode(code);

    if (!success) {
      return NextResponse.json({ error: '邀请码不存在' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: '邀请码已删除',
    });
  } catch (error) {
    console.error('[Admin Invites] 删除邀请码失败:', error);
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ error: '删除邀请码失败' }, { status: 500 });
  }
}
