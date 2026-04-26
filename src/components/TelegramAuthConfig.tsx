'use client';

import { AlertCircle, CheckCircle2, Save, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import ToggleSwitch from '@/components/ToggleSwitch';

interface TelegramAuthConfigProps {
  config: {
    enabled: boolean;
    botToken: string;
    botUsername: string;
    autoRegister: boolean;
    buttonSize: 'large' | 'medium' | 'small';
    showAvatar: boolean;
    requestWriteAccess: boolean;
  };
  onSave: (config: TelegramAuthConfigProps['config']) => Promise<void>;
}

export function TelegramAuthConfig({ config, onSave }: TelegramAuthConfigProps) {
  const [localConfig, setLocalConfig] = useState(config);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    const changed = JSON.stringify(localConfig) !== JSON.stringify(config);
    setHasChanges(changed);
  }, [localConfig, config]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await onSave(localConfig);
      setMessage({ type: 'success', text: '保存成功' });
      setHasChanges(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: `保存失败: ${(error as Error).message}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* 标题和说明 */}
      <div className='border-b border-gray-200 dark:border-gray-700 pb-4'>
        <h2 className='text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2'>
          <Send className='w-5 h-5 text-blue-500' />
          Telegram 登录配置
        </h2>
        <p className='mt-2 text-sm text-gray-600 dark:text-gray-400'>
          配置 Telegram Magic Link 登录，允许用户通过 Telegram 一键登录
        </p>
      </div>

      {/* 配置提示 */}
      <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
        <div className='flex gap-3'>
          <AlertCircle className='w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5' />
          <div className='text-sm text-blue-800 dark:text-blue-200 space-y-2'>
            <p className='font-semibold'>配置步骤：</p>
            <ol className='list-decimal list-inside space-y-1 ml-2'>
              <li>与 <a href='https://t.me/botfather' target='_blank' rel='noopener noreferrer' className='underline hover:text-blue-600'>@BotFather</a> 对话创建 Bot</li>
              <li>复制 Bot Token 和 Bot Username 填入下方</li>
              <li>启用自动注册（推荐）</li>
              <li>启用配置并保存</li>
            </ol>
            <p className='text-xs text-blue-600 dark:text-blue-300 mt-2'>
              💡 工作原理：用户输入 Telegram 用户名后，系统会通过 Bot 发送登录链接到用户的 Telegram，用户点击链接即可登录
            </p>
          </div>
        </div>
      </div>

      {/* 重要提示：一个 Bot 只能绑定一个域名 */}
      <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4'>
        <div className='flex gap-3'>
          <AlertCircle className='w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5' />
          <div className='text-sm text-yellow-800 dark:text-yellow-200 space-y-2'>
            <p className='font-semibold'>⚠️ 重要提示：Webhook 绑定限制</p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li><strong>一个 Telegram Bot 只能绑定一个 Webhook URL（域名）</strong></li>
              <li>如果您有多个部署（如 Vercel、自建服务器等），它们<strong>不能共用同一个 Bot</strong></li>
              <li>解决方案：为每个部署创建独立的 Bot，或只在一个域名上启用 Telegram 登录</li>
              <li>系统会自动将 Webhook 设置到当前访问的域名</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 启用开关 */}
      <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg'>
        <div>
          <label htmlFor='enabled' className='text-sm font-medium text-gray-900 dark:text-gray-100'>
            启用 Telegram 登录
          </label>
          <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            开启后，登录页面将显示 Telegram 登录按钮
          </p>
        </div>
        <ToggleSwitch
          checked={localConfig.enabled}
          color='blue'
          onChange={(checked) =>
            setLocalConfig({ ...localConfig, enabled: checked })
          }
        />
      </div>

      {/* Bot 配置 */}
      <div className='space-y-4'>
        <div>
          <label htmlFor='botToken' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            Bot Token <span className='text-red-500'>*</span>
          </label>
          <input
            type='password'
            id='botToken'
            value={localConfig.botToken}
            onChange={(e) => setLocalConfig({ ...localConfig, botToken: e.target.value })}
            className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            placeholder='1234567890:ABCdefGHIjklMNOpqrsTUVwxyz'
          />
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            从 @BotFather 获取的 Bot Token
          </p>
        </div>

        <div>
          <label htmlFor='botUsername' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            Bot Username <span className='text-red-500'>*</span>
          </label>
          <input
            type='text'
            id='botUsername'
            value={localConfig.botUsername}
            onChange={(e) => setLocalConfig({ ...localConfig, botUsername: e.target.value })}
            className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            placeholder='YourBotUsername'
          />
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            Bot 的用户名（不含 @）
          </p>
        </div>
      </div>

      {/* 用户管理配置 */}
      <div className='space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
        <h3 className='text-sm font-semibold text-gray-900 dark:text-gray-100'>用户管理</h3>

        <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg'>
          <div>
            <label htmlFor='autoRegister' className='text-sm font-medium text-gray-900 dark:text-gray-100'>
              自动注册新用户
            </label>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              首次通过 Telegram 登录的用户将自动创建账号
            </p>
          </div>
          <ToggleSwitch
            checked={localConfig.autoRegister}
            color='blue'
            onChange={(checked) =>
              setLocalConfig({ ...localConfig, autoRegister: checked })
            }
          />
        </div>
      </div>


      {/* 消息提示 */}
      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className='w-5 h-5 shrink-0' />
          ) : (
            <AlertCircle className='w-5 h-5 shrink-0' />
          )}
          <span className='text-sm'>{message.text}</span>
        </div>
      )}

      {/* 保存按钮 */}
      <div className='flex justify-end pt-4'>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className='flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 font-medium'
        >
          <Save className='w-4 h-4' />
          {saving ? '保存中...' : '保存配置'}
        </button>
      </div>
    </div>
  );
}
