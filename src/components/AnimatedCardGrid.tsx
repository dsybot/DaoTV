'use client';

import React, { useEffect, useState } from 'react';

interface AnimatedCardGridProps {
  children: React.ReactNode;
  className?: string;
}

// 容器动画配置 - 简化以提升性能
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03, // 减少延迟从 80ms 到 30ms
      delayChildren: 0, // 移除首个元素延迟
    },
  },
};

// 子元素动画配置 - 使用简单的 duration 替代 spring 以提升性能
const itemVariants = {
  hidden: {
    opacity: 0,
    y: 10, // 减少位移距离
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2, // 使用简单的 duration 替代复杂的 spring 动画
      ease: 'easeOut' as const,
    },
  },
};

type MotionDivComponent = typeof import('framer-motion').motion.div;

export default function AnimatedCardGrid({
  children,
  className = '',
}: AnimatedCardGridProps) {
  const [MotionDiv, setMotionDiv] = useState<MotionDivComponent | null>(null);

  useEffect(() => {
    // 动态导入 framer-motion，仅在客户端加载
    import('framer-motion').then((mod) => {
      setMotionDiv(() => mod.motion.div);
    });
  }, []);

  // 在 framer-motion 加载前显示静态内容
  if (!MotionDiv) {
    return (
      <div className={className}>
        {React.Children.map(children, (child, index) => (
          <div key={index} className='inline-block'>
            {child}
          </div>
        ))}
      </div>
    );
  }

  return (
    <MotionDiv
      className={className}
      variants={containerVariants}
      initial='hidden'
      animate='visible'
    >
      {React.Children.map(children, (child, index) => (
        <MotionDiv key={index} variants={itemVariants} className='inline-block'>
          {child}
        </MotionDiv>
      ))}
    </MotionDiv>
  );
}
