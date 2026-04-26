/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AdminConfig } from '@/lib/admin.types';
import ToggleSwitch from '@/components/ToggleSwitch';

interface YouTubeConfigProps {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}

const YouTubeConfig = ({ config, refreshConfig }: YouTubeConfigProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [youtubeSettings, setYoutubeSettings] = useState({
    enabled: false,
    apiKey: '',
    enableDemo: true,
    maxResults: 25,
    enabledRegions: ['US', 'CN', 'JP', 'KR', 'GB', 'DE', 'FR'],
    enabledCategories: ['Film & Animation', 'Music', 'Gaming', 'News & Politics', 'Entertainment']
  });

  // 可选地区列表
  const AVAILABLE_REGIONS = [
    { code: 'US', name: '美国' },
    { code: 'CN', name: '中国' },
    { code: 'JP', name: '日本' },
    { code: 'KR', name: '韩国' },
    { code: 'GB', name: '英国' },
    { code: 'DE', name: '德国' },
    { code: 'FR', name: '法国' },
    { code: 'CA', name: '加拿大' },
    { code: 'AU', name: '澳大利亚' },
    { code: 'IN', name: '印度' }
  ];

  // 可选分类列表
  const AVAILABLE_CATEGORIES = [
    'Film & Animation',
    'Autos & Vehicles', 
    'Music',
    'Pets & Animals',
    'Sports',
    'Travel & Events',
    'Gaming',
    'People & Blogs',
    'Comedy',
    'Entertainment',
    'News & Politics',
    'Howto & Style',
    'Education',
    'Science & Technology',
    'Nonprofits & Activism'
  ];

  // 从config加载设置
  useEffect(() => {
    if (config?.YouTubeConfig) {
      setYoutubeSettings({
        enabled: config.YouTubeConfig.enabled ?? false,
        apiKey: config.YouTubeConfig.apiKey || '',
        enableDemo: config.YouTubeConfig.enableDemo ?? true,
        maxResults: config.YouTubeConfig.maxResults ?? 25,
        enabledRegions: config.YouTubeConfig.enabledRegions ?? ['US', 'CN', 'JP', 'KR', 'GB', 'DE', 'FR'],
        enabledCategories: config.YouTubeConfig.enabledCategories ?? ['Film & Animation', 'Music', 'Gaming', 'News & Politics', 'Entertainment']
      });
    }
  }, [config]);

  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 保存YouTube配置
  const handleSave = async () => {
    // 基本验证
    if (youtubeSettings.enabled && !youtubeSettings.enableDemo) {
      if (!youtubeSettings.apiKey.trim()) {
        showMessage('error', '请填写YouTube API密钥或启用演示模式');
        return;
      }
    }

    if (youtubeSettings.maxResults < 1 || youtubeSettings.maxResults > 50) {
      showMessage('error', '最大结果数应在1-50之间');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(youtubeSettings)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存失败');
      }

      showMessage('success', 'YouTube配置保存成功');
      await refreshConfig();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 切换地区选择
  const toggleRegion = (regionCode: string) => {
    setYoutubeSettings(prev => ({
      ...prev,
      enabledRegions: prev.enabledRegions.includes(regionCode)
        ? prev.enabledRegions.filter(r => r !== regionCode)
        : [...prev.enabledRegions, regionCode]
    }));
  };

  // 切换分类选择
  const toggleCategory = (category: string) => {
    setYoutubeSettings(prev => ({
      ...prev,
      enabledCategories: prev.enabledCategories.includes(category)
        ? prev.enabledCategories.filter(c => c !== category)
        : [...prev.enabledCategories, category]
    }));
  };

  return (
    <div className='space-y-6'>
      {/* 消息提示 */}
      {message && (
        <div className={`flex items-center space-x-2 p-3 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}
      
      {/* 基础设置 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm'>
        <div className='mb-6'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2'>YouTube搜索配置</h3>
          <div className='flex items-center space-x-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg'>
            <svg className='h-4 w-4' fill='currentColor' viewBox='0 0 20 20'>
              <path fillRule='evenodd' d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z' clipRule='evenodd' />
            </svg>
            <span>📺 支持YouTube官方API或演示模式，让用户直接搜索和观看YouTube视频</span>
          </div>
        </div>

        {/* 启用开关 */}
        <div className='mb-6'>
          <div className='flex items-center'>
            <ToggleSwitch
              checked={youtubeSettings.enabled}
              color='red'
              onChange={(checked) =>
                setYoutubeSettings((prev) => ({ ...prev, enabled: checked }))
              }
            />
            <span className='ml-3 text-sm font-medium text-gray-900 dark:text-gray-100'>
              启用YouTube搜索功能
            </span>
          </div>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
            开启后用户可以在搜索页面切换到YouTube模式搜索和观看视频
          </p>
        </div>

        {/* YouTube配置 */}
        {youtubeSettings.enabled && (
          <div className='space-y-4'>
            {/* 演示模式开关 */}
            <div className='mb-4'>
              <div className='flex items-center'>
                <ToggleSwitch
                  checked={youtubeSettings.enableDemo}
                  color='blue'
                  onChange={(checked) =>
                    setYoutubeSettings((prev) => ({
                      ...prev,
                      enableDemo: checked,
                    }))
                  }
                />
                <span className='ml-3 text-sm font-medium text-gray-900 dark:text-gray-100'>
                  启用演示模式
                </span>
              </div>
              <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                演示模式使用预设的视频数据，无需API密钥。关闭后将使用真实的YouTube API
              </p>
            </div>

            {/* API密钥 - 仅在非演示模式下显示 */}
            {!youtubeSettings.enableDemo && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  YouTube API密钥
                </label>
                <input
                  type='password'
                  value={youtubeSettings.apiKey}
                  onChange={(e) => setYoutubeSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                  placeholder='AIzaSy...'
                />
                <div className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                  <p className='mb-2 text-blue-600 dark:text-blue-400 font-medium'>💡 获取YouTube API密钥详细步骤：</p>
                  <div className='space-y-2 pl-4 border-l-2 border-blue-200 dark:border-blue-700'>
                    <p><span className='font-medium text-blue-600 dark:text-blue-400'>1.</span> 访问 <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className='text-blue-600 dark:text-blue-400 hover:underline'>Google Cloud Console</a></p>
                    <p><span className='font-medium text-blue-600 dark:text-blue-400'>2.</span> 创建新项目或选择现有项目</p>
                    <p><span className='font-medium text-blue-600 dark:text-blue-400'>3.</span> 在"API和服务"中搜索并启用"YouTube Data API v3"</p>
                    <p><span className='font-medium text-blue-600 dark:text-blue-400'>4.</span> 在"凭据"页面点击"创建凭据" → "API密钥"</p>
                    <p><span className='font-medium text-blue-600 dark:text-blue-400'>5.</span> 复制生成的API密钥并粘贴到上方输入框</p>
                    <div className='mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded'>
                      <p className='text-yellow-700 dark:text-yellow-300 text-xs'>⚠️ <span className='font-medium'>安全提醒：</span></p>
                      <p className='text-yellow-700 dark:text-yellow-300 text-xs'>• 建议限制API密钥的IP或域名访问</p>
                      <p className='text-yellow-700 dark:text-yellow-300 text-xs'>• 请勿在公共代码库中暴露密钥</p>
                      <p className='text-yellow-700 dark:text-yellow-300 text-xs'>• 每日免费配额10,000次请求，超出需申请</p>
                    </div>
                    <div className='mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded'>
                      <p className='text-red-700 dark:text-red-300 text-xs'>🚫 <span className='font-medium'>使用限制：</span></p>
                      <p className='text-red-700 dark:text-red-300 text-xs'>• 中国大陆IP无法直接访问YouTube API</p>
                      <p className='text-red-700 dark:text-red-300 text-xs'>• 需要使用海外服务器或代理服务</p>
                    </div>
                    <div className='mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded'>
                      <p className='text-blue-700 dark:text-blue-300 text-xs'>📊 <span className='font-medium'>流量说明：</span></p>
                      <p className='text-blue-700 dark:text-blue-300 text-xs'>• YouTube视频播放<strong>不消耗</strong>您的服务器流量</p>
                      <p className='text-blue-700 dark:text-blue-300 text-xs'>• 视频内容直接从YouTube服务器传输到用户</p>
                      <p className='text-blue-700 dark:text-blue-300 text-xs'>• 您的服务器只提供网页显示，流量消耗很小</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 最大结果数 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                每页最大结果数
              </label>
              <input
                type='number'
                min='1'
                max='50'
                value={youtubeSettings.maxResults}
                onChange={(e) => setYoutubeSettings(prev => ({ ...prev, maxResults: parseInt(e.target.value) }))}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-red-500'
              />
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                控制每次搜索返回的视频数量，建议10-50之间
              </p>
            </div>

            {/* 地区选择 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                启用的地区 ({youtubeSettings.enabledRegions.length}个)
              </label>
              <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2'>
                {AVAILABLE_REGIONS.map((region) => (
                  <label key={region.code} className='flex items-center space-x-2 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={youtubeSettings.enabledRegions.includes(region.code)}
                      onChange={() => toggleRegion(region.code)}
                      className='rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500'
                    />
                    <span className='text-sm text-gray-700 dark:text-gray-300'>{region.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 分类选择 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                启用的分类 ({youtubeSettings.enabledCategories.length}个)
              </label>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'>
                {AVAILABLE_CATEGORIES.map((category) => (
                  <label key={category} className='flex items-center space-x-2 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={youtubeSettings.enabledCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                      className='rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500'
                    />
                    <span className='text-sm text-gray-700 dark:text-gray-300'>{category}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className='flex flex-wrap gap-3'>
        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={isLoading}
          className='flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'
        >
          <svg className='h-4 w-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
          </svg>
          {isLoading ? '保存中...' : '保存配置'}
        </button>
      </div>
    </div>
  );
};

export default YouTubeConfig;
