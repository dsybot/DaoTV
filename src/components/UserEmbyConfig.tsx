/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UserEmbyConfigProps {
  initialConfig: { sources: any[] };
  onClose?: () => void;
}

export const UserEmbyConfig = ({ initialConfig, onClose }: UserEmbyConfigProps) => {
  const queryClient = useQueryClient();
  const [sources, setSources] = useState(initialConfig.sources || []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testingIndex, setTestingIndex] = useState<number | null>(null);

  // Toast 状态
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // 表单状态
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    enabled: true,
    ServerURL: '',
    ApiKey: '',
    Username: '',
    Password: '',
    removeEmbyPrefix: false,
    appendMediaSourceId: false,
    transcodeMp4: false,
    proxyPlay: false,
  });

  const showNotification = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      enabled: true,
      ServerURL: '',
      ApiKey: '',
      Username: '',
      Password: '',
      removeEmbyPrefix: false,
      appendMediaSourceId: false,
      transcodeMp4: false,
      proxyPlay: false,
    });
    setEditingIndex(null);
    setShowAddForm(false);
  };

  const handleAdd = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEdit = (index: number) => {
    const source = sources[index];
    setFormData({
      ...source,
      // 确保高级选项字段存在
      removeEmbyPrefix: source.removeEmbyPrefix ?? false,
      appendMediaSourceId: source.appendMediaSourceId ?? false,
      transcodeMp4: source.transcodeMp4 ?? false,
      proxyPlay: source.proxyPlay ?? false,
    });
    setEditingIndex(index);
    setShowAddForm(false);
  };

  const handleDelete = async (index: number) => {
    if (!confirm('确定要删除这个 Emby 源吗？')) return;

    const newSources = sources.filter((_, i) => i !== index);
    setSources(newSources);

    // 保存到服务器
    try {
      await fetch('/api/user/emby-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { sources: newSources } }),
      });
      showNotification('删除成功', 'success');
      queryClient.invalidateQueries({ queryKey: ['user', 'emby-config'] });
    } catch (err) {
      showNotification('删除失败', 'error');
    }
  };

  const handleTest = async (index: number) => {
    const source = sources[index];
    setTestingIndex(index);

    try {
      const res = await fetch('/api/emby/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source),
      });

      const data = await res.json();
      if (data.success) {
        showNotification(`连接成功！用户: ${data.user?.Name || '未知'}`, 'success');
      } else {
        showNotification(`连接失败: ${data.error}`, 'error');
      }
    } catch (err) {
      showNotification('测试连接失败', 'error');
    } finally {
      setTestingIndex(null);
    }
  };

  const handleSave = async () => {
    if (!formData.key || !formData.name || !formData.ServerURL) {
      showNotification('请填写必填字段：标识符、名称、服务器地址', 'error');
      return;
    }

    // 检查标识符是否重复
    if (editingIndex === null && sources.some(s => s.key === formData.key)) {
      showNotification('标识符已存在，请使用其他标识符', 'error');
      return;
    }

    setIsLoading(true);
    try {
      // 确保 formData 包含所有必需字段
      const completeFormData = {
        ...formData,
        removeEmbyPrefix: formData.removeEmbyPrefix ?? false,
        appendMediaSourceId: formData.appendMediaSourceId ?? false,
        transcodeMp4: formData.transcodeMp4 ?? false,
        proxyPlay: formData.proxyPlay ?? false,
      };

      let newSources;
      if (editingIndex !== null) {
        // 编辑现有源
        newSources = sources.map((s, i) => i === editingIndex ? completeFormData : s);
      } else {
        // 添加新源
        newSources = [...sources, completeFormData];
      }

      const res = await fetch('/api/user/emby-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { sources: newSources } }),
      });

      const data = await res.json();
      if (data.success) {
        setSources(newSources);
        showNotification('保存成功！', 'success');
        queryClient.invalidateQueries({ queryKey: ['user', 'emby-config'] });
        resetForm();
      } else {
        showNotification(`保存失败: ${data.error}`, 'error');
      }
    } catch (err) {
      showNotification('保存失败，请重试', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-4'>
      {/* 源列表 */}
      {sources.length > 0 && !showAddForm && editingIndex === null && (
        <div className='space-y-3'>
          {sources.map((source, index) => (
            <div
              key={source.key}
              className='p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50'
            >
              <div className='flex items-start justify-between'>
                <div className='flex-1'>
                  <div className='flex items-center gap-2'>
                    <h5 className='font-medium text-gray-900 dark:text-gray-100'>
                      {source.name}
                    </h5>
                    {source.enabled ? (
                      <span className='px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded'>
                        已启用
                      </span>
                    ) : (
                      <span className='px-2 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded'>
                        已禁用
                      </span>
                    )}
                  </div>
                  <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                    {source.ServerURL}
                  </p>
                  <p className='text-xs text-gray-500 dark:text-gray-500 mt-1'>
                    标识符: {source.key}
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => handleTest(index)}
                    disabled={testingIndex === index}
                    className='px-3 py-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200 hover:border-blue-300 dark:border-blue-800 dark:hover:border-blue-700 rounded transition-colors disabled:opacity-50'
                  >
                    {testingIndex === index ? '测试中...' : '测试'}
                  </button>
                  <button
                    onClick={() => handleEdit(index)}
                    className='px-3 py-1 text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 border border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600 rounded transition-colors'
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className='px-3 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700 rounded transition-colors'
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加按钮 */}
      {!showAddForm && editingIndex === null && (
        <button
          onClick={handleAdd}
          className='w-full px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center justify-center gap-2'
        >
          <Plus className='w-4 h-4' />
          添加 Emby 源
        </button>
      )}

      {/* 添加/编辑表单 */}
      {(showAddForm || editingIndex !== null) && (
        <div className='p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3 bg-white dark:bg-gray-800'>
          <div className='flex items-center justify-between mb-3'>
            <h5 className='font-medium text-gray-900 dark:text-gray-100'>
              {editingIndex !== null ? '编辑 Emby 源' : '添加 Emby 源'}
            </h5>
            <button
              onClick={resetForm}
              className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          <div>
            <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
              标识符 *
            </label>
            <input
              type='text'
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              disabled={editingIndex !== null}
              className='w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50'
              placeholder='例如: wumei'
            />
          </div>

          <div>
            <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
              名称 *
            </label>
            <input
              type='text'
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className='w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              placeholder='例如: 无名Emby'
            />
          </div>

          <div>
            <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
              服务器地址 *
            </label>
            <input
              type='text'
              value={formData.ServerURL}
              onChange={(e) => setFormData({ ...formData, ServerURL: e.target.value })}
              className='w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              placeholder='http://192.168.1.100:8096'
            />
          </div>

          <div>
            <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
              API Key
            </label>
            <input
              type='text'
              value={formData.ApiKey}
              onChange={(e) => setFormData({ ...formData, ApiKey: e.target.value })}
              className='w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              placeholder='推荐使用 API Key'
            />
          </div>

          <div className='grid grid-cols-2 gap-2'>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                用户名
              </label>
              <input
                type='text'
                value={formData.Username}
                onChange={(e) => setFormData({ ...formData, Username: e.target.value })}
                className='w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                密码
              </label>
              <input
                type='password'
                value={formData.Password}
                onChange={(e) => setFormData({ ...formData, Password: e.target.value })}
                className='w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
          </div>

          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className='w-4 h-4 text-green-500 border-gray-300 rounded focus:ring-green-500'
            />
            <span className='text-gray-700 dark:text-gray-300'>启用此源</span>
          </label>

          {/* 高级选项 */}
          <details className='mt-2'>
            <summary className='text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200'>
              高级选项
            </summary>
            <div className='mt-2 space-y-2 pl-2 border-l-2 border-gray-200 dark:border-gray-700'>
              <label className='flex items-center gap-2 text-xs'>
                <input
                  type='checkbox'
                  checked={formData.transcodeMp4}
                  onChange={(e) => setFormData({ ...formData, transcodeMp4: e.target.checked })}
                  className='w-3 h-3 text-blue-500 border-gray-300 rounded focus:ring-blue-500'
                />
                <span className='text-gray-600 dark:text-gray-400'>转码mp4（推荐MKV格式启用）</span>
              </label>
              <label className='flex items-center gap-2 text-xs'>
                <input
                  type='checkbox'
                  checked={formData.proxyPlay}
                  onChange={(e) => setFormData({ ...formData, proxyPlay: e.target.checked })}
                  className='w-3 h-3 text-blue-500 border-gray-300 rounded focus:ring-blue-500'
                />
                <span className='text-gray-600 dark:text-gray-400'>视频播放代理</span>
              </label>
              <label className='flex items-center gap-2 text-xs'>
                <input
                  type='checkbox'
                  checked={formData.removeEmbyPrefix}
                  onChange={(e) => setFormData({ ...formData, removeEmbyPrefix: e.target.checked })}
                  className='w-3 h-3 text-blue-500 border-gray-300 rounded focus:ring-blue-500'
                />
                <span className='text-gray-600 dark:text-gray-400'>移除/emby前缀</span>
              </label>
              <label className='flex items-center gap-2 text-xs'>
                <input
                  type='checkbox'
                  checked={formData.appendMediaSourceId}
                  onChange={(e) => setFormData({ ...formData, appendMediaSourceId: e.target.checked })}
                  className='w-3 h-3 text-blue-500 border-gray-300 rounded focus:ring-blue-500'
                />
                <span className='text-gray-600 dark:text-gray-400'>拼接MediaSourceId参数</span>
              </label>
            </div>
          </details>

          <div className='flex gap-2 pt-2'>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className='flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 rounded-lg transition-colors'
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
            <button
              onClick={resetForm}
              className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors'
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Toast 通知 */}
      {showToast && (
        <div className='fixed top-20 left-1/2 -translate-x-1/2 z-[1100] animate-in fade-in slide-in-from-top-2 duration-300'>
          <div
            className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
              toastType === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {toastType === 'success' ? (
              <Check className='w-5 h-5' />
            ) : (
              <X className='w-5 h-5' />
            )}
            <span className='font-medium'>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
