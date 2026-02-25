/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { AlertCircle, CheckCircle, Plus, Trash2, Edit2, TestTube } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AdminConfig } from '@/lib/admin.types';

interface EmbyConfigProps {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}

const EmbyConfig = ({ config, refreshConfig }: EmbyConfigProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [editingSource, setEditingSource] = useState<any | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    enabled: true,
    ServerURL: '',
    ApiKey: '',
    Username: '',
    Password: '',
    UserId: '',
    isDefault: false,
    removeEmbyPrefix: false,
    appendMediaSourceId: false,
    transcodeMp4: false,
    proxyPlay: false,
  });

  // 从配置加载源列表
  useEffect(() => {
    if (config?.EmbyConfig?.Sources) {
      setSources(config.EmbyConfig.Sources);
    }
  }, [config]);

  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      enabled: true,
      ServerURL: '',
      ApiKey: '',
      Username: '',
      Password: '',
      UserId: '',
      isDefault: false,
      removeEmbyPrefix: false,
      appendMediaSourceId: false,
      transcodeMp4: false,
      proxyPlay: false,
    });
    setEditingSource(null);
    setShowAddForm(false);
  };

  // 开始编辑
  const handleEdit = (source: any) => {
    setFormData({ ...source });
    setEditingSource(source);
    setShowAddForm(false);
  };

  // 开始添加
  const handleAdd = () => {
    resetForm();
    setShowAddForm(true);
  };

  // 保存源
  const handleSave = async () => {
    if (!formData.key || !formData.name || !formData.ServerURL) {
      showMessage('error', '请填写必填字段：标识符、名称、服务器地址');
      return;
    }

    if (!editingSource && sources.some(s => s.key === formData.key)) {
      showMessage('error', '标识符已存在，请使用其他标识符');
      return;
    }

    setIsLoading(true);
    try {
      let newSources;
      if (editingSource) {
        newSources = sources.map(s =>
          s.key === editingSource.key ? formData : s
        );
      } else {
        newSources = [...sources, formData];
      }

      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          EmbyConfig: { Sources: newSources },
        }),
      });

      if (!response.ok) throw new Error('保存失败');

      await refreshConfig();
      resetForm();
      showMessage('success', editingSource ? '更新成功' : '添加成功');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 删除源
  const handleDelete = async (source: any) => {
    if (!confirm(`确定要删除 "${source.name}" 吗？`)) return;

    setIsLoading(true);
    try {
      const newSources = sources.filter(s => s.key !== source.key);

      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          EmbyConfig: { Sources: newSources },
        }),
      });

      if (!response.ok) throw new Error('删除失败');

      await refreshConfig();
      showMessage('success', '删除成功');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : '删除失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 切换启用状态
  const handleToggleEnabled = async (source: any) => {
    setIsLoading(true);
    try {
      const newSources = sources.map(s =>
        s.key === source.key ? { ...s, enabled: !s.enabled } : s
      );

      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          EmbyConfig: { Sources: newSources },
        }),
      });

      if (!response.ok) throw new Error('更新失败');

      await refreshConfig();
      showMessage('success', source.enabled ? '已禁用' : '已启用');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : '更新失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 测试连接
  const handleTest = async (source: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/emby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', source }),
      });

      const result = await response.json();
      if (result.success) {
        showMessage('success', '连接测试成功');
      } else {
        showMessage('error', result.error || '连接测试失败');
      }
    } catch (err) {
      showMessage('error', '连接测试失败');
    } finally {
      setIsLoading(false);
    }
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

      {/* 源列表 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>Emby媒体源</h3>
          <button
            onClick={handleAdd}
            disabled={isLoading || showAddForm}
            className='px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-1'
          >
            <Plus className='h-4 w-4' />
            <span>添加源</span>
          </button>
        </div>

        {/* 源列表表格 */}
        {sources.length > 0 && (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-700/50'>
                <tr>
                  <th className='px-4 py-2 text-left text-gray-700 dark:text-gray-300'>名称</th>
                  <th className='px-4 py-2 text-left text-gray-700 dark:text-gray-300'>服务器地址</th>
                  <th className='px-4 py-2 text-left text-gray-700 dark:text-gray-300'>状态</th>
                  <th className='px-4 py-2 text-right text-gray-700 dark:text-gray-300'>操作</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {sources.map((source) => (
                  <tr key={source.key} className='hover:bg-gray-50 dark:hover:bg-gray-700/30'>
                    <td className='px-4 py-3 text-gray-900 dark:text-gray-100'>{source.name}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400 truncate max-w-xs'>{source.ServerURL}</td>
                    <td className='px-4 py-3'>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        source.enabled
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {source.enabled ? '已启用' : '已禁用'}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-right space-x-2'>
                      <button
                        onClick={() => handleTest(source)}
                        disabled={isLoading}
                        className='text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50'
                        title='测试连接'
                      >
                        <TestTube className='h-4 w-4 inline' />
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(source)}
                        disabled={isLoading}
                        className='text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 disabled:opacity-50'
                        title={source.enabled ? '禁用' : '启用'}
                      >
                        {source.enabled ? '禁用' : '启用'}
                      </button>
                      <button
                        onClick={() => handleEdit(source)}
                        disabled={isLoading}
                        className='text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50'
                        title='编辑'
                      >
                        <Edit2 className='h-4 w-4 inline' />
                      </button>
                      <button
                        onClick={() => handleDelete(source)}
                        disabled={isLoading}
                        className='text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50'
                        title='删除'
                      >
                        <Trash2 className='h-4 w-4 inline' />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sources.length === 0 && !showAddForm && !editingSource && (
          <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
            暂无Emby媒体源，点击"添加源"开始配置
          </div>
        )}
      </div>

      {/* 添加/编辑表单 */}
      {(showAddForm || editingSource) && (
        <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
            {editingSource ? '编辑源' : '添加新源'}
          </h3>

          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  标识符 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  disabled={!!editingSource}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50'
                  placeholder='例如: wumei'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  名称 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  placeholder='例如: 无名Emby'
                />
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                服务器地址 <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={formData.ServerURL}
                onChange={(e) => setFormData({ ...formData, ServerURL: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                placeholder='https://emby.example.com'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                API密钥
              </label>
              <input
                type='password'
                value={formData.ApiKey}
                onChange={(e) => setFormData({ ...formData, ApiKey: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                placeholder='可选'
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  用户名
                </label>
                <input
                  type='text'
                  value={formData.Username}
                  onChange={(e) => setFormData({ ...formData, Username: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  placeholder='可选'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  密码
                </label>
                <input
                  type='password'
                  value={formData.Password}
                  onChange={(e) => setFormData({ ...formData, Password: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  placeholder='可选'
                />
              </div>
            </div>

            <div className='flex items-center space-x-2'>
              <input
                type='checkbox'
                id='enabled'
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className='rounded border-gray-300 dark:border-gray-600'
              />
              <label htmlFor='enabled' className='text-sm text-gray-700 dark:text-gray-300'>
                启用此源
              </label>
            </div>

            <div className='flex justify-end space-x-2 pt-4'>
              <button
                onClick={resetForm}
                disabled={isLoading}
                className='px-4 py-2 text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50'
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className='px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50'
              >
                {isLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmbyConfig;
