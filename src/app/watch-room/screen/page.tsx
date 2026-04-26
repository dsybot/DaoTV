'use client';

import { Monitor, MonitorPlay, Users, ArrowLeft, Wifi, WifiOff, Clock, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useWatchRoomContext } from '@/components/WatchRoomProvider';
import PageLayout from '@/components/PageLayout';
import { useScreenShare, screenShareQualityOptions, type ScreenShareQualityPreset } from '@/hooks/useScreenShare';

const NEW_TAB_KEY_PREFIX = 'watch_room_screen_home_opened_';
const WATCH_ROOM_NO_CONNECT_KEY = 'watch_room_no_connect';
const SCREEN_SHARE_QUALITY_KEY = 'watch_room_screen_quality';

function getScreenShareHostSupportError() {
  if (typeof window === 'undefined') return null;

  if (!window.isSecureContext) {
    return '当前环境不是安全上下文（HTTPS/localhost），不支持屏幕共享';
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    return '当前浏览器不支持屏幕共享';
  }

  if (typeof window.RTCPeerConnection === 'undefined') {
    return '当前浏览器不支持实时屏幕传输';
  }

  return null;
}

function getScreenShareViewerSupportError() {
  if (typeof window === 'undefined') return null;

  if (typeof window.RTCPeerConnection === 'undefined') {
    return '当前浏览器不支持实时屏幕传输';
  }

  return null;
}

