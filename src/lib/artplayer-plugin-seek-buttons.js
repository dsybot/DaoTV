/**
 * ArtPlayer 快进/快退按钮插件
 * 桌面端在控制栏显示两个按钮，移动端显示浮动按钮。
 */

export default function artplayerPluginSeekButtons(option = {}) {
  return (art) => {
    const { seekTime = 10, mobileLayout = 'both' } = option;

    const isSmallScreen = () => window.innerWidth < 768;

    const backwardIcon = `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
        <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12h-2.5c0 5.247-4.253 9.5-9.5 9.5S6.5 21.247 6.5 16 10.753 6.5 16 6.5c2.858 0 5.42 1.265 7.176 3.265L20 13h8V5l-2.94 2.94C22.697 5.39 19.547 4 16 4z" fill="currentColor"/>
        <text x="16" y="19" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor" font-family="Arial, sans-serif">${seekTime}</text>
      </svg>
    `;

    const forwardIcon = `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
        <path d="M16 4c6.627 0 12 5.373 12 12s-5.373 12-12 12S4 22.627 4 16h2.5c0 5.247 4.253 9.5 9.5 9.5s9.5-4.253 9.5-9.5S21.247 6.5 16 6.5c-2.858 0-5.42 1.265-7.176 3.265L12 13H4V5l2.94 2.94C9.303 5.39 12.453 4 16 4z" fill="currentColor"/>
        <text x="16" y="19" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor" font-family="Arial, sans-serif">${seekTime}</text>
      </svg>
    `;

    const seekBackward = () => {
      const newTime = Math.max(0, art.currentTime - seekTime);
      art.seek = newTime;
      art.notice.show = `⏪ 后退 ${seekTime} 秒`;
    };

    const seekForward = () => {
      const newTime = Math.min(art.duration, art.currentTime + seekTime);
      art.seek = newTime;
      art.notice.show = `⏩ 前进 ${seekTime} 秒`;
    };

    if (isSmallScreen()) {
      const createFloatingButton = (side) => {
        const button = document.createElement('div');
        button.className = `art-seek-floating-${side}`;

        const dualIcon = `
          <svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
            <g transform="translate(0, 0) scale(0.65)">
              <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12h-2.5c0 5.247-4.253 9.5-9.5 9.5S6.5 21.247 6.5 16 10.753 6.5 16 6.5c2.858 0 5.42 1.265 7.176 3.265L20 13h8V5l-2.94 2.94C22.697 5.39 19.547 4 16 4z" fill="currentColor"/>
              <text x="16" y="19" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor" font-family="Arial, sans-serif">${seekTime}</text>
            </g>
            <g transform="translate(24, 0) scale(0.65)">
              <path d="M16 4c6.627 0 12 5.373 12 12s-5.373 12-12 12S4 22.627 4 16h2.5c0 5.247 4.253 9.5 9.5 9.5s9.5-4.253 9.5-9.5S21.247 6.5 16 6.5c-2.858 0-5.42 1.265-7.176 3.265L12 13H4V5l2.94 2.94C9.303 5.39 12.453 4 16 4z" fill="currentColor"/>
              <text x="16" y="19" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor" font-family="Arial, sans-serif">${seekTime}</text>
            </g>
          </svg>
        `;
        button.innerHTML = dualIcon;

        button.onclick = (event) => {
          const rect = button.getBoundingClientRect();
          const clickX = event.clientX - rect.left;
          const isLeftHalf = clickX < rect.width / 2;

          if (isLeftHalf) {
            seekBackward();
          } else {
            seekForward();
          }
        };

        return button;
      };

      art.on('ready', () => {
        const buttons = [];

        if (mobileLayout === 'both') {
          const leftButton = createFloatingButton('left');
          const rightButton = createFloatingButton('right');
          art.template.$player.appendChild(leftButton);
          art.template.$player.appendChild(rightButton);
          buttons.push(leftButton, rightButton);
        } else {
          const button = createFloatingButton(mobileLayout);
          art.template.$player.appendChild(button);
          buttons.push(button);
        }

        const updateButtonsVisibility = () => {
          const controlsVisible = art.controls.show;
          buttons.forEach((button) => {
            if (controlsVisible) {
              button.style.opacity = '0.85';
              button.style.pointerEvents = 'auto';
            } else {
              button.style.opacity = '0';
              button.style.pointerEvents = 'none';
            }
          });
        };

        art.on('control', updateButtonsVisibility);
        updateButtonsVisibility();
      });

      if (!document.getElementById('art-seek-floating-style')) {
        const style = document.createElement('style');
        style.id = 'art-seek-floating-style';
        style.textContent = `
          .art-seek-floating-left,
          .art-seek-floating-right {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 80px;
            height: 64px;
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 20;
            opacity: 0;
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease;
            color: white;
            padding: 14px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            pointer-events: none;
          }

          .art-seek-floating-left {
            left: 16px;
          }

          .art-seek-floating-right {
            right: 16px;
          }

          .art-seek-floating-left:active,
          .art-seek-floating-right:active {
            transform: translateY(-50%) scale(0.92);
            background: rgba(255, 255, 255, 0.25);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          }

          .art-fullscreen .art-seek-floating-left,
          .art-fullscreen-web .art-seek-floating-left {
            left: 24px;
          }

          .art-fullscreen .art-seek-floating-right,
          .art-fullscreen-web .art-seek-floating-right {
            right: 24px;
          }

          .art-fullscreen .art-seek-floating-left,
          .art-fullscreen .art-seek-floating-right,
          .art-fullscreen-web .art-seek-floating-left,
          .art-fullscreen-web .art-seek-floating-right {
            width: 96px;
            height: 72px;
            padding: 16px;
          }
        `;
        document.head.appendChild(style);
      }
    } else {
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
          $el.addEventListener('mouseenter', () => {
            $el.style.opacity = '1';
            $el.style.transform = 'scale(1.1)';
          });
          $el.addEventListener('mouseleave', () => {
            $el.style.opacity = '0.9';
            $el.style.transform = 'scale(1)';
          });
        },
        click: seekBackward,
      });

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
          $el.addEventListener('mouseenter', () => {
            $el.style.opacity = '1';
            $el.style.transform = 'scale(1.1)';
          });
          $el.addEventListener('mouseleave', () => {
            $el.style.opacity = '0.9';
            $el.style.transform = 'scale(1)';
          });
        },
        click: seekForward,
      });
    }

    return {
      name: 'artplayerPluginSeekButtons',
    };
  };
}
