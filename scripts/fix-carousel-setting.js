/* eslint-disable no-console */
/**
 * 修复数据库中的轮播图设置
 * 将 EnableTMDBCarousel 设置为 true（如果未设置或为 false）
 */

const { getConfig, db } = require('../src/lib/config');

async function fixCarouselSetting() {
  try {
    console.log('开始检查轮播图设置...');
    
    const config = await getConfig();
    
    console.log('当前设置:', {
      EnableTMDBActorSearch: config.SiteConfig.EnableTMDBActorSearch,
      EnableTMDBCarousel: config.SiteConfig.EnableTMDBCarousel,
      TMDBApiKey: config.SiteConfig.TMDBApiKey ? '已配置' : '未配置',
    });
    
    // 如果 EnableTMDBCarousel 未设置或为 false，设置为 true
    if (config.SiteConfig.EnableTMDBCarousel !== true) {
      console.log('修正 EnableTMDBCarousel 为 true...');
      config.SiteConfig.EnableTMDBCarousel = true;
      
      await db.saveAdminConfig(config);
      console.log('✅ 修正成功！');
      
      // 清除缓存
      const { clearConfigCache } = require('../src/lib/config');
      clearConfigCache();
      console.log('✅ 缓存已清除');
    } else {
      console.log('✅ 设置正常，无需修正');
    }
    
  } catch (error) {
    console.error('❌ 修正失败:', error);
    process.exit(1);
  }
}

fixCarouselSetting();
