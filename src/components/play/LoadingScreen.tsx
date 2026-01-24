/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { memo } from 'react';
import PageLayout from '@/components/PageLayout';
import LoadingProgressIndicator from './LoadingProgressIndicator';
import SpeedTestProgress from './SpeedTestProgress';

interface LoadingScreenProps {
  loadingStage: 'searching' | 'preferring' | 'fetching' | 'ready';
  loadingMessage: string;
  speedTestProgress?: {
    current: number;
    total: number;
    currentSource?: string;
    currentSourceName?: string;
    result?: string;
    results?: Array<{
      sourceName: string;
      quality: string;
      loadSpeed: string;
      pingTime: number;
      status: 'testing' | 'success' | 'failed';
    }>;
  } | null;
}

/**
 * 加载状态组件 - 独立拆分以优化性能
 * 使用 React.memo 防止不必要的重新渲染
 */
const LoadingScreen = memo(function LoadingScreen({
  loadingStage,
  loadingMessage,
  speedTestProgress,
}: LoadingScreenProps) {
  return (
    <PageLayout activePath='/play'>
      <div className='flex items-center justify-center min-h-screen bg-transparent'>
        <div className='text-center max-w-md mx-auto px-6'>
          {/* 动画影院图标 */}
          <div className='relative mb-8'>
            <div className='relative mx-auto w-24 h-24 bg-linear-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
              <div className='text-white text-4xl'>
                {loadingStage === 'searching' && '🔍'}
                {loadingStage === 'preferring' && '⚡'}
                {loadingStage === 'fetching' && '🎬'}
                {loadingStage === 'ready' && '✨'}
              </div>
              {/* 旋转光环 */}
              <div className='absolute -inset-2 bg-linear-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
            </div>

            {/* 浮动粒子效果 */}
            <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
              <div className='absolute top-2 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce'></div>
              <div
                className='absolute top-4 right-4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce'
                style={{ animationDelay: '0.5s' }}
              ></div>
              <div
                className='absolute bottom-3 left-6 w-1 h-1 bg-lime-400 rounded-full animate-bounce'
                style={{ animationDelay: '1s' }}
              ></div>
            </div>
          </div>

          {/* 进度指示器 */}
          <LoadingProgressIndicator loadingStage={loadingStage} />

          {/* 加载消息 */}
          <div className='space-y-2'>
            <p className='text-xl font-semibold text-gray-800 dark:text-gray-200 animate-pulse'>
              {loadingMessage}
            </p>

            {/* Netflix风格测速进度显示 */}
            {speedTestProgress && speedTestProgress.total > 0 && (
              <>
                {/* 简单版本 - 用于上游兼容 */}
                {speedTestProgress.currentSource && !speedTestProgress.results && (
                  <SpeedTestProgress progress={{
                    current: speedTestProgress.current,
                    total: speedTestProgress.total,
                    currentSource: speedTestProgress.currentSource,
                    result: speedTestProgress.result
                  }} />
                )}

                {/* 复杂版本 - 当前实现 */}
                {speedTestProgress.currentSourceName && speedTestProgress.results && (
                  <div className='mt-6 w-full max-w-xl mx-auto space-y-4 pb-20'>
                    {/* 当前测速源和进度 */}
                    <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg p-4 shadow-lg'>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                          测速进度
                        </span>
                        <span className='text-sm font-bold text-red-600 dark:text-red-400'>
                          {speedTestProgress.current} / {speedTestProgress.total}
                        </span>
                      </div>

                      {/* Netflix风格进度条 */}
                      <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden mb-3'>
                        <div
                          className='h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-300 ease-out relative overflow-hidden'
                          style={{
                            width: `${(speedTestProgress.current / speedTestProgress.total) * 100}%`,
                          }}
                        >
                          {/* 闪烁效果 */}
                          <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer'></div>
                        </div>
                      </div>

                      {/* 当前测速源 */}
                      {speedTestProgress.currentSourceName && (
                        <div className='flex items-center space-x-2'>
                          {/* 脉动指示器 */}
                          <div className='relative'>
                            <div className='w-2 h-2 bg-red-500 rounded-full animate-pulse'></div>
                            <div className='absolute inset-0 w-2 h-2 bg-red-500 rounded-full animate-ping'></div>
                          </div>
                          <span className='text-sm text-gray-700 dark:text-gray-300'>
                            正在测速: <span className='font-semibold'>{speedTestProgress.currentSourceName}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 测速结果列表 */}
                    {speedTestProgress.results.length > 0 && (
                      <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg p-4 shadow-lg max-h-[45vh] overflow-y-auto'>
                        <div className='text-xs font-medium text-gray-600 dark:text-gray-400 mb-3'>
                          测速结果
                        </div>
                        <div className='space-y-2'>
                          {speedTestProgress.results.map((result, index) => (
                            <div
                              key={index}
                              className={`flex items-center justify-between p-2 rounded-md transition-all duration-200 ${result.status === 'success'
                                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                  : result.status === 'failed'
                                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                    : 'bg-gray-50 dark:bg-gray-700/50'
                                }`}
                            >
                              <div className='flex items-center space-x-2 flex-1 min-w-0'>
                                {result.status === 'success' ? (
                                  <svg className='w-4 h-4 text-green-600 dark:text-green-400 shrink-0' fill='currentColor' viewBox='0 0 20 20'>
                                    <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd' />
                                  </svg>
                                ) : (
                                  <svg className='w-4 h-4 text-red-600 dark:text-red-400 shrink-0' fill='currentColor' viewBox='0 0 20 20'>
                                    <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z' clipRule='evenodd' />
                                  </svg>
                                )}
                                <span className='text-xs font-medium text-gray-700 dark:text-gray-300 truncate'>
                                  {result.sourceName}
                                </span>
                              </div>

                              {result.status === 'success' && (
                                <div className='flex items-center space-x-3 text-xs text-gray-600 dark:text-gray-400 shrink-0'>
                                  {result.quality !== '未知' && (
                                    <span className='font-medium'>{result.quality}</span>
                                  )}
                                  {result.loadSpeed !== '未知' && (
                                    <span>{result.loadSpeed}</span>
                                  )}
                                  <span className='text-green-600 dark:text-green-400 font-medium'>
                                    {result.pingTime}ms
                                  </span>
                                </div>
                              )}

                              {result.status === 'failed' && (
                                <span className='text-xs text-red-600 dark:text-red-400 shrink-0'>
                                  测速失败
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
});

export default LoadingScreen;
