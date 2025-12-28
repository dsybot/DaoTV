/* eslint-disable no-console */
'use client';

import { useCallback, useEffect, useState } from 'react';

import { getDoubanComments, getDoubanDetails } from '@/lib/douban.client';
import type { DoubanComment } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

/** 婕斿憳/瀵兼紨淇℃伅 */
export interface DoubanCelebrity {
  id: string;
  name: string;
  avatar: string;
  role: string;
  avatars?: {
    small: string;
    medium: string;
    large: string;
  };
}

/** 鎺ㄨ崘褰辩墖 */
export interface DoubanRecommendation {
  id: string;
  title: string;
  poster: string;
  rate: string;
}

/** 鐢靛奖璇︽儏 */
export interface DoubanMovieDetail {
  id: string;
  title: string;
  poster: string;
  rate: string;
  year: string;
  directors?: string[];
  screenwriters?: string[];
  cast?: string[];
  genres?: string[];
  countries?: string[];
  languages?: string[];
  episodes?: number;
  episode_length?: number;
  movie_duration?: number;
  first_aired?: string;
  plot_summary?: string;
  celebrities?: DoubanCelebrity[];
  recommendations?: DoubanRecommendation[];
  actors?: DoubanCelebrity[]; // 婕斿憳鍒楄〃锛堜粠 celebrities 鎻愬彇锛?}

/** Hook 杩斿洖绫诲瀷 */
export interface UseDoubanInfoResult {
  // 璇︽儏鏁版嵁
  detail: DoubanMovieDetail | null;
  detailLoading: boolean;
  detailError: Error | null;

  // 璇勮鏁版嵁
  comments: DoubanComment[];
  commentsLoading: boolean;
  commentsError: Error | null;
  commentsTotal: number;

  // 鍒锋柊鍑芥暟
  refreshDetail: () => Promise<void>;
  refreshComments: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 璞嗙摚淇℃伅 Hook
 * 鐢ㄤ簬骞惰鑾峰彇鐢靛奖璇︽儏鍜岃瘎璁烘暟鎹? *
 * @param doubanId - 璞嗙摚鐢靛奖 ID
 * @param options - 閰嶇疆閫夐」
 */
export function useDoubanInfo(
  doubanId: string | number | null | undefined,
  options: {
    /** 鏄惁鑷姩鑾峰彇璇︽儏锛岄粯璁?true */
    fetchDetail?: boolean;
    /** 鏄惁鑷姩鑾峰彇璇勮锛岄粯璁?true */
    fetchComments?: boolean;
    /** 璇勮鏁伴噺锛岄粯璁?6 */
    commentsCount?: number;
    /** 璇勮鎺掑簭鏂瑰紡锛岄粯璁?new_score */
    commentsSort?: 'new_score' | 'time';
  } = {},
): UseDoubanInfoResult {
  const {
    fetchDetail: shouldFetchDetail = true,
    fetchComments: shouldFetchComments = true,
    commentsCount = 6,
    commentsSort = 'new_score',
  } = options;

  // 璇︽儏鐘舵€?  const [detail, setDetail] = useState<DoubanMovieDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<Error | null>(null);

  // 璇勮鐘舵€?  const [comments, setComments] = useState<DoubanComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<Error | null>(null);
  const [commentsTotal, setCommentsTotal] = useState(0);

  // 鑾峰彇璇︽儏
  const refreshDetail = useCallback(async () => {
    if (!doubanId) return;

    setDetailLoading(true);
    setDetailError(null);

    try {
      const result = await getDoubanDetails(String(doubanId));

      if (result.code === 200 && result.data) {
        setDetail(result.data as DoubanMovieDetail);
      } else {
        throw new Error(result.message || '鑾峰彇璇︽儏澶辫触');
      }
    } catch (error) {
      console.error('[useDoubanInfo] Failed to fetch detail:', error);
      setDetailError(error instanceof Error ? error : new Error('鏈煡閿欒'));
    } finally {
      setDetailLoading(false);
    }
  }, [doubanId]);

  // 鑾峰彇璇勮
  const refreshComments = useCallback(async () => {
    if (!doubanId) return;

    setCommentsLoading(true);
    setCommentsError(null);

    try {
      const result = await getDoubanComments({
        id: String(doubanId),
        start: 0,
        limit: commentsCount,
        sort: commentsSort,
      });

      if (result.code === 200 && result.data) {
        setComments(result.data.comments || []);
        setCommentsTotal(result.data.count || 0);
      } else {
        throw new Error(result.message || '鑾峰彇璇勮澶辫触');
      }
    } catch (error) {
      console.error('[useDoubanInfo] Failed to fetch comments:', error);
      setCommentsError(error instanceof Error ? error : new Error('鏈煡閿欒'));
    } finally {
      setCommentsLoading(false);
    }
  }, [doubanId, commentsCount, commentsSort]);

  // 鍒濆鍖栧姞杞?  useEffect(() => {
    if (!doubanId) {
      // 閲嶇疆鐘舵€?      setDetail(null);
      setComments([]);
      setCommentsTotal(0);
      return;
    }

    // 骞惰璇锋眰
    const promises: Promise<void>[] = [];

    if (shouldFetchDetail) {
      promises.push(refreshDetail());
    }

    if (shouldFetchComments) {
      promises.push(refreshComments());
    }

    Promise.allSettled(promises);
  }, [
    doubanId,
    shouldFetchDetail,
    shouldFetchComments,
    refreshDetail,
    refreshComments,
  ]);

  return {
    detail,
    detailLoading,
    detailError,
    comments,
    commentsLoading,
    commentsError,
    commentsTotal,
    refreshDetail,
    refreshComments,
  };
}

export default useDoubanInfo;
