import { NextRequest, NextResponse } from 'next/server';

const getMetaTag = (html: string, property: string) => {
  // More robust regex to handle different attribute orders and quotes
  const regex = new RegExp(`<meta[^>]*?(?:name|property)=["']${property}["'][^>]*?content=["']([^"']*)["']`);
  const match = html.match(regex);
  return match ? match[1] : null;
};

// YouTube URL detection and video ID extraction
const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
};

// Get YouTube metadata using oEmbed API
const getYouTubeMetadata = async (url: string) => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  // Use YouTube oEmbed API
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  
  const response = await fetch(oembedUrl);
  if (!response.ok) {
    throw new Error(`YouTube oEmbed API failed: ${response.status}`);
  }

  const data = await response.json();
  
  return {
    title: data.title || '',
    description: '', // oEmbed doesn't provide description
    image: data.thumbnail_url || '',
    publisher: 'YouTube',
    url: url,
  };
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    // Check if it's a YouTube URL
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      // Use YouTube oEmbed API for YouTube URLs
      const metadata = await getYouTubeMetadata(url);
      return NextResponse.json(metadata);
    }

    // For non-YouTube URLs, use the existing scraping method
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