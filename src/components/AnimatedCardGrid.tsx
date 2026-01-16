'use client';

import React from 'react';

interface AnimatedCardGridProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * 简化版卡片网格组件
 * 移除 framer-motion 动画，使用纯 CSS 实现轻量级淡入效果
 * 大幅提升低配设备的渲染性能
 */
export default function AnimatedCardGrid({
  children,
  className = '',
}: AnimatedCardGridProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <div
          key={index}
          className="inline-block animate-fade-in"
          style={{
            animationDelay: `${Math.min(index * 30, 300)}ms`, // 最多延迟 300ms
            animationFillMode: 'backwards',
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
