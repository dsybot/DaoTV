/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Activity, Database, Zap, HardDrive, Trash2, RefreshCw } from 'lucide-react';

interface PerformanceData {
  metrics: any[];
  currentStatus: {
    system: {
      cpuUsage: number;
      memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
      };
    };
    requestsPerMinute: number;
    dbQueriesPerMinute: number;
    avgResponseTime: number;
  };
}

export default function PerformanceMonitor() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1' | '24'>('24');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // 获取性能数据
  const fetchData = async () => {
    try {
      const response = await fetch(`/api/admin/performance?hours=${timeRange}`);
      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      }
    } catch (error) {
      console.error('获取性能数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 清空数据
  const clearData = async () => {
    if (!confirm('确定要清空所有性能数据吗？')) return;

    try {
      const response = await fetch('/api/admin/performance', {
        method: 'DELETE',
      });
      if (response.ok) {
        alert('性能数据已清空');
        fetchData();
      }
    } catch (error) {
      console.error('清空数据失败:', error);
      alert('清空数据失败');
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, [autoRefresh, timeRange]);

  if (loading) {
    return (
      <div className='flex justify-center items-center py-8'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className='text-center py-8 text-gray-500'>
        暂无性能数据
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 标题和控制按钮 */}
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
          性能监控
        </h2>
        <div className='flex items-center gap-3'>
          {/* 时间范围选择 */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '1' | '24')}
            className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800'
          >
            <option value='1'>最近 1 小时</option>
            <option value='24'>最近 24 小时</option>
          </select>

          {/* 自动刷新 */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
              autoRefresh
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            自动刷新
          </button>

          {/* 手动刷新 */}
          <button
            onClick={fetchData}
            className='px-3 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700'
          >
            <RefreshCw className='w-4 h-4' />
            刷新
          </button>

          {/* 清空数据 */}
          <button
            onClick={clearData}
            className='px-3 py-2 bg-red-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-red-700'
          >
            <Trash2 className='w-4 h-4' />
            清空数据
          </button>
        </div>
      </div>

      {/* 实时状态卡片 */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {/* CPU 使用率 */}
        <div className='bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm text-gray-600 dark:text-gray-400'>CPU 使用率</span>
            <Zap className='w-5 h-5 text-yellow-500' />
          </div>
          <div className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
            {data.currentStatus.system.cpuUsage.toFixed(2)}%
          </div>
        </div>

        {/* 内存使用 */}
        <div className='bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm text-gray-600 dark:text-gray-400'>内存使用</span>
            <HardDrive className='w-5 h-5 text-blue-500' />
          </div>
          <div className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
            {data.currentStatus.system.memoryUsage.heapUsed.toFixed(0)} MB
          </div>
          <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            / {data.currentStatus.system.memoryUsage.heapTotal.toFixed(0)} MB
          </div>
        </div>

        {/* 每分钟请求数 */}
        <div className='bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm text-gray-600 dark:text-gray-400'>请求/分钟</span>
            <Activity className='w-5 h-5 text-green-500' />
          </div>
          <div className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
            {data.currentStatus.requestsPerMinute}
          </div>
          <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            平均响应: {data.currentStatus.avgResponseTime}ms
          </div>
        </div>

        {/* 数据库查询 */}
        <div className='bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm text-gray-600 dark:text-gray-400'>DB 查询/分钟</span>
            <Database className='w-5 h-5 text-purple-500' />
          </div>
          <div className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
            {data.currentStatus.dbQueriesPerMinute}
          </div>
        </div>
      </div>

      {/* 历史数据表格 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-gray-200'>
            历史数据（最近 {timeRange} 小时）
          </h3>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead className='bg-gray-50 dark:bg-gray-700'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
                  时间
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
                  总请求
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
                  成功率
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
                  平均响应
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
                  最大响应
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
                  DB 查询
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
                  流量
                </th>
              </tr>
            </thead>
            <tbody className='bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700'>
              {data.metrics.map((metric: any, index: number) => {
                const successRate = metric.totalRequests > 0
                  ? ((metric.successRequests / metric.totalRequests) * 100).toFixed(1)
                  : '0.0';
                const trafficMB = (metric.totalTraffic / 1024 / 1024).toFixed(2);

                return (
                  <tr key={index}>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
                      {new Date(metric.hour).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
                      {metric.totalRequests}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm'>
                      <span className={`${
                        parseFloat(successRate) >= 95
                          ? 'text-green-600 dark:text-green-400'
                          : parseFloat(successRate) >= 80
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {successRate}%
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
                      {metric.avgDuration}ms
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
                      {metric.maxDuration}ms
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
                      {metric.totalDbQueries}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
                      {trafficMB} MB
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
