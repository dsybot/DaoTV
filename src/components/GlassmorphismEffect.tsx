'use client';

import React from 'react';

interface GlassmorphismEffectProps {
  children: React.ReactNode;
  className?: string;
  intensity?: 'light' | 'medium' | 'strong';
  animated?: boolean;
}

export function GlassmorphismEffect({
  children,
  className = '',
  intensity = 'medium',
  animated = true,
}: GlassmorphismEffectProps) {
  // 根据强度设置不同的模糊和饱和度值
  const intensityConfig = {
    light: {
      blur: 20,
      saturate: 200,
      contrast: 120,
      brightness: 110,
    },
    medium: {
      blur: 28,
      saturate: 240,
      contrast: 120,
      brightness: 110,
    },
    strong: {
      blur: 35,
      saturate: 280,
      contrast: 130,
      brightness: 115,
    },
  };

  const config = intensityConfig[intensity];

  return (
    <div
      className={`glassmorphism-container ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        // 背景模糊和滤镜
        backdropFilter: `blur(${config.blur}px) saturate(${config.saturate}%) contrast(${config.contrast}%) brightness(${config.brightness}%)`,
        WebkitBackdropFilter: `blur(${config.blur}px) saturate(${config.saturate}%) contrast(${config.contrast}%) brightness(${config.brightness}%)`,
        border: '0.5px solid transparent',
        // 阴影
        boxShadow: `
          0px 16px 60px 0px rgba(0, 0, 0, 0.25),
          inset 0 1px 0 0 rgba(255, 255, 255, 0.1),
          inset 0 -1px 0 0 rgba(0, 0, 0, 0.1)
        `,
        filter: 'drop-shadow(0 0 6.4px rgba(0, 0, 0, 0.25))',
        // 3D 变换
        transformStyle: 'preserve-3d',
        willChange: 'transform, filter',
      }}
    >
      {/* 基础背景层 - 使用 Tailwind 深色模式 */}
      <div
        className="absolute inset-0 bg-white/15 dark:bg-gray-900/40"
        style={{
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
      />

      {/* 液态流动效果 */}
      {animated && (
        <div
          className="glassmorphism-flow"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%)',
            animation: 'liquidFlow 6s ease-in-out infinite',
            pointerEvents: 'none',
            borderRadius: 'inherit',
          }}
        />
      )}

      {/* Vibrancy 效果 */}
      <div
        className="glassmorphism-vibrancy"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.04) 0%, transparent 70%)',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
      />

      {/* 径向高光 */}
      <div
        className="glassmorphism-highlight"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(255,255,255,0.04) 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, rgba(255,255,255,0.04) 0%, transparent 50%)
          `,
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
      />

      {/* 渐变叠加 */}
      <div
        className="glassmorphism-gradient"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.033) 0%, transparent 50%, rgba(255,255,255,0.017) 100%)',
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
      />

      {/* 内容 */}
      <div style={{ position: 'relative', zIndex: 1, display: 'contents' }}>
        {children}
      </div>

      <style jsx>{`
        @keyframes liquidFlow {
          0% {
            transform: scale(0.8) rotate(0deg);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.2) rotate(180deg);
            opacity: 0.8;
          }
          100% {
            transform: scale(0.8) rotate(360deg);
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
