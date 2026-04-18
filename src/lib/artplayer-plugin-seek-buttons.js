/**
 * ArtPlayer 快进/快退按钮插件
 * 在控制栏添加 ±10秒 的快进/快退按钮
 */

export default function artplayerPluginSeekButtons(option = {}) {
  return (art) => {
    const {
      seekTime = 10, // 默认快进/快退 10 秒
    } = option;

    // SVG 图标 - 后退10秒（YouTube风格：逆时针圆弧箭头 + 数字10）
    const backwardIcon = `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
        <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12h-2.5c0 5.247-4.253 9.5-9.5 9.5S6.5 21.247 6.5 16 10.753 6.5 16 6.5c2.858 0 5.42 1.265 7.176 3.265L20 13h8V5l-2.94 2.94C22.697 5.39 19.547 4 16 4z" fill="currentColor"/>
        <text x="16" y="19" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor" font-family="Arial, sans-serif">10</text>
      </svg>
    `;

    // SVG 图标 - 前进10秒（YouTube风格：顺时针圆弧箭头 + 数字10）
    const forwardIcon = `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
        <path d="M16 4c6.627 0 12 5.373 12 12s-5.373 12-12 12S4 22.627 4 16h2.5c0 5.247 4.253 9.5 9.5 9.5s9.5-4.253 9.5-9.5S21.247 6.5 16 6.5c-2.858 0-5.42 1.265-7.176 3.265L12 13H4V5l2.94 2.94C9.303 5.39 12.453 4 16 4z" fill="currentColor"/>
        <text x="16" y="19" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor" font-family="Arial, sans-serif">10</text>
      </svg>
    `;

    // 添加后退按钮
    art.controls.add({
      name: 'seek-backward',
      position: 'left',
      html: backwardIcon,
      tooltip: `后退 ${seekTime} 秒`,
      style: {
        width: '40px',
        height: '40px',
        padding: '8px',
        opacity: '0.9',
        transition: 'all 0.2s ease',
      },
      mounted: ($el) => {
        // 添加悬停效果
        $el.addEventListener('mouseenter', () => {
          $el.style.opacity = '1';
          $el.style.transform = 'scale(1.1)';
        });
        $el.addEventListener('mouseleave', () => {
          $el.style.opacity = '0.9';
          $el.style.transform = 'scale(1)';
        });
      },
      click: function () {
        const newTime = Math.max(0, art.currentTime - seekTime);
        art.seek = newTime;
        art.notice.show = `⏪ 后退 ${seekTime} 秒`;
      },
    });

    // 添加前进按钮
    art.controls.add({
      name: 'seek-forward',
      position: 'left',
      html: forwardIcon,
      tooltip: `前进 ${seekTime} 秒`,
      style: {
        width: '40px',
        height: '40px',
        padding: '8px',
        opacity: '0.9',
        transition: 'all 0.2s ease',
      },
      mounted: ($el) => {
        // 添加悬停效果
        $el.addEventListener('mouseenter', () => {
          $el.style.opacity = '1';
          $el.style.transform = 'scale(1.1)';
        });
        $el.addEventListener('mouseleave', () => {
          $el.style.opacity = '0.9';
          $el.style.transform = 'scale(1)';
        });
      },
      click: function () {
        const newTime = Math.min(art.duration, art.currentTime + seekTime);
        art.seek = newTime;
        art.notice.show = `⏩ 前进 ${seekTime} 秒`;
      },
    });

    return {
      name: 'artplayerPluginSeekButtons',
    };
  };
}
