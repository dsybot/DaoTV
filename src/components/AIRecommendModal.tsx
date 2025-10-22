/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Brain, Send, Sparkles, X, Play, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  addMovieTitleClickListeners,
  AI_RECOMMEND_PRESETS,
  AIMessage,
  cleanMovieTitle,
  formatAIResponseWithLinks,
  generateChatSummary,
  generateSearchUrl,
  sendAIRecommendMessage,
  MovieRecommendation,
} from '@/lib/ai-recommend.client';

interface AIRecommendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExtendedAIMessage extends AIMessage {
  recommendations?: MovieRecommendation[];
  youtubeVideos?: any[];
  videoLinks?: any[];
  type?: string;
}

export default function AIRecommendModal({ isOpen, onClose }: AIRecommendModalProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ExtendedAIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string, details?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 从localStorage加载历史对话
  useEffect(() => {
    try {
      const cachedMessages = localStorage.getItem('ai-recommend-messages');
      if (cachedMessages) {
        const { messages: storedMessages, timestamp } = JSON.parse(cachedMessages);
        const now = new Date().getTime();
        // 30分钟缓存
        if (now - timestamp < 30 * 60 * 1000) {
          setMessages(storedMessages.map((msg: ExtendedAIMessage) => ({
            ...msg,
            timestamp: msg.timestamp || new Date().toISOString()
          })));
          return; // 有缓存就不显示欢迎消息
        } else {
          // 🔥 修复Bug #2: 超过30分钟时真正删除localStorage中的过期数据
          console.log('AI聊天记录已超过30分钟，自动清除缓存');
          localStorage.removeItem('ai-recommend-messages');
        }
      }

      // 没有有效缓存时显示欢迎消息
      const welcomeMessage: ExtendedAIMessage = {
        role: 'assistant',
        content: '你好！我是AI智能助手，支持以下功能：\n\n🎬 影视剧推荐 - 推荐电影、电视剧、动漫等\n🔗 视频链接解析 - 解析YouTube链接并播放\n📺 视频内容搜索 - 搜索相关视频内容\n\n💡 直接告诉我你想看什么类型的内容，或发送YouTube链接给我解析！',
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error("Failed to load messages from cache", error);
      // 发生错误时也清除可能损坏的缓存
      localStorage.removeItem('ai-recommend-messages');
    }
  }, []);

  // 保存对话到localStorage并滚动到底部
  useEffect(() => {
    scrollToBottom();
    try {
      // 🔥 修复Bug #1: 保持原有时间戳，不要每次都重置
      const existingCache = localStorage.getItem('ai-recommend-messages');
      let existingTimestamp = new Date().getTime(); // 默认当前时间

      if (existingCache) {
        try {
          const parsed = JSON.parse(existingCache);
          existingTimestamp = parsed.timestamp || existingTimestamp;
        } catch {
          // 解析失败时使用当前时间
        }
      }

      const cache = {
        messages,
        timestamp: existingTimestamp // 保持原有时间戳，不重置
      };
      localStorage.setItem('ai-recommend-messages', JSON.stringify(cache));
    } catch (error) {
      console.error("Failed to save messages to cache", error);
    }
  }, [messages]);

  // 处理片名点击搜索（保留用于文本中的链接点击）
  const handleTitleClick = (title: string) => {
    const cleanTitle = cleanMovieTitle(title);
    const searchUrl = generateSearchUrl(cleanTitle);
    router.push(searchUrl);
    onClose(); // 关闭对话框
  };

  // 处理推荐卡片点击
  const handleMovieSelect = (movie: MovieRecommendation) => {
    const searchQuery = encodeURIComponent(movie.title);
    router.push(`/search?q=${searchQuery}`);
    onClose(); // 关闭对话框
  };

  // 处理YouTube视频点击播放
  const handleYouTubeVideoSelect = (video: any) => {
    setPlayingVideoId(playingVideoId === video.id ? null : video.id);
  };

  // 处理视频链接解析结果
  const handleVideoLinkPlay = (video: any) => {
    if (video.playable && video.embedUrl) {
      setPlayingVideoId(playingVideoId === video.videoId ? null : video.videoId);
    }
  };

  // 发送消息
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: AIMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // 智能上下文管理：只发送最近8条消息（4轮对话）
      const updatedMessages = [...messages, userMessage];
      const conversationHistory = updatedMessages.slice(-8);

      const response = await sendAIRecommendMessage(conversationHistory);
      const assistantMessage: ExtendedAIMessage = {
        role: 'assistant',
        content: response.choices[0].message.content,
        timestamp: new Date().toISOString(),
        recommendations: response.recommendations || [],
        youtubeVideos: response.youtubeVideos || [],
        videoLinks: response.videoLinks || [],
        type: response.type || 'normal',
      };
      // 添加AI回复到完整的消息历史（不是截取的历史）
      setMessages([...updatedMessages, assistantMessage]);
    } catch (error) {
      console.error('AI推荐请求失败:', error);

      if (error instanceof Error) {
        // 尝试解析错误响应中的详细信息
        try {
          const errorResponse = JSON.parse(error.message);
          setError({
            message: errorResponse.error || error.message,
            details: errorResponse.details
          });
        } catch {
          setError({
            message: error.message,
            details: '如果问题持续，请联系管理员检查AI配置'
          });
        }
      } else {
        setError({
          message: '请求失败，请稍后重试',
          details: '未知错误，请检查网络连接'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 处理预设问题
  const handlePresetClick = (preset: { title: string; message: string }) => {
    sendMessage(preset.message);
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
    }
  };

  // 重置对话
  const resetChat = () => {
    // 清除localStorage缓存
    try {
      localStorage.removeItem('ai-recommend-messages');
    } catch (error) {
      console.error("Failed to clear messages cache", error);
    }

    // 重新显示欢迎消息
    const welcomeMessage: ExtendedAIMessage = {
      role: 'assistant',
      content: '你好！我是AI智能助手，支持以下功能：\n\n🎬 影视剧推荐 - 推荐电影、电视剧、动漫等\n🔗 视频链接解析 - 解析YouTube链接并播放\n📺 视频内容搜索 - 搜索相关视频内容\n\n💡 直接告诉我你想看什么类型的内容，或发送YouTube链接给我解析！',
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMessage]);
    setError(null);
    setInputMessage('');
  };

  // 不再需要为消息内容添加点击监听器，因为点击功能已移至右侧卡片

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="relative w-full max-w-4xl h-[80vh] mx-4 bg-white/25 dark:bg-gray-900/25 backdrop-blur-3xl rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/20 dark:border-gray-700/20">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/20 dark:border-gray-700/20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              {/* 机器人图标 */}
              <svg className="h-6 w-6 text-white" viewBox="0 0 1024 1024" fill="currentColor">
                <path d="M683.7 922.7h-345c-73.5 0-133.3-59.8-133.3-133.3V459.8c0-73.5 59.8-133.3 133.3-133.3h345c73.5 0 133.3 59.8 133.3 133.3v329.6c0 73.5-59.8 133.3-133.3 133.3z m-345-506.9c-24.3 0-44.1 19.8-44.1 44.1v329.6c0 24.3 19.8 44.1 44.1 44.1h345c24.3 0 44.1-19.8 44.1-44.1V459.8c0-24.3-19.8-44.1-44.1-44.1h-345zM914.3 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-20 44.6-44.6 44.6zM111.7 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-19.9 44.6-44.6 44.6z" />
                <path d="M511.2 415.8c-24.6 0-44.6-20-44.6-44.6V239.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6v131.9c0 24.6-20 44.6-44.6 44.6z" />
                <path d="M511.2 276.6c-49.2 0-89.2-40-89.2-89.2s40-89.2 89.2-89.2 89.2 40 89.2 89.2-40 89.2-89.2 89.2z m0-89.2h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0z m0 0h0.2-0.2z m0 0h0.2-0.2z m0-0.1h0.2-0.2zM399 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9s50.9 22.8 50.9 50.9c0 28.1-22.8 50.9-50.9 50.9zM622.9 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9 28.1 0 50.9 22.8 50.9 50.9 0 28.1-22.8 50.9-50.9 50.9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">AI 智能助手</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">影视推荐 · 视频解析 · YouTube搜索</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {messages.length > 0 && (
              <button
                onClick={resetChat}
                className="px-3 py-1.5 text-sm bg-gray-100/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200/80 dark:hover:bg-gray-600/80 transition-colors font-medium"
              >
                清空对话
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 消息区域 */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          {messages.length <= 1 && messages.every(msg => msg.role === 'assistant' && msg.content.includes('AI智能助手')) && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6 shadow-xl shadow-purple-500/30">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                欢迎使用AI智能助手
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                支持影视推荐、YouTube链接解析和视频搜索推荐
              </p>

              {/* 预设问题 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {AI_RECOMMEND_PRESETS.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => handlePresetClick(preset)}
                    className="p-4 text-left bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl border border-gray-200/60 dark:border-gray-600/60 hover:border-blue-400 dark:hover:border-purple-400 hover:shadow-lg hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all group"
                    disabled={isLoading}
                  >
                    <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-purple-400 transition-colors">
                      {preset.title}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 消息列表 */}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-lg ${message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                    : 'bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm text-gray-900 dark:text-gray-100 border border-gray-200/60 dark:border-gray-600/60'
                  }`}
              >
                {message.role === 'assistant' ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: formatAIResponseWithLinks(message.content, handleTitleClick),
                    }}
                    className="prose prose-sm dark:prose-invert max-w-none"
                  />
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </div>

              {/* 推荐影片卡片 */}
              {message.role === 'assistant' && message.recommendations && message.recommendations.length > 0 && (
                <div className="mt-4 space-y-3 max-w-[80%]">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold mr-2">
                        🎬 点击搜索
                      </span>
                      推荐影片卡片
                    </div>
                    <span className="text-gray-400 dark:text-gray-500">
                      {message.recommendations.length < 4
                        ? `显示 ${message.recommendations.length} 个推荐`
                        : `显示前 4 个推荐`
                      }
                    </span>
                  </div>
                  {message.recommendations.map((movie, index) => (
                    <div
                      key={index}
                      onClick={() => handleMovieSelect(movie)}
                      className="p-4 bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-600/60 rounded-xl cursor-pointer hover:shadow-lg hover:border-blue-400 dark:hover:border-purple-500 hover:bg-white dark:hover:bg-gray-700 transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        {movie.poster && (
                          <img
                            src={movie.poster}
                            alt={movie.title}
                            className="w-12 h-16 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm flex items-center mb-1">
                            {movie.title}
                            {movie.year && (
                              <span className="text-gray-500 dark:text-gray-400 ml-1.5">({movie.year})</span>
                            )}
                            <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 text-xs">
                              🔍 搜索
                            </span>
                          </h4>
                          {movie.genre && (
                            <p className="text-xs text-blue-600 dark:text-purple-400 mb-1.5 font-medium">{movie.genre}</p>
                          )}
                          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
                            {movie.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* YouTube视频推荐卡片 */}
              {message.role === 'assistant' && message.youtubeVideos && message.youtubeVideos.length > 0 && (
                <div className="mt-4 space-y-3 max-w-[80%]">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/50 dark:to-pink-900/50 text-red-600 dark:text-pink-400 px-2 py-1 rounded-full text-xs font-medium mr-2">
                        📺 点击播放
                      </span>
                      YouTube视频推荐
                    </div>
                    <span className="text-gray-400 dark:text-gray-500">
                      {message.youtubeVideos.length} 个视频
                    </span>
                  </div>
                  {message.youtubeVideos.map((video, index) => (
                    <div key={index} className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                      {playingVideoId === video.id ? (
                        <div className="relative">
                          <div className="aspect-video">
                            <iframe
                              src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                              title={video.title}
                            />
                          </div>
                          <button
                            onClick={() => setPlayingVideoId(null)}
                            className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-70 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="p-4">
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1.5">{video.title}</h4>
                            <p className="text-xs text-red-600 dark:text-red-400">{video.channelTitle}</p>
                          </div>
                        </div>
                      ) : (
                        <div onClick={() => handleYouTubeVideoSelect(video)} className="p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                          <div className="flex items-start gap-4">
                            <div className="relative">
                              <img src={video.thumbnail} alt={video.title} className="w-16 h-12 object-cover rounded flex-shrink-0" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded">
                                <div className="bg-red-600 text-white rounded-full p-1">
                                  <Play className="w-3 h-3" />
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2 mb-1">{video.title}</h4>
                              <p className="text-xs text-red-600 dark:text-red-400 mb-1.5">{video.channelTitle}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">{video.description}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 视频链接解析卡片 */}
              {message.role === 'assistant' && message.videoLinks && message.videoLinks.length > 0 && (
                <div className="mt-4 space-y-3 max-w-[80%]">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-600 dark:text-emerald-400 px-2 py-1 rounded-full text-xs font-medium mr-2">
                        🔗 链接解析
                      </span>
                      视频链接解析结果
                    </div>
                    <span className="text-gray-400 dark:text-gray-500">
                      {message.videoLinks.length} 个链接
                    </span>
                  </div>
                  {message.videoLinks.map((video, index) => (
                    <div key={index} className="border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-md">
                      {video.playable ? (
                        <div className="space-y-3">
                          {playingVideoId === video.videoId ? (
                            <div className="relative">
                              <div className="aspect-video">
                                <iframe
                                  src={video.embedUrl}
                                  className="w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                  title={video.title}
                                />
                              </div>
                              <button
                                onClick={() => setPlayingVideoId(null)}
                                className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-70 transition-opacity"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <div className="p-3">
                                <h4 className="font-medium text-gray-900 dark:text-white text-sm">{video.title}</h4>
                                <p className="text-xs text-green-600 dark:text-emerald-400 mt-1">{video.channelName}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <div className="relative cursor-pointer" onClick={() => handleVideoLinkPlay(video)}>
                                <img
                                  src={video.thumbnail}
                                  alt={video.title}
                                  className="w-20 h-15 object-cover rounded"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded">
                                  <div className="bg-green-600 text-white rounded-full p-2">
                                    <Play className="w-4 h-4" />
                                  </div>
                                </div>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                  {video.title}
                                </h4>
                                <p className="text-sm text-green-600 dark:text-emerald-400">
                                  {video.channelName}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  原链接: {video.originalUrl}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            {playingVideoId !== video.videoId && (
                              <button
                                onClick={() => handleVideoLinkPlay(video)}
                                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg flex items-center gap-2 text-sm shadow-md hover:shadow-lg transition-all"
                              >
                                <Play className="w-4 h-4" />
                                直接播放
                              </button>
                            )}
                            <button
                              onClick={() => window.open(video.originalUrl, '_blank')}
                              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2 text-sm shadow-md hover:shadow-lg transition-all"
                            >
                              <ExternalLink className="w-4 h-4" />
                              原始链接
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-red-600 dark:text-red-400">
                          <p className="font-medium">解析失败</p>
                          <p className="text-sm">{video.error}</p>
                          <p className="text-xs mt-1">原链接: {video.originalUrl}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* 加载状态 */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm p-3 rounded-2xl border border-gray-200/60 dark:border-gray-600/60 shadow-md">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-xl">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                    {error.message}
                  </h3>
                  {error.details && (
                    <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                      <p>{error.details}</p>
                    </div>
                  )}
                  <div className="mt-3">
                    <button
                      onClick={() => setError(null)}
                      className="text-sm bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-800 dark:text-red-200 px-3 py-1 rounded-md transition-colors"
                    >
                      关闭
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="px-6 py-4 border-t border-gray-200/20 dark:border-gray-700/20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入影视推荐类型、YouTube搜索内容或直接粘贴YouTube链接..."
                className="w-full px-4 py-3 border border-gray-200/60 dark:border-gray-600/60 rounded-xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-700 resize-none transition-all shadow-sm"
                rows={2}
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all flex items-center space-x-2 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
            >
              <Send className="h-4 w-4" />
              <span>发送</span>
            </button>
          </form>

          {/* 提示信息 */}
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>💡 支持影视推荐、YouTube链接解析和视频搜索</span>
            <span>按 Enter 发送，Shift+Enter 换行</span>
          </div>
        </div>
      </div>
    </div>
  );
}