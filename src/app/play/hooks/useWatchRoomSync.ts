// 观影室播放同步Hook
import { useEffect, useRef } from 'react';
import type { WatchRoomContextType } from '@/components/WatchRoomProvider';

interface UseWatchRoomSyncOptions {
  watchRoom: WatchRoomContextType | null;
  artPlayerRef: React.MutableRefObject<any>;
  detail: any;
  episodeIndex: number;
}

export function useWatchRoomSync({ watchRoom, artPlayerRef, detail, episodeIndex }: UseWatchRoomSyncOptions) {
  const isSyncingRef = useRef(false);
  const lastSyncTimeRef = useRef(0);

  useEffect(() => {
    if (!watchRoom?.currentRoom || !watchRoom?.isOwner || !artPlayerRef.current || !watchRoom?.socket) {
      return;
    }

    const player = artPlayerRef.current;

    // 房主：同步播放状态到其他成员
    const handlePlay = () => {
      if (!watchRoom.isOwner) return;
      console.log('[WatchRoomSync] Owner: play');
      watchRoom.play();
    };

    const handlePause = () => {
      if (!watchRoom.isOwner) return;
      console.log('[WatchRoomSync] Owner: pause');
      watchRoom.pause();
    };

    const handleSeeking = () => {
      if (!watchRoom.isOwner || isSyncingRef.current) return;
      const currentTime = player.currentTime;
      const now = Date.now();

      // 限制同步频率：每500ms最多同步一次
      if (now - lastSyncTimeRef.current < 500) return;
      lastSyncTimeRef.current = now;

      console.log('[WatchRoomSync] Owner: seek to', currentTime);
      watchRoom.seekPlayback(currentTime);
    };

    // 监听播放器事件
    player.on('play', handlePlay);
    player.on('pause', handlePause);
    player.on('seeking', handleSeeking);

    return () => {
      player.off('play', handlePlay);
      player.off('pause', handlePause);
      player.off('seeking', handleSeeking);
    };
  }, [watchRoom?.currentRoom, watchRoom?.isOwner, artPlayerRef.current, watchRoom?.socket]);

  // 非房主：接收并同步播放状态
  useEffect(() => {
    if (!watchRoom?.currentRoom || watchRoom?.isOwner || !artPlayerRef.current || !watchRoom?.socket) {
      return;
    }

    const player = artPlayerRef.current;
    const socket = watchRoom.socket;

    // 接收播放指令
    const handlePlayEvent = () => {
      console.log('[WatchRoomSync] Member: received play');
      if (player.paused) {
        isSyncingRef.current = true;
        player.play().finally(() => {
          isSyncingRef.current = false;
        });
      }
    };

    // 接收暂停指令
    const handlePauseEvent = () => {
      console.log('[WatchRoomSync] Member: received pause');
      if (!player.paused) {
        isSyncingRef.current = true;
        player.pause();
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      }
    };

    // 接收跳转指令
    const handleSeekEvent = (currentTime: number) => {
      console.log('[WatchRoomSync] Member: received seek to', currentTime);
      const diff = Math.abs(player.currentTime - currentTime);

      // 只有时间差超过2秒才同步
      if (diff > 2) {
        isSyncingRef.current = true;
        player.seek = currentTime;
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      }
    };

    // 接收切换视频指令
    const handleChangeEvent = (state: any) => {
      console.log('[WatchRoomSync] Member: received video change', state);

      // 检查是否是同一个视频
      if (detail && state.videoId === detail.vod_id && state.episodeIndex === episodeIndex) {
        // 已经在播放这个视频，只同步时间
        if (state.currentTime !== undefined) {
          isSyncingRef.current = true;
          player.seek = state.currentTime;
          setTimeout(() => {
            isSyncingRef.current = false;
          }, 100);
        }
      } else {
        // 需要切换视频 - 提示用户
        const episodeName = state.episodeName || `第${state.episodeIndex + 1}集`;
        if (confirm(`房主切换到了 ${state.videoName} ${episodeName}，是否跟随切换？`)) {
          // 跳转到相应的播放页面
          const url = `/play?id=${state.videoId}&source=${encodeURIComponent(state.source)}&index=${state.episodeIndex}`;
          window.location.href = url;
        }
      }
    };

    // 监听socket事件
    socket.on('play:play', handlePlayEvent);
    socket.on('play:pause', handlePauseEvent);
    socket.on('play:seek', handleSeekEvent);
    socket.on('play:change', handleChangeEvent);

    return () => {
      socket.off('play:play', handlePlayEvent);
      socket.off('play:pause', handlePauseEvent);
      socket.off('play:seek', handleSeekEvent);
      socket.off('play:change', handleChangeEvent);
    };
  }, [watchRoom?.currentRoom, watchRoom?.isOwner, artPlayerRef.current, watchRoom?.socket, detail, episodeIndex]);

  // 房主：切换视频时同步状态
  useEffect(() => {
    if (!watchRoom?.currentRoom || !watchRoom?.isOwner || !detail || !artPlayerRef.current) {
      return;
    }

    const player = artPlayerRef.current;

    // 发送视频切换状态
    const syncState = {
      videoId: detail.vod_id,
      videoName: detail.vod_name,
      source: detail.type_name || '',
      episodeIndex: episodeIndex,
      episodeName: detail.vod_play_list?.[episodeIndex] || `第${episodeIndex + 1}集`,
      currentTime: player.currentTime || 0,
      paused: player.paused,
      timestamp: Date.now(),
    };

    console.log('[WatchRoomSync] Owner: sending video change state', syncState);
    watchRoom.changeVideo(syncState);
  }, [detail?.vod_id, episodeIndex, watchRoom?.currentRoom?.id, watchRoom?.isOwner]);
}
