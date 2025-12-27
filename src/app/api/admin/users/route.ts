/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行用户列表查询',
      },
      { status: 400 }
    );
  }

  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取配置
    const adminConfig = await getConfig();

    // 判定操作者角色
    let operatorRole: 'owner' | 'admin' | 'user' = 'user';
    if (authInfo.username === process.env.USERNAME) {
      operatorRole = 'owner';
    } else {
      // 优先从新版本获取用户信息
      const operatorInfo = await db.getUserInfoV2(authInfo.username);
      if (operatorInfo) {
        operatorRole = operatorInfo.role;
      } else {
        // 回退到配置中查找
        const userEntry = adminConfig.UserConfig.Users.find(
          (u) => u.username === authInfo.username
        );
        if (userEntry) {
          operatorRole = userEntry.role;
        }
      }
    }

    // 只有站长和管理员可以查看用户列表
    if (operatorRole !== 'owner' && operatorRole !== 'admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 401 });
    }

    // 获取分页参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    // 获取用户列表（优先使用新版本）
    const result = await db.getUserListV2(offset, limit, process.env.USERNAME);

    if (result.users.length > 0) {
      // 使用新版本数据
      return NextResponse.json(
        {
          users: result.users,
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 回退到配置中的用户列表
    const configUsers = adminConfig.UserConfig.Users || [];
    const total = configUsers.length;

    // 排序：站长始终在第一位，其他用户按用户名排序
    const sortedUsers = [...configUsers].sort((a, b) => {
      if (a.username === process.env.USERNAME) return -1;
      if (b.username === process.env.USERNAME) return 1;
      return a.username.localeCompare(b.username);
    });

    // 分页
    const paginatedUsers = sortedUsers.slice(offset, offset + limit);

    // 转换为统一格式
    const users = paginatedUsers.map((u) => ({
      username: u.username,
      role: u.role,
      banned: u.banned || false,
      tags: u.tags,
      created_at: u.createdAt || 0, // 配置中的创建时间
    }));

    return NextResponse.json(
      {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      {
        error: '获取用户列表失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
