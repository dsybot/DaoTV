/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// 生成签名
async function generateSignature(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 生成认证Cookie
async function generateAuthCookie(
  username: string,
  role: 'owner' | 'admin' | 'user'
): Promise<string> {
  const authData: any = { role };

  if (username && process.env.PASSWORD) {
    authData.username = username;
    const signature = await generateSignature(username, process.env.PASSWORD);
    authData.signature = signature;
    authData.timestamp = Date.now();
    authData.loginTime = Date.now();
  }

  return encodeURIComponent(JSON.stringify(authData));
}

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    // 验证用户名
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }

    // 验证用户名格式
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: '用户名只能包含字母、数字、下划线，长度3-20位' },
        { status: 400 }
      );
    }

    // 获取OIDC session
    const oidcSessionCookie = request.cookies.get('oidc_session')?.value;
    if (!oidcSessionCookie) {
      return NextResponse.json(
        { error: 'OIDC会话已过期，请重新登录' },
        { status: 400 }
      );
    }

    let oidcSession: any;
    try {
      oidcSession = JSON.parse(oidcSessionCookie);
    } catch {
      return NextResponse.json(
        { error: 'OIDC会话无效' },
        { status: 400 }
      );
    }

    // 检查session是否过期(10分钟)
    if (Date.now() - oidcSession.timestamp > 600000) {
      return NextResponse.json(
        { error: 'OIDC会话已过期，请重新登录' },
        { status: 400 }
      );
    }

    const config = await getConfig();
    const oidcConfig = config.OIDCAuthConfig;

    // 检查是否启用OIDC注册
    if (!oidcConfig || !oidcConfig.enableRegistration) {
      return NextResponse.json(
        { error: 'OIDC注册未启用' },
        { status: 403 }
      );
    }

    // 检查最低信任等级
    const minTrustLevel = oidcConfig.minTrustLevel || 0;
    if (minTrustLevel > 0) {
      const userTrustLevel = oidcSession.trust_level ?? 0;
      if (userTrustLevel < minTrustLevel) {
        return NextResponse.json(
          { error: `您的信任等级(${userTrustLevel})不满足最低要求(${minTrustLevel})` },
          { status: 403 }
        );
      }
    }

    // 检查是否与站长同名
    if (username === process.env.USERNAME) {
      return NextResponse.json(
        { error: '该用户名不可用' },
        { status: 409 }
      );
    }

    // 检查用户名是否已存在（优先使用新版本）
    let userExists = await db.checkUserExistV2(username);
    if (!userExists) {
      // 回退到旧版本检查
      userExists = await db.checkUserExist(username);
    }
    if (userExists) {
      return NextResponse.json(
        { error: '用户名已存在' },
        { status: 409 }
      );
    }

    // 检查配置中是否已存在
    const existingUser = config.UserConfig.Users.find((u) => u.username === username);
    if (existingUser) {
      return NextResponse.json(
        { error: '用户名已存在' },
        { status: 409 }
      );
    }

    // 检查OIDC sub是否已被使用（优先使用新版本）
    let existingOIDCUsername = await db.getUserByOidcSub(oidcSession.sub);
    if (!existingOIDCUsername) {
      // 回退到配置中查找
      const existingOIDCUser = config.UserConfig.Users.find((u: any) => u.oidcSub === oidcSession.sub);
      if (existingOIDCUser) {
        existingOIDCUsername = existingOIDCUser.username;
      }
    }
    if (existingOIDCUsername) {
      return NextResponse.json(
        { error: '该OIDC账号已被注册' },
        { status: 409 }
      );
    }

    // 创建用户
    try {
      // 生成随机密码(OIDC用户不需要密码登录)
      const randomPassword = crypto.randomUUID();

      // 获取默认用户组
      const defaultTags = config.SiteConfig.DefaultUserTags && config.SiteConfig.DefaultUserTags.length > 0
        ? config.SiteConfig.DefaultUserTags
        : undefined;

      // 使用 V1 注册用户
      await db.registerUser(username, randomPassword);

      // 添加到 AdminConfig.UserConfig.Users（带 oidcSub）
      const newUser: any = {
        username: username,
        role: 'user' as const,
        createdAt: Date.now(),
        oidcSub: oidcSession.sub,  // 绑定 OIDC Sub
      };

      if (defaultTags && defaultTags.length > 0) {
        newUser.tags = defaultTags;
      }

      config.UserConfig.Users.push(newUser);

      // 保存配置
      await db.saveAdminConfig(config);

      // 清除缓存
      clearConfigCache();

      // 设置认证cookie
      const response = NextResponse.json({ ok: true, message: '注册成功' });
      const cookieValue = await generateAuthCookie(username, 'user');
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);

      response.cookies.set('user_auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax',
        httpOnly: false,
        secure: false,
      });

      // 清除OIDC session
      response.cookies.delete('oidc_session');

      return response;
    } catch (err) {
      console.error('创建用户失败', err);
      return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
    }
  } catch (error) {
    console.error('OIDC注册完成失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
