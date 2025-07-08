import { NextRequest, NextResponse } from 'next/server';

const getMetaTag = (html: string, property: string) => {
  // More robust regex to handle different attribute orders and quotes
  const regex = new RegExp(`<meta[^>]*?(?:name|property)=["']${property}["'][^>]*?content=["']([^"']*)["']`);
  const match = html.match(regex);
  return match ? match[1] : null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36'
      },
      redirect: 'follow',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();

    const title = getMetaTag(html, 'og:title') || html.match(/<title>([^<]*)<\/title>/)?.[1] || '';
    const description = getMetaTag(html, 'og:description') || getMetaTag(html, 'description') || '';
    const image = getMetaTag(html, 'og:image') || getMetaTag(html, 'twitter:image') || '';
    
    let publisher = '';
    try {
        publisher = new URL(url).hostname.replace(/^www\./, '');
    } catch {}

    const metadata = {
      title,
      description,
      image,
      publisher,
      url: response.url, // Use the final URL after redirects
    };

    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Error fetching link metadata:', error);
    return NextResponse.json({ error: 'Failed to fetch link metadata' }, { status: 500 });
  }
} 