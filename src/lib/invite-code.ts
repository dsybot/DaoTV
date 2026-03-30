/* eslint-disable no-console */
/**
 * 邀请码系统
 * 基于 Redis 实现的邀请码生成、验证和管理
 */

import { customAlphabet } from 'nanoid';

import { db } from './db';

// 生成邀请码：8位大写字母+数字，排除易混淆字符 (0/O, 1/I/l)
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateCode = customAlphabet(alphabet, 8);

// 获取 Redis 客户端
function getRedisClient() {
  const storage = (db as any).storage;
  if (!storage || !storage.client) {
    throw new Error('Redis 客户端不可用，邀请码系统需要 Redis 存储');
  }
  return storage.client;
}

export interface InviteCodeData {
  code: string;
  createdBy: string;
  createdAt: number;
  maxUses: number;
  currentUses: number;
  expiresAt: number;
  users?: string[];
}

export interface InviteCodeStats {
  code: string;
  createdBy: string;
  createdAt: string;
  maxUses: number;
  currentUses: number;
  remainingUses: number;
  expiresAt: string;
  expired: boolean;
  users: string[];
}

/**
 * 生成唯一的邀请码
 */
async function generateUniqueCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  const client = getRedisClient();

  while (attempts < maxAttempts) {
    const code = generateCode();
    const exists = await client.sIsMember('invites:active', code);

    if (!exists) {
      return code;
    }

    attempts++;
  }

  throw new Error('无法生成唯一邀请码，请稍后重试');
}

/**
 * 创建邀请码
 * @param createdBy 创建者用户名
 * @param maxUses 最大使用次数，默认 10
 * @param expiresIn 过期时间（秒），默认 7 天
 */
export async function createInviteCode(
  createdBy: string,
  maxUses = 10,
  expiresIn = 604800 // 7天
): Promise<string> {
  const code = await generateUniqueCode();
  const now = Date.now();
  const expiresAt = now + expiresIn * 1000;
  const client = getRedisClient();

  const inviteData: InviteCodeData = {
    code,
    createdBy,
    createdAt: now,
    maxUses,
    currentUses: 0,
    expiresAt,
  };

  // 存储邀请码详情
  await client.hSet(`invite:${code}`, inviteData as any);

  // 设置过期时间
  await client.expire(`invite:${code}`, expiresIn);

  // 添加到活跃邀请码集合
  await client.sAdd('invites:active', code);

  // 添加到创建者的邀请码列表
  await client.sAdd(`admin:${createdBy}:invites`, code);

  console.log(`[InviteCode] 创建邀请码: ${code}, 创建者: ${createdBy}, 最大使用次数: ${maxUses}`);

  return code;
}

/**
 * 验证邀请码是否有效
 * @param code 邀请码
 * @returns 是否有效及剩余使用次数
 */
export async function validateInviteCode(
  code: string
): Promise<{ valid: boolean; remainingUses?: number; error?: string }> {
  const client = getRedisClient();

  // 检查邀请码是否存在
  const exists = await client.sIsMember('invites:active', code);
  if (!exists) {
    return { valid: false, error: '邀请码不存在或已失效' };
  }

  // 获取邀请码详情
  const inviteData = (await client.hGetAll(`invite:${code}`)) as unknown as InviteCodeData;
  if (!inviteData || !inviteData.code) {
    return { valid: false, error: '邀请码数据异常' };
  }

  // 检查是否过期
  const now = Date.now();
  if (now > Number(inviteData.expiresAt)) {
    // 清理过期邀请码
    await removeInviteCode(code);
    return { valid: false, error: '邀请码已过期' };
  }

  // 检查使用次数
  const currentUses = Number(inviteData.currentUses);
  const maxUses = Number(inviteData.maxUses);
  if (currentUses >= maxUses) {
    return { valid: false, error: '邀请码已达到最大使用次数' };
  }

  const remainingUses = maxUses - currentUses;
  return { valid: true, remainingUses };
}

