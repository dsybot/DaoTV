// artplayer-plugin-liquid-glass
// 毛玻璃效果控制栏插件
// 样式已提取到 src/styles/artplayer-liquid-glass.css

export default function artplayerPluginLiquidGlass(option = {}) {
  return (art) => {
    const { constructor } = art;
    const { addClass, append, createElement } = constructor.utils;
    const { $bottom, $progress, $controls, $player } = art.template;

    const $liquidGlass = createElement('div');
    addClass($player, 'artplayer-plugin-liquid-glass');
    addClass($liquidGlass, 'art-liquid-glass');

    // 恢复官方实现：progress和controls一起包裹
    append($bottom, $liquidGlass);
    append($liquidGlass, $progress);
    append($liquidGlass, $controls);

    // 与上游保持一致：不再用自定义 class 追踪控制栏显隐。
    // 控制栏显示状态由 ArtPlayer 原生 art-control-show 统一驱动，避免全屏切换时样式状态和可点击层不同步。

    return {
      name: 'artplayerPluginLiquidGlass',
    };
  };
}

if (typeof window !== 'undefined') {
  window.artplayerPluginLiquidGlass = artplayerPluginLiquidGlass;
}
