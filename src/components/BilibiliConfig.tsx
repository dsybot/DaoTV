'use client';

import { useState } from 'react';
import { AdminConfig } from '@/lib/admin.types';

interface BilibiliConfigProps {
  config: AdminConfig;
  refreshConfig: () => void;
}

const BilibiliConfig = ({ config, refreshConfig }: BilibiliConfigProps) => {
  const [enabled, setEnabled] = useState(config.BilibiliConfig?.enabled || false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/bilibili', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled,
        }),
      });

      if (!response.ok) {
        throw new Error('保存失败');
      }

      setMessage({ type: 'success', text: 'B站配置已保存' });
      refreshConfig();
    } catch (error) {
      console.error('保存B站配置失败:', error);
      setMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 基础设置 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          ⚙️ 基础设置
        </h3>

        <div className="space-y-4">
          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                启用 B站搜索功能
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                开启后用户可以搜索 B站视频和番剧
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 dark:peer-focus:ring-pink-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-pink-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 功能说明 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
          💡 功能说明
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>支持搜索 B站视频和番剧内容</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>使用 iframe embed 播放器，无需解析视频地址</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>自动处理 Wbi 签名，绕过反爬虫验证</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>会员内容需要用户自己登录 B站账号</span>
          </li>
        </ul>
      </div>

      {/* 注意事项 */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
          ⚠️ 注意事项
        </h3>
        <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>搜索功能无需代理，海外服务器也可使用</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>播放器是用户浏览器直接访问 B站，服务器端代理无效</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>番剧/影视内容有地区限制，用户需要自己配置 VPN</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>大会员内容需要用户自己有会员才能观看</span>
          </li>
        </ul>
      </div>

      {/* 保存按钮 */}
      <div className="flex items-center justify-between">
        <div>
          {message && (
            <div
              className={`text-sm ${
                message.type === 'success'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  );
};

export default BilibiliConfig;
