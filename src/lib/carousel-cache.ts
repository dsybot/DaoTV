/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 服务器端轮播图缓存模块
 * 
 * 策略：
 * 1. 定时任务每小时主动生成轮播图数据并缓存
 * 2. 用户访问时直接返回缓存数据（极快）
 * 3. 如果缓存不存在，降级为实时生成
 */

import { db } from './db';

const CAROUSEL_CACHE_KEY = 'carousel:latest';
const CAROUSEL_CACHE_EXPIRE = 2 * 60 * 60; // 2小时过期（防止定时任务失败）

export interface CarouselCacheData {
  list: any[];
  generatedAt: string;
  expiresAt: string;
  source: 'cache' | 'realtime';
}

/**
 * 获取缓存的轮播图数据
 */
export async function getCachedCarousel(): Promise<CarouselCacheData | null> {
  try {
    const cached = await db.get(CAROUSEL_CACHE_KEY);
    
    if (cached) {
      console.log('[轮播缓存] ✅ 命中服务器缓存');
      const data = JSON.parse(cached);
      return {
        ...data,
        source: 'cache' as const,
      };
    }
    
    console.log('[轮播缓存] ⚠️ 未找到缓存，需要生成');
    return null;
  } catch (error) {
    console.error('[轮播缓存] ❌ 读取缓存失败:', error);
    return null;
  }
}

/**
 * 设置轮播图缓存
 */
export async function setCachedCarousel(carouselList: any[]): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CAROUSEL_CACHE_EXPIRE * 1000);
    
    const cacheData = {
      list: carouselList,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    
    await db.set(
      CAROUSEL_CACHE_KEY,
      JSON.stringify(cacheData),
      CAROUSEL_CACHE_EXPIRE
    );
    
    console.log(`[轮播缓存] ✅ 缓存已更新，共 ${carouselList.length} 项`);
    console.log(`[轮播缓存] 📅 生成时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    console.log(`[轮播缓存] ⏰ 过期时间: ${expiresAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  } catch (error) {
    console.error('[轮播缓存] ❌ 设置缓存失败:', error);
    throw error;
  }
}

/**
 * 清除轮播图缓存（用于测试或强制刷新）
 */
export async function clearCarouselCache(): Promise<void> {
  try {
    await db.del(CAROUSEL_CACHE_KEY);
    console.log('[轮播缓存] 🗑️ 缓存已清除');
  } catch (error) {
    console.error('[轮播缓存] ❌ 清除缓存失败:', error);
  }
}

/**
 * 获取缓存状态信息
 */
export async function getCarouselCacheStatus(): Promise<{
  exists: boolean;
  generatedAt?: string;
  expiresAt?: string;
  itemCount?: number;
  ageMinutes?: number;
}> {
  try {
    const cached = await getCachedCarousel();
    
    if (!cached) {
      return { exists: false };
    }
    
    const generatedTime = new Date(cached.generatedAt).getTime();
    const now = Date.now();
    const ageMinutes = Math.floor((now - generatedTime) / 1000 / 60);
    
    return {
      exists: true,
      generatedAt: cached.generatedAt,
      expiresAt: cached.expiresAt,
      itemCount: cached.list?.length || 0,
      ageMinutes,
    };
  } catch (error) {
    console.error('[轮播缓存] ❌ 获取缓存状态失败:', error);
    return { exists: false };
  }
}