/**
 * 使用邀请码（注册时调用）
 * @param code 邀请码
 * @param username 使用者用户名
 */
export async function useInviteCode(code: string, username: string): Promise<boolean> {
  const client = getRedisClient();

  // 先验证邀请码
  const validation = await validateInviteCode(code);
  if (!validation.valid) {
    throw new Error(validation.error || '邀请码无效');
  }

  // 获取邀请码详情
  const inviteData = (await client.hGetAll(`invite:${code}`)) as unknown as InviteCodeData;

  // 增加使用次数
  await client.hIncrBy(`invite:${code}`, 'currentUses', 1);

  // 记录使用者
  await client.lPush(`invite:${code}:users`, username);

  const currentUses = Number(inviteData.currentUses);
  const maxUses = Number(inviteData.maxUses);

  console.log(`[InviteCode] 使用邀请码: ${code}, 用户: ${username}, 当前使用次数: ${currentUses + 1}/${maxUses}`);

  // 如果达到最大使用次数，从活跃集合中移除
  if (currentUses + 1 >= maxUses) {
    await client.sRem('invites:active', code);
    console.log(`[InviteCode] 邀请码已达到最大使用次数: ${code}`);
  }

  return true;
}

/**
 * 获取邀请码统计信息
 * @param code 邀请码
 */
export async function getInviteCodeStats(code: string): Promise<InviteCodeStats | null> {
  const client = getRedisClient();

  const inviteData = (await client.hGetAll(`invite:${code}`)) as unknown as InviteCodeData;
  if (!inviteData || !inviteData.code) {
    return null;
  }

  // 获取使用者列表
  const users = await client.lRange(`invite:${code}:users`, 0, -1);

  const now = Date.now();
  const expiresAt = Number(inviteData.expiresAt);
  const expired = now > expiresAt;
  const currentUses = Number(inviteData.currentUses);
  const maxUses = Number(inviteData.maxUses);
  const createdAt = Number(inviteData.createdAt);

  return {
    code: inviteData.code,
    createdBy: inviteData.createdBy,
    createdAt: new Date(createdAt).toISOString(),
    maxUses,
    currentUses,
    remainingUses: maxUses - currentUses,
    expiresAt: new Date(expiresAt).toISOString(),
    expired,
    users,
  };
}

/**
 * 获取所有活跃邀请码
 */
export async function getAllActiveInviteCodes(): Promise<InviteCodeStats[]> {
  const client = getRedisClient();
  const codes = await client.sMembers('invites:active');
  const stats: InviteCodeStats[] = [];

  for (const code of codes) {
    const stat = await getInviteCodeStats(code);
    if (stat) {
      stats.push(stat);
    }
  }

  return stats.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * 删除邀请码
 * @param code 邀请码
 */
export async function removeInviteCode(code: string): Promise<boolean> {
  const client = getRedisClient();

  const inviteData = (await client.hGetAll(`invite:${code}`)) as unknown as InviteCodeData;
  if (!inviteData || !inviteData.code) {
    return false;
  }

  // 从活跃集合中移除
  await client.sRem('invites:active', code);

  // 从创建者列表中移除
  if (inviteData.createdBy) {
    await client.sRem(`admin:${inviteData.createdBy}:invites`, code);
  }

  // 删除邀请码详情
  await client.del(`invite:${code}`);

  // 删除使用者列表
  await client.del(`invite:${code}:users`);

  console.log(`[InviteCode] 删除邀请码: ${code}`);

  return true;
}

/**
 * 获取管理员创建的邀请码列表
 * @param adminUsername 管理员用户名
 */
export async function getAdminInviteCodes(adminUsername: string): Promise<InviteCodeStats[]> {
  const client = getRedisClient();
  const codes = await client.sMembers(`admin:${adminUsername}:invites`);
  const stats: InviteCodeStats[] = [];

  for (const code of codes) {
    const stat = await getInviteCodeStats(code);
    if (stat) {
      stats.push(stat);
    }
  }

  return stats.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
