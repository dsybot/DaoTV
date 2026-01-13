// artplayer-plugin-liquid-glass
// 毛玻璃效果控制栏插件
// 样式已提取到 src/styles/artplayer-liquid-glass.css

export default function artplayerPluginLiquidGlass(option = {}) {
  return (art) => {
    const { constructor } = art;
    const { addClass, removeClass, append, createElement } = constructor.utils;
    const { $bottom, $progress, $controls, $player } = art.template;

    const $liquidGlass = createElement('div');
    addClass($player, 'artplayer-plugin-liquid-glass');
    addClass($liquidGlass, 'art-liquid-glass');

    // 恢复官方实现：progress和controls一起包裹
    append($bottom, $liquidGlass);
    append($liquidGlass, $progress);
    append($liquidGlass, $controls);

    // 🔧 修复Chrome全屏模式下backdrop-filter导致的鼠标事件延迟问题
    // 通过JavaScript监听全屏状态变化，动态添加/移除类
    art.on('fullscreen', (state) => {
      if (state) {
        addClass($player, 'art-fullscreen-active');
      } else {
        removeClass($player, 'art-fullscreen-active');
      }
    });

    // 同时监听网页全屏
    art.on('fullscreenWeb', (state) => {
      if (state) {
        addClass($player, 'art-fullscreen-web-active');
      } else {
        removeClass($player, 'art-fullscreen-web-active');
      }
    });

    // 🔧 修复控制栏隐藏时样式闪烁问题
    // 通过延迟移除样式类，让ArtPlayer的opacity动画先完成
    let hideTimer = null;
    addClass($player, 'art-liquid-glass-styled');

    art.on('control', (state) => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }

      if (state) {
        // 控制栏显示时，立即添加样式类
        addClass($player, 'art-liquid-glass-styled');
      } else {
        // 控制栏隐藏时，延迟移除样式类（等待opacity动画完成）
        hideTimer = setTimeout(() => {
          removeClass($player, 'art-liquid-glass-styled');
        }, 300);
      }
    });

    return {
      name: 'artplayerPluginLiquidGlass',
    };
  };
}

if (typeof window !== 'undefined') {
  window.artplayerPluginLiquidGlass = artplayerPluginLiquidGlass;
}
