/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWatchRoom } from '@/hooks/useWatchRoom';
import type { Room, Member, ChatMessage } from '@/types/watch-room.types';

interface WatchRoomContextType {
  isConnected: boolean;
  currentRoom: Room | null;
  members: Member[];
  chatMessages: ChatMessage[];
  isOwner: boolean;
  isEnabled: boolean;

  // 房间操作
  createRoom: (data: {
    name: string;
    description: string;
    password?: string;
    isPublic: boolean;
    userName: string;
  }) => Promise<Room>;
  joinRoom: (data: {
    roomId: string;
    password?: string;
    userName: string;
  }) => Promise<{ room: Room; members: Member[] }>;
  leaveRoom: () => void;
  getRoomList: () => Promise<Room[]>;

  // 聊天
  sendChatMessage: (content: string, type?: 'text' | 'emoji') => void;

  // 播放控制
  updatePlayState: (state: any) => void;
  seekPlayback: (currentTime: number) => void;
  play: () => void;
  pause: () => void;
  changeVideo: (state: any) => void;
  clearRoomState: () => void;
}

const WatchRoomContext = createContext<WatchRoomContextType | null>(null);

export const useWatchRoomContext = () => {
  const context = useContext(WatchRoomContext);
  if (!context) {
    throw new Error('useWatchRoomContext must be used within WatchRoomProvider');
  }
  return context;
};

// 安全版本，可以在非 Provider 内使用
export const useWatchRoomContextSafe = () => {
  return useContext(WatchRoomContext);
};

interface WatchRoomProviderProps {
  children: React.ReactNode;
}

export function WatchRoomProvider({ children }: WatchRoomProviderProps) {
  const [config, setConfig] = useState<{ enabled: boolean; serverUrl: string } | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [authKey, setAuthKey] = useState('');

  const watchRoom = useWatchRoom({
    serverUrl: config?.serverUrl || '',
    authKey: authKey,
    userName: '游客',
    onError: (error) => console.error('[WatchRoom] Error:', error),
    onDisconnect: () => console.log('[WatchRoom] Disconnected'),
  });

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/watch-room/config');
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
          setIsEnabled(data.enabled === true);

          // 如果需要 authKey，从完整配置API获取
          if (data.enabled && data.serverUrl) {
            try {
              const authResponse = await fetch('/api/watch-room/config', {
                method: 'POST',
              });
              if (authResponse.ok) {
                const authData = await authResponse.json();
                setAuthKey(authData.authKey || '');
              }
            } catch (error) {
              console.error('[WatchRoom] Failed to load auth key:', error);
            }
          }
        } else {
          console.error('[WatchRoom] Failed to load config:', response.status);
          setIsEnabled(false);
        }
      } catch (error) {
        console.error('[WatchRoom] Error loading config:', error);
        setIsEnabled(false);
      }
    };

    loadConfig();
  }, []);

  // 连接到服务器
  useEffect(() => {
    if (isEnabled && config?.serverUrl && authKey) {
      console.log('[WatchRoom] Connecting to server...');
      watchRoom.connect();
    }

    return () => {
      if (watchRoom.disconnect) {
        watchRoom.disconnect();
      }
    };
  }, [isEnabled, config, authKey]);

  const contextValue: WatchRoomContextType = {
    isConnected: watchRoom.connected,
    currentRoom: watchRoom.currentRoom,
    members: watchRoom.members,
    chatMessages: watchRoom.messages,
    isOwner: watchRoom.isOwner,
    isEnabled,
    createRoom: async (data) => {
      const result = await watchRoom.createRoom(data);
      if (!result.success || !result.room) {
        throw new Error(result.error || '创建房间失败');
      }
      return result.room;
    },
    joinRoom: async (data) => {
      const result = await watchRoom.joinRoom(data.roomId, data.password);
      if (!result.success || !result.room || !result.members) {
        throw new Error(result.error || '加入房间失败');
      }
      return { room: result.room, members: result.members };
    },
    leaveRoom: watchRoom.leaveRoom,
    getRoomList: watchRoom.getRoomList,
    sendChatMessage: watchRoom.sendMessage,
    updatePlayState: watchRoom.updatePlayState,
    seekPlayback: watchRoom.seekTo,
    play: watchRoom.play,
    pause: watchRoom.pause,
    changeVideo: watchRoom.changeVideo,
    clearRoomState: async () => {
      const result = await watchRoom.clearState();
      if (!result.success) {
        throw new Error(result.error || '清除状态失败');
      }
    },
  };

  return (
    <WatchRoomContext.Provider value={contextValue}>
      {children}
    </WatchRoomContext.Provider>
  );
}
