'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { M3U8DownloadTask, parseM3U8, downloadM3U8Video, PauseResumeController } from '@/lib/download';
import type { DownloadProgress } from '@/lib/download';

interface DownloadContextType {
  tasks: M3U8DownloadTask[];
  showDownloadPanel: boolean;
  setShowDownloadPanel: (show: boolean) => void;
  createTask: (url: string, title: string, type?: 'TS' | 'MP4') => Promise<void>;
  startTask: (taskId: string) => Promise<void>;
  pauseTask: (taskId: string) => void;
  cancelTask: (taskId: string) => void;
  retryFailedSegments: (taskId: string) => void;
  getProgress: (taskId: string) => number;
  isEnabled: boolean | null; // 下载功能是否启用，null 表示加载中
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<M3U8DownloadTask[]>([]);
  const [showDownloadPanel, setShowDownloadPanel] = useState(false);
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null); // null 表示加载中

  // 获取下载配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/admin/download-config', {
          cache: 'no-store', // 禁用缓存，确保获取最新配置
        });
        if (response.ok) {
          const data = await response.json();
          setIsEnabled(data.enabled ?? true);
        } else {
          // API 失败时默认启用
          setIsEnabled(true);
        }
      } catch (error) {
        console.error('获取下载配置失败:', error);
        // 出错时默认启用
        setIsEnabled(true);
      }
    };
    fetchConfig();
  }, []);

  // 存储每个任务的控制器和 AbortController
  const taskControllers = useRef<Map<string, {
    pauseController: PauseResumeController;
    abortController: AbortController;
  }>>(new Map());

  const updateTask = useCallback((taskId: string, updates: Partial<M3U8DownloadTask>) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    ));
  }, []);

  const createTask = useCallback(
    async (url: string, title: string, type: 'TS' | 'MP4' = 'TS') => {
      try {
        // 解析 M3U8
        const m3u8Task = await parseM3U8(url);

        // 创建任务对象
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newTask: M3U8DownloadTask = {
          ...m3u8Task,
          id: taskId,
          title,
          type,
          status: 'ready',
        };

        setTasks(prev => [...prev, newTask]);

        // 自动开始下载
        await startTask(taskId);

        // 显示下载面板
        setShowDownloadPanel(true);
      } catch (error) {
        console.error('创建下载任务失败:', error);
        throw error;
      }
    },
    []
  );

  const startTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // 创建新的控制器
      const pauseController = new PauseResumeController();
      const abortController = new AbortController();
      taskControllers.current.set(taskId, { pauseController, abortController });

      // 更新状态为下载中
      updateTask(taskId, { status: 'downloading' });

      try {
        // 开始下载
        await downloadM3U8Video(
          task,
          (progress: DownloadProgress) => {
            // 更新进度
            updateTask(taskId, {
              finishNum: progress.current,
              downloadIndex: progress.current,
            });
          },
          abortController.signal,
          pauseController,
          6, // 并发数
          'disabled', // 暂时禁用流式保存
          3 // 重试次数
        );

        // 下载完成
        updateTask(taskId, { status: 'done' });
        console.log('下载完成:', task.title);
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          // 用户取消
          console.log('下载已取消:', task.title);
        } else {
          // 下载错误
          console.error('下载错误:', task.title, error);
          updateTask(taskId, { status: 'error' });
        }
      } finally {
        // 清理控制器
        taskControllers.current.delete(taskId);
      }
    },
    [tasks, updateTask]
  );

  const pauseTask = useCallback(
    (taskId: string) => {
      const controllers = taskControllers.current.get(taskId);
      if (controllers) {
        controllers.pauseController.pause();
        updateTask(taskId, { status: 'pause' });
      }
    },
    [updateTask]
  );

  const cancelTask = useCallback(
    (taskId: string) => {
      const controllers = taskControllers.current.get(taskId);
      if (controllers) {
        controllers.abortController.abort();
        taskControllers.current.delete(taskId);
      }

      // 从任务列表中移除
      setTasks(prev => prev.filter(task => task.id !== taskId));
    },
    []
  );

  const retryFailedSegments = useCallback(
    async (taskId: string) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // 重置错误计数
      updateTask(taskId, { errorNum: 0 });

      // 重新开始下载
      await startTask(taskId);
    },
    [tasks, updateTask, startTask]
  );

  const getProgress = useCallback((taskId: string): number => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return 0;

    const total = task.rangeDownload.targetSegment;
    if (total === 0) return 0;

    return (task.finishNum / total) * 100;
  }, [tasks]);

  return (
    <DownloadContext.Provider
      value={{
        tasks,
        showDownloadPanel,
        setShowDownloadPanel,
        createTask,
        startTask,
        pauseTask,
        cancelTask,
        retryFailedSegments,
        getProgress,
        isEnabled,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  const context = useContext(DownloadContext);
  if (context === undefined) {
    throw new Error('useDownload must be used within a DownloadProvider');
  }
  return context;
}
