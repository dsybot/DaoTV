/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
'use client';

import { Ticket, Plus, Trash2, Copy, Check, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

interface InviteCode {
  code: string;
  createdBy: string;
  createdAt: string;
  maxUses: number;
  currentUses: number;
  remainingUses: number;
  expiresAt: string;
  expired: boolean;
  users: string[];
}

const buttonStyles = {
  primary: 'px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors',
  success: 'px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors',
  danger: 'px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors',
  secondary: 'px-3 py-1.5 text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors',
  dangerSmall: 'px-2 py-1 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors',
};

export default function InviteCodeManager() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [maxUses, setMaxUses] = useState(10);
  const [expiresIn, setExpiresIn] = useState(7); // 天数
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // 加载邀请码列表
  const fetchCodes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/invites');
      const data = await res.json();
      if (data.ok) {
        setCodes(data.codes);
      }
    } catch (error) {
      console.error('加载邀请码失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  // 生成邀请码
  const handleCreate = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxUses,
          expiresIn: expiresIn * 86400, // 转换为秒
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowCreateModal(false);
        await fetchCodes();
        // 自动复制新生成的邀请码
        await navigator.clipboard.writeText(data.code);
        setCopiedCode(data.code);
        setTimeout(() => setCopiedCode(null), 2000);
      } else {
        alert(data.error || '生成邀请码失败');
      }
    } catch (error) {
      console.error('生成邀请码失败:', error);
      alert('生成邀请码失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除邀请码
  const handleDelete = async (code: string) => {
    if (!confirm(`确定要删除邀请码 ${code} 吗？`)) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/admin/invites?code=${code}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.ok) {
        await fetchCodes();
      } else {
        alert(data.error || '删除邀请码失败');
      }
    } catch (error) {
      console.error('删除邀请码失败:', error);
      alert('删除邀请码失败');
    } finally {
      setLoading(false);
    }
  };

  // 复制邀请码
  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className='space-y-4'>
      {/* 头部操作栏 */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Ticket className='text-blue-500' size={20} />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            邀请码管理
          </h3>
          <span className='text-sm text-gray-500 dark:text-gray-400'>
            ({codes.length} 个活跃邀请码)
          </span>
        </div>
        <div className='flex gap-2'>
          <button
            onClick={fetchCodes}
            disabled={loading}
            className={buttonStyles.secondary}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className={buttonStyles.success}
          >
            <Plus size={16} className='inline mr-1' />
            生成邀请码
          </button>
        </div>
      </div>

      {/* 邀请码列表 */}
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead className='bg-gray-50 dark:bg-gray-800'>
            <tr>
              <th className='px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300'>
                邀请码
              </th>
              <th className='px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300'>
                创建者
              </th>
              <th className='px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300'>
                使用情况
              </th>
              <th className='px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300'>
                创建时间
              </th>
              <th className='px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300'>
                过期时间
              </th>
              <th className='px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300'>
                状态
              </th>
              <th className='px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300'>
                操作
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
            {codes.length === 0 ? (
              <tr>
                <td colSpan={7} className='px-4 py-8 text-center text-gray-500 dark:text-gray-400'>
                  暂无邀请码，点击"生成邀请码"创建
                </td>
              </tr>
            ) : (
              codes.map((code) => (
                <tr key={code.code} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-2'>
                      <code className='px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm'>
                        {code.code}
                      </code>
                      <button
                        onClick={() => handleCopy(code.code)}
                        className='text-gray-500 hover:text-blue-600 dark:hover:text-blue-400'
                        title='复制'
                      >
                        {copiedCode === code.code ? (
                          <Check size={16} className='text-green-600' />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className='px-4 py-3 text-gray-700 dark:text-gray-300'>
                    {code.createdBy}
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-2'>
                      <span className='text-gray-700 dark:text-gray-300'>
                        {code.currentUses} / {code.maxUses}
                      </span>
                      <div className='w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                        <div
                          className='h-full bg-blue-600 transition-all'
                          style={{
                            width: `${(code.currentUses / code.maxUses) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className='px-4 py-3 text-gray-600 dark:text-gray-400 text-xs'>
                    {formatDate(code.createdAt)}
                  </td>
                  <td className='px-4 py-3 text-gray-600 dark:text-gray-400 text-xs'>
                    {formatDate(code.expiresAt)}
                  </td>
                  <td className='px-4 py-3'>
                    {code.expired ? (
                      <span className='px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'>
                        已过期
                      </span>
                    ) : code.remainingUses === 0 ? (
                      <span className='px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'>
                        已用完
                      </span>
                    ) : (
                      <span className='px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'>
                        可用
                      </span>
                    )}
                  </td>
                  <td className='px-4 py-3 text-right'>
                    <button
                      onClick={() => handleDelete(code.code)}
                      className={buttonStyles.dangerSmall}
                      disabled={loading}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 生成邀请码模态框 */}
      {showCreateModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md'>
            <h3 className='text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100'>
              生成新邀请码
            </h3>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  最大使用次数
                </label>
                <input
                  type='number'
                  min='1'
                  max='1000'
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  有效期（天）
                </label>
                <input
                  type='number'
                  min='1'
                  max='365'
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(Number(e.target.value))}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                />
              </div>
            </div>
            <div className='flex gap-2 mt-6'>
              <button
                onClick={handleCreate}
                disabled={loading}
                className={buttonStyles.success + ' flex-1'}
              >
                {loading ? '生成中...' : '生成'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={loading}
                className={buttonStyles.secondary}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