export default function WatchRoomScreenPage() {
  const router = useRouter();
  const watchRoom = useWatchRoomContext();
  const { currentRoom, members, leaveRoom } = watchRoom;
  const [qualityPreset, setQualityPreset] = useState<ScreenShareQualityPreset>('smooth');
  const [showNewTabTip, setShowNewTabTip] = useState(false);
  const [sharingDuration, setSharingDuration] = useState(0);

  const {
    currentRoom: screenRoom,
    isOwner,
    isSharing,
    isStarting,
    error,
    captureSettings,
    localVideoRef,
    remoteVideoRef,
    startSharing,
    stopSharing,
  } = useScreenShare(qualityPreset);

  const openDetachedPage = useCallback(() => {
    window.open('/', '_blank', 'noopener,noreferrer');
    setShowNewTabTip(false);
  }, []);

  // 加载保存的画质设置
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(SCREEN_SHARE_QUALITY_KEY);
    if (saved === 'smooth' || saved === 'hd' || saved === 'ultra') {
      setQualityPreset(saved);
    }
  }, []);

  // 保存画质设置
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SCREEN_SHARE_QUALITY_KEY, qualityPreset);
  }, [qualityPreset]);

  // 检查房间类型
  useEffect(() => {
    if (!currentRoom) {
      router.replace('/watch-room');
      return;
    }

    if (currentRoom.roomType !== 'screen') {
      router.replace('/watch-room');
    }
  }, [currentRoom, router]);

  // 检查浏览器支持
  useEffect(() => {
    if (!screenRoom || screenRoom.roomType !== 'screen') return;

    const supportError = isOwner
      ? getScreenShareHostSupportError()
      : getScreenShareViewerSupportError();

    if (supportError) {
      alert(`当前设备无法使用屏幕共享房间：${supportError}`);
      leaveRoom();
      router.replace('/watch-room');
    }
  }, [isOwner, leaveRoom, router, screenRoom]);

  // 房主进入时显示提示
  useEffect(() => {
    if (!screenRoom || !isOwner) return;

    // 显示提示，让用户知道可以打开新标签页
    setShowNewTabTip(true);
  }, [isOwner, screenRoom?.id]);

  // 计算共享时长
  useEffect(() => {
    if (!isSharing || !screenRoom?.currentState || screenRoom.currentState.type !== 'screen') {
      setSharingDuration(0);
      return;
    }

    const startTime = screenRoom.currentState.startedAt;
    const updateDuration = () => {
      setSharingDuration(Math.floor((Date.now() - startTime) / 1000));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [isSharing, screenRoom?.currentState]);

  if (!screenRoom || screenRoom.roomType !== 'screen') {
    return null;
  }

  const handleLeave = () => {
    if (isOwner && isSharing) {
      stopSharing(true);
    }
    leaveRoom();
    router.push('/watch-room');
  };

  const captureSettingsText = captureSettings
    ? [
        captureSettings.width && captureSettings.height
          ? `${captureSettings.width}x${captureSettings.height}`
          : '分辨率未知',
        captureSettings.frameRate ? `${Math.round(captureSettings.frameRate)} fps` : '帧率未知',
      ].join(' / ')
    : '未开始';

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const viewerCount = members.filter(m => !m.isOwner).length;

  return (
    <PageLayout>
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-4 py-4 lg:px-8">
          {/* 新标签页提示 */}
          {isOwner && showNewTabTip && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 dark:bg-blue-900/20 dark:border-blue-800">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    💡 提示：建议打开新标签页继续浏览
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    本页面用于控制屏幕共享，请保持打开。你可以打开新标签页去选择视频或浏览其他内容。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openDetachedPage}
                    className="shrink-0 rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 transition-colors"
                  >
                    打开新标签页
                  </button>
                  <button
                    onClick={() => setShowNewTabTip(false)}
                    className="shrink-0 rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    知道了
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 头部 */}
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                <Monitor className="h-6 w-6 text-blue-500" />
                屏幕共享观影室
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                房间：{screenRoom.name} · 房主：{screenRoom.ownerName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <button
                  onClick={openDetachedPage}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 transition-colors"
                >
                  新开主页
                </button>
              )}
              <button
                onClick={handleLeave}
                className="rounded-lg bg-gray-200 px-4 py-2 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                离开房间
              </button>
            </div>
          </div>

          {/* 主内容区 */}
          <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
            {/* 视频区域 */}
            <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-black dark:border-gray-700">
              {isOwner ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full bg-black object-contain"
                />
              ) : (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  controls
                  className="h-full w-full bg-black object-contain"
                />
              )}

              {/* 状态指示器 */}
              {isSharing && (
                <div className="absolute left-4 top-4 flex items-center gap-3">
                  {/* 共享中指示 */}
                  <div className="flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
                    </span>
                    共享中
                  </div>

                  {/* 时长 */}
                  {isOwner && (
                    <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(sharingDuration)}
                    </div>
                  )}

                  {/* 观看人数 */}
                  {isOwner && viewerCount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
                      <Eye className="h-3.5 w-3.5" />
                      {viewerCount} 人观看
                    </div>
                  )}
                </div>
              )}

              {/* 连接状态 */}
              <div className="absolute right-4 top-4">
                {isSharing ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-green-500/90 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
                    <Wifi className="h-3.5 w-3.5" />
                    已连接
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-full bg-gray-500/90 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
                    <WifiOff className="h-3.5 w-3.5" />
                    未连接
                  </div>
                )}
              </div>

              {!isSharing && (
                <div className="absolute px-6 text-center text-white">
                  <div className="mb-4 inline-flex rounded-full bg-white/10 p-6 backdrop-blur-sm">
                    <MonitorPlay className="h-16 w-16 text-white/90" />
                  </div>
                  <p className="text-xl font-medium">
                    {isOwner ? '点击开始共享，向房员推送浏览器画面' : '等待房主开始共享屏幕'}
                  </p>
                  {isOwner && (
                    <p className="mt-3 text-sm text-white/70">
                      本页不要关闭；已尝试为你新开一个主页标签页方便继续浏览。
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 侧边栏 */}
            <div className="space-y-4">
              {/* 共享状态 */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">共享状态</h2>

                {/* 状态卡片 */}
                <div className="mb-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/50">
                    <span className="text-sm text-gray-600 dark:text-gray-400">类型</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">屏幕共享</span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/50">
                    <span className="text-sm text-gray-600 dark:text-gray-400">状态</span>
                    <span className={`font-medium ${isSharing ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {isSharing ? '共享中' : '未开始'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/50">
                    <span className="text-sm text-gray-600 dark:text-gray-400">成员</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{members.length} 人</span>
                  </div>

                  {isOwner && isSharing && (
                    <>
                      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/50">
                        <span className="text-sm text-gray-600 dark:text-gray-400">观看人数</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">{viewerCount} 人</span>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/50">
                        <span className="text-sm text-gray-600 dark:text-gray-400">共享时长</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{formatDuration(sharingDuration)}</span>
                      </div>
                    </>
                  )}
                </div>

                {isOwner && (
                  <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                    <div className="font-medium">实际采集</div>
                    <div className="mt-0.5">{captureSettingsText}</div>
                  </div>
                )}

                {error && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {error}
                  </div>
                )}

                {/* 画质选择 */}
                {isOwner && (
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      共享画质
                    </label>
                    <select
                      value={qualityPreset}
                      onChange={(e) => setQualityPreset(e.target.value as ScreenShareQualityPreset)}
                      disabled={isStarting || isSharing}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:disabled:bg-gray-800"
                    >
                      {screenShareQualityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      画质越高越清晰，但更依赖网络和设备性能。共享开始后不可切换。
                    </p>
                  </div>
                )}

                {/* 控制按钮 */}
                <div className="flex gap-3">
                  {isOwner ? (
                    <>
                      <button
                        onClick={() => startSharing()}
                        disabled={isStarting || isSharing}
                        className="group flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-3.5 font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40 disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none"
                      >
                        <span className="flex items-center justify-center gap-2">
                          {isStarting ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                              启动中...
                            </>
                          ) : isSharing ? (
                            <>
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
                              </span>
                              共享中
                            </>
                          ) : (
                            <>
                              <MonitorPlay className="h-4 w-4" />
                              开始共享
                            </>
                          )}
                        </span>
                      </button>
                      <button
                        onClick={() => stopSharing(true)}
                        disabled={!isSharing}
                        className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-3.5 font-medium text-white shadow-lg shadow-red-500/30 transition-all hover:shadow-xl hover:shadow-red-500/40 disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none"
                      >
                        停止
                      </button>
                    </>
                  ) : (
                    <div className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                      房员无需操作，房主开始共享后会自动显示画面。
                    </div>
                  )}
                </div>
              </div>

              {/* 成员列表 */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  <Users className="h-5 w-5" />
                  房间成员
                </h2>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 transition-colors hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-sm font-medium text-white">
                          {member.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{member.name}</span>
                      </div>
                      {member.isOwner && (
                        <span className="rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
                          房主
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 提示 */}
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 text-sm text-blue-800 shadow-sm dark:border-blue-800 dark:from-blue-900/20 dark:to-indigo-900/20 dark:text-blue-200">
                <div className="mb-1 font-medium">💡 使用建议</div>
                建议使用桌面版 Chrome / Edge，并优先共享标签页。
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
