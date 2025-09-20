import { NextRequest, NextResponse } from 'next/server';

const getMetaTag = (html: string, property: string) => {
  // More robust regex to handle different attribute orders and quotes
  const regex = new RegExp(`<meta[^>]*?(?:name|property)=["']${property}["'][^>]*?content=["']([^"']*)["']`);
  const match = html.match(regex);
  return match ? match[1] : null;
};

const getFavicon = (html: string, baseUrl: string) => {
  // Try to find favicon from link tags in order of preference
  const faviconPatterns = [
    /<link[^>]*?rel=["'](?:shortcut )?icon["'][^>]*?href=["']([^"']*)["']/i,
    /<link[^>]*?href=["']([^"']*)["'][^>]*?rel=["'](?:shortcut )?icon["']/i,
    /<link[^>]*?rel=["']apple-touch-icon["'][^>]*?href=["']([^"']*)["']/i,
    /<link[^>]*?href=["']([^"']*)["'][^>]*?rel=["']apple-touch-icon["']/i
  ];

  for (const pattern of faviconPatterns) {
    const match = html.match(pattern);
    if (match) {
      const href = match[1];
      // Convert relative URLs to absolute
      if (href.startsWith('//')) {
        return `https:${href}`;
      } else if (href.startsWith('/')) {
        const url = new URL(baseUrl);
        return `${url.protocol}//${url.host}${href}`;
      } else if (!href.startsWith('http')) {
        const url = new URL(baseUrl);
        return `${url.protocol}//${url.host}/${href}`;
      }
      return href;
    }
  }

  // Fallback to default favicon.ico
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}/favicon.ico`;
  } catch {
    return null;
  }
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

// TikTok URL detection and video ID extraction
const extractTikTokVideoId = (url: string): string | null => {
  const patterns = [
    /tiktok\.com\/@([^\/]+)\/video\/(\d+)/,
    /tiktok\.com\/.*\/video\/(\d+)/,
    /vm\.tiktok\.com\/([^\/\?]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1] || match[2];
    }
  }
  return null;
};

// Check if URL is TikTok
const isTikTokUrl = (url: string): boolean => {
  return url.includes('tiktok.com') || url.includes('vm.tiktok.com');
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
    favicon: 'https://www.youtube.com/favicon.ico',
    publisher: 'YouTube',
    url: url,
  };
};

// Get TikTok metadata - since TikTok doesn't have oEmbed, we'll use a fallback approach
const getTikTokMetadata = async (url: string) => {
  const videoId = extractTikTokVideoId(url);
  if (!videoId) {
    throw new Error('Invalid TikTok URL');
  }

  // Extract username from URL if available
  const usernameMatch = url.match(/tiktok\.com\/@([^\/]+)/);
  const username = usernameMatch ? usernameMatch[1] : '';

  // Since TikTok doesn't provide oEmbed API and requires JavaScript for dynamic content,
  // we'll provide a generic but more informative title
  const title = username 
    ? `TikTok Video by @${username}`
    : 'TikTok Video';

  return {
    title: title,
    description: 'Watch this video on TikTok',
    image: '', // TikTok doesn't provide static thumbnails via API
    favicon: 'https://www.tiktok.com/favicon.ico',
    publisher: 'TikTok',
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
    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Skip non-HTTP/HTTPS URLs (like data:, file:, etc.)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are supported' }, { status: 400 });
    }

    // Skip malformed URLs with quotes or invalid characters
    if (url.includes("'") || url.includes('"') || url.includes('\\')) {
      return NextResponse.json({ error: 'URL contains invalid characters' }, { status: 400 });
    }

    // Skip SVG namespace URLs and other non-webpage URLs
    if (parsedUrl.hostname === 'www.w3.org' && parsedUrl.pathname.includes('/2000/svg')) {
      return NextResponse.json({ error: 'SVG namespace URLs are not supported' }, { status: 400 });
    }

    // Skip URLs that are clearly not actual web pages (like namespace URLs)
    const invalidHostnames = ['www.w3.org', 'xmlns.com', 'schema.org'];
    if (invalidHostnames.some(host => parsedUrl.hostname.includes(host))) {
      return NextResponse.json({ error: 'Namespace URLs are not supported' }, { status: 400 });
    }

    // Check if it's a YouTube URL
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      // Use YouTube oEmbed API for YouTube URLs
      const metadata = await getYouTubeMetadata(url);
      return NextResponse.json(metadata);
    }

    // Check if it's a TikTok URL
    if (isTikTokUrl(url)) {
      // Use TikTok metadata function for TikTok URLs
      const metadata = await getTikTokMetadata(url);
      return NextResponse.json(metadata);
    }

    // For non-YouTube URLs, use the existing scraping method
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      redirect: 'follow',
    });

    // if (!response.ok) {
    //     throw new Error(`Failed to fetch URL: ${response.statusText}`);
    // }

    const html = await response.text();

    const title = getMetaTag(html, 'og:title') || html.match(/<title>([^<]*)<\/title>/)?.[1] || '';
    const description = getMetaTag(html, 'og:description') || getMetaTag(html, 'description') || '';
    const image = getMetaTag(html, 'og:image') || getMetaTag(html, 'twitter:image') || '';
    const favicon = getFavicon(html, url);
    
    let publisher = '';
    try {
        publisher = new URL(url).hostname.replace(/^www\./, '');
    } catch {}

    const metadata = {
      title,
      description,
      image,
      favicon,
      publisher,
      url: response.url, // Use the final URL after redirects
    };

    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Error fetching link metadata:', error);
    console.error('URL that failed:', url);
    return NextResponse.json({ 
      error: 'Failed to fetch link metadata', 
      details: error instanceof Error ? error.message : 'Unknown error',
      url: url 
    }, { status: 500 });
  }
} 