import { NextRequest, NextResponse } from 'next/server';
import { repairCacheInconsistency } from '@/lib/video-cache';

/**
 * 修复视频缓存不一致问题
 * 清理孤儿元数据，重置缓存计数器
 * 
 * GET /api/video-cache/repair
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] 开始修复视频缓存...');

    const result = await repairCacheInconsistency();

    return NextResponse.json({
      success: true,
      message: '缓存修复完成',
      data: {
        cleanedMetaCount: result.cleanedMetaCount,
        oldTotalSize: `${(result.oldTotalSize / 1024 / 1024).toFixed(2)}MB`,
        newTotalSize: `${(result.newTotalSize / 1024 / 1024).toFixed(2)}MB`,
        freedSpace: `${((result.oldTotalSize - result.newTotalSize) / 1024 / 1024).toFixed(2)}MB`,
      },
    });
  } catch (error) {
    console.error('[API] 修复视频缓存失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '修复失败',
      },
      { status: 500 }
    );
  }
}
