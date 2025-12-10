'use client';

import { useState, useEffect } from 'react';
import { Video, RefreshCw, Save, AlertCircle, CheckCircle } from 'lucide-react';

import { AdminConfig } from '@/lib/admin.types';

interface ShortDramaConfigProps {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}

export default function ShortDramaConfig({ config, refreshConfig }: ShortDramaConfigProps) {
  const [primaryApiUrl, setPrimaryApiUrl] = useState('https://api.r2afosne.dpdns.org');
  const [alternativeApiUrl, setAlternativeApiUrl] = useState('');
  const [enableAlternative, setEnableAlternative] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 从配置加载
  useEffect(() => {
    if (config?.ShortDramaConfig) {
      setPrimaryApiUrl(config.ShortDramaConfig.primaryApiUrl || 'https://api.r2afosne.dpdns.org');
      setAlternativeApiUrl(config.ShortDramaConfig.alternativeApiUrl || '');
      setEnableAlternative(config.ShortDramaConfig.enableAlternative || false);
    }
  }, [config]);

  // 保存配置
  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/shortdrama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryApiUrl,
          alternativeApiUrl,
          enableAlternative,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '保存失败');
      }

      setMessage({ type: 'success', text: '配置保存成功' });
      await refreshConfig();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '保存失败' });
    } finally {
      setLoading(false);
    }
  };

  // 测试API连接
  const handleTest = async (apiUrl: string, apiName: string) => {
    setTesting(true);
    setMessage(null);

    try {
      const testUrl = apiUrl.includes('r2afosne')
        ? `${apiUrl}/vod/categories`
        : `${apiUrl}/api/v1/drama/dl?dramaName=test`;

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `${apiName} 连接成功` });
      } else {
        setMessage({ type: 'error', text: `${apiName} 连接失败: ${response.status}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `${apiName} 连接失败: ${error instanceof Error ? error.message : '网络错误'}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 提示信息 */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* 主API配置 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          主API地址
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={primaryApiUrl}
            onChange={(e) => setPrimaryApiUrl(e.target.value)}
            placeholder="https://api.r2afosne.dpdns.org"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            onClick={() => handleTest(primaryApiUrl, '主API')}
            disabled={testing || !primaryApiUrl}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : '测试'}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          默认短剧API地址，用于获取短剧列表和解析视频
        </p>
      </div>

      {/* 备用API配置 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          备用API地址（可选）
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={alternativeApiUrl}
            onChange={(e) => setAlternativeApiUrl(e.target.value)}
            placeholder="https://001038.xyz"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            onClick={() => handleTest(alternativeApiUrl, '备用API')}
            disabled={testing || !alternativeApiUrl}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : '测试'}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          当主API解析失败时自动切换到备用API
        </p>
      </div>

      {/* 启用备用API开关 */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            启用备用API
          </label>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            开启后，当主API解析失败时会自动尝试备用API
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnableAlternative(!enableAlternative)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enableAlternative
              ? 'bg-purple-600'
              : 'bg-gray-200 dark:bg-gray-700'
            }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableAlternative ? 'translate-x-6' : 'translate-x-1'
              }`}
          />
        </button>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          保存配置
        </button>
      </div>

      {/* 说明文档 */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
          <Video className="w-4 h-4" />
          短剧API说明
        </h4>
        <ul className="text-xs text-purple-700 dark:text-purple-400 space-y-1">
          <li>• 主API用于获取短剧分类、列表、搜索和视频解析</li>
          <li>• 备用API在主API解析失败时自动启用（需要先开启开关）</li>
          <li>• 备用API通过剧名搜索匹配，可能存在匹配不准确的情况</li>
          <li>• 建议定期测试API连接状态，确保服务可用</li>
        </ul>
      </div>
    </div>
  );
}
