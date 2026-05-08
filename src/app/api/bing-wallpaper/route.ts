import { NextResponse } from 'next/server';

export const revalidate = 600;

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=600, s-maxage=600',
  'CDN-Cache-Control': 'public, s-maxage=600',
  'Vercel-CDN-Cache-Control': 'public, s-maxage=600',
};

export async function GET() {
  try {
    const useBing = Math.random() < 0.7;

    if (useBing) {
      const randomIdx = Math.floor(Math.random() * 8);
      const response = await fetch(
        `https://www.bing.com/HPImageArchive.aspx?format=js&idx=${randomIdx}&n=1&mkt=zh-CN`,
        {
          next: { revalidate: 600 },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Bing wallpaper');
      }

      const data = await response.json();

      if (data.images && data.images[0]) {
        return NextResponse.json(
          {
            url: `https://www.bing.com${data.images[0].url}`,
            copyright: data.images[0].copyright,
            title: data.images[0].title,
            source: 'bing',
          },
          { headers: CACHE_HEADERS },
        );
      }
    }

    return NextResponse.json(
      {
        url: `https://picsum.photos/1920/1080?random=${Date.now()}`,
        copyright: 'Lorem Picsum - Free random images',
        title: 'Random Photo',
        source: 'picsum',
      },
      { headers: CACHE_HEADERS },
    );
  } catch (error) {
    console.error('Error fetching wallpaper:', error);

    return NextResponse.json(
      {
        url: `https://picsum.photos/1920/1080?random=${Date.now()}`,
        copyright: 'Lorem Picsum - Free random images',
        title: 'Random Photo',
        source: 'picsum',
      },
      { headers: CACHE_HEADERS },
    );
  }
}
