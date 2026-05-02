/* eslint-disable no-console */

'use client';

import { Film, Popcorn, Sparkles, Star } from 'lucide-react';
import { useEffect, useState } from 'react';

const loadingMessages = [
  { icon: Film, text: '正在为您准备今晚的观影清单...', emoji: '🎬' },
  { icon: Popcorn, text: '爆米花准备好了吗？', emoji: '🍿' },
  { icon: Star, text: '发现了数百部精彩影片...', emoji: '⭐' },
  { icon: Sparkles, text: '正在寻找最适合您的推荐...', emoji: '✨' },
];

const starPositions = [
  { left: 12, top: 18, delay: 0.2, duration: 3.4 },
  { left: 28, top: 72, delay: 1.1, duration: 4.1 },
  { left: 43, top: 26, delay: 2.2, duration: 3.8 },
  { left: 58, top: 84, delay: 0.7, duration: 4.7 },
  { left: 69, top: 15, delay: 1.8, duration: 3.2 },
  { left: 76, top: 52, delay: 2.8, duration: 4.4 },
  { left: 86, top: 33, delay: 0.4, duration: 3.9 },
  { left: 93, top: 68, delay: 1.5, duration: 4.8 },
];

export function CinematicLoadingFallback() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [bingWallpaper, setBingWallpaper] = useState('');

  useEffect(() => {
    const fetchBingWallpaper = async () => {
      try {
        const response = await fetch('/api/bing-wallpaper');
        const data = await response.json();
        if (data.url) {
          setBingWallpaper(data.url);
        }
      } catch (error) {
        console.log('Failed to fetch Bing wallpaper:', error);
      }
    };

    fetchBingWallpaper();
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const currentMessage = loadingMessages[messageIndex];
  const IconComponent = currentMessage.icon;

  return (
    <div
      className={`min-h-screen flex items-center justify-center relative overflow-hidden transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {bingWallpaper ? (
        <div
          className='absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000'
          style={{ backgroundImage: `url(${bingWallpaper})` }}
        />
      ) : (
        <div className='absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-black' />
      )}

      <div className='absolute inset-0 bg-gradient-to-br from-purple-600/40 via-blue-600/30 to-pink-500/40 dark:from-purple-900/50 dark:via-blue-900/40 dark:to-pink-900/50' />
      <div className='absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30' />

      <div className='absolute inset-0 overflow-hidden'>
        {starPositions.map((star, i) => (
          <div
            key={i}
            className='absolute w-1 h-1 bg-white rounded-full animate-twinkle'
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}
      </div>

      <div className='relative z-10 text-center px-4 max-w-md'>
        <div className='mb-8 relative'>
          <div className='absolute inset-0 flex items-center justify-center'>
            <div className='w-32 h-32 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow' />
          </div>

          <div className='relative flex items-center justify-center'>
            <div className='w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center animate-spin-gentle backdrop-blur-sm border-2 border-white/10'>
              <div className='absolute w-3 h-3 bg-gray-900 rounded-full top-2 left-2' />
              <div className='absolute w-3 h-3 bg-gray-900 rounded-full top-2 right-2' />
              <div className='absolute w-3 h-3 bg-gray-900 rounded-full bottom-2 left-2' />
              <div className='absolute w-3 h-3 bg-gray-900 rounded-full bottom-2 right-2' />

              <div className='w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center'>
                <IconComponent className='w-10 h-10 text-white' />
              </div>
            </div>
          </div>
        </div>

        <div className='mb-6 space-y-3'>
          <div className='text-4xl'>{currentMessage.emoji}</div>
          <h2 className='text-xl font-medium text-white transition-opacity duration-500'>
            {currentMessage.text}
          </h2>
        </div>

        <div className='flex justify-center gap-2 mb-8'>
          <div
            className='w-3 h-3 bg-blue-500 rounded-full animate-pulse-dot'
            style={{ animationDelay: '0s' }}
          />
          <div
            className='w-3 h-3 bg-purple-500 rounded-full animate-pulse-dot'
            style={{ animationDelay: '0.15s' }}
          />
          <div
            className='w-3 h-3 bg-pink-500 rounded-full animate-pulse-dot'
            style={{ animationDelay: '0.3s' }}
          />
        </div>

        <div className='mt-8 p-3 bg-gray-800/30 rounded-lg border border-gray-700/30 backdrop-blur-sm'>
          <p className='text-sm text-gray-400'>
            💡 快捷键{' '}
            <kbd className='px-2 py-0.5 bg-gray-700/50 rounded text-xs mx-1'>
              Space
            </kbd>{' '}
            播放/暂停
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes twinkle {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.8;
          }
        }

        @keyframes spin-gentle {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse-slow {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }

        @keyframes pulse-dot {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        .animate-twinkle {
          animation: twinkle ease-in-out infinite;
        }

        .animate-spin-gentle {
          animation: spin-gentle 6s linear infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }

        .animate-pulse-dot {
          animation: pulse-dot 1.4s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-twinkle,
          .animate-spin-gentle,
          .animate-pulse-slow,
          .animate-pulse-dot {
            animation: none !important;
          }
        }

        kbd {
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}
