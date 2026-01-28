/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { BaseRedisStorage } from './redis-base.db';

export class KvrocksStorage extends BaseRedisStorage {
  constructor() {
    const config = {
      url: process.env.KVROCKS_URL!,
      clientName: 'Kvrocks'
    };
    const globalSymbol = Symbol.for('__MOONTV_KVROCKS_CLIENT__');
    super(config, globalSymbol);

    // 🔥 自动配置 Kvrocks WAL 限制，防止磁盘爆炸
    this.configureKvrocksOnStartup();
  }

  /**
   * 在应用启动时自动配置 Kvrocks，限制 WAL 日志增长
   */
  private async configureKvrocksOnStartup(): Promise<void> {
    try {
      // 等待客户端连接
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!this.client.isOpen) {
        console.log('⏳ [Kvrocks] 等待连接...');
        return;
      }

      console.log('🔧 [Kvrocks] 开始自动配置 WAL 限制...');

      // 设置 WAL 保留时间：1小时（3600秒）
      await this.client.configSet('wal-ttl-seconds', '3600');
      console.log('✅ [Kvrocks] WAL 保留时间设置为 1 小时');

      // 设置 WAL 大小限制：500MB
      await this.client.configSet('wal-size-limit-mb', '500');
      console.log('✅ [Kvrocks] WAL 大小限制设置为 500MB');

      // 验证配置
      const walTtl = await this.client.configGet('wal-ttl-seconds');
      const walSize = await this.client.configGet('wal-size-limit-mb');

      console.log('📊 [Kvrocks] 当前配置:');
      console.log(`   - WAL 保留时间: ${walTtl['wal-ttl-seconds']} 秒`);
      console.log(`   - WAL 大小限制: ${walSize['wal-size-limit-mb']} MB`);
      console.log('🎉 [Kvrocks] 自动配置完成，WAL 日志不会无限增长');

    } catch (error: any) {
      // 如果配置失败，只记录警告，不影响应用启动
      if (error.message?.includes('unknown command') || error.message?.includes('Unknown option')) {
        console.warn('⚠️  [Kvrocks] 当前版本不支持 WAL 配置，建议升级到最新版本');
        console.warn('⚠️  [Kvrocks] 或者手动挂载 kvrocks.conf 配置文件');
      } else {
        console.warn('⚠️  [Kvrocks] 自动配置失败:', error.message);
      }
    }
  }
}