import type { LinkMetadataResult } from '@/app/types/linkPreview';

export class LinkMetadataError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'LinkMetadataError';
    this.status = status;
  }
}

const getMetaTag = (html: string, property: string) => {
  const regex = new RegExp(`<meta[^>]*?(?:name|property)=["']${property}["'][^>]*?content=["']([^"']*)["']`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
};

const getFavicon = (html: string, baseUrl: string) => {
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

  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}/favicon.ico`;
  } catch {
    return null;
  }
};

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

const isTikTokUrl = (url: string): boolean =>
  url.includes('tiktok.com') || url.includes('vm.tiktok.com');

const getYouTubeMetadata = async (url: string): Promise<LinkMetadataResult> => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new LinkMetadataError('Invalid YouTube URL', 400);
  }

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const response = await fetch(oembedUrl);
  if (!response.ok) {
    throw new LinkMetadataError(`YouTube oEmbed API failed: ${response.status}`, response.status);
  }

  const data = await response.json();
  return {
    title: data.title || '',
    description: '',
    image: data.thumbnail_url || '',
    favicon: 'https://www.youtube.com/favicon.ico',
    publisher: 'YouTube',
    url
  };
};

const getTikTokMetadata = async (url: string): Promise<LinkMetadataResult> => {
  const videoId = extractTikTokVideoId(url);
  if (!videoId) {
    throw new LinkMetadataError('Invalid TikTok URL', 400);
  }

  const usernameMatch = url.match(/tiktok\.com\/@([^\/]+)/);
  const username = usernameMatch ? usernameMatch[1] : '';
  const title = username ? `TikTok Video by @${username}` : 'TikTok Video';

  return {
    title,
    description: 'Watch this video on TikTok',
    image: '',
    favicon: 'https://www.tiktok.com/favicon.ico',
    publisher: 'TikTok',
    url
  };
};

const invalidHostnames = ['www.w3.org', 'xmlns.com', 'schema.org'];

const normalizeInputUrl = (value: string): string => {
  if (!value) {
    throw new LinkMetadataError('URL is required', 400);
  }

  if (value.includes("'") || value.includes('"') || value.includes('\\')) {
    throw new LinkMetadataError('URL contains invalid characters', 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new LinkMetadataError('Invalid URL format', 400);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new LinkMetadataError('Only HTTP/HTTPS URLs are supported', 400);
  }

  if (parsed.hostname === 'www.w3.org' && parsed.pathname.includes('/2000/svg')) {
    throw new LinkMetadataError('SVG namespace URLs are not supported', 400);
  }

  if (invalidHostnames.some(host => parsed.hostname.includes(host))) {
    throw new LinkMetadataError('Namespace URLs are not supported', 400);
  }

  return parsed.toString();
};

export const fetchLinkMetadata = async (rawUrl: string): Promise<LinkMetadataResult> => {
  const normalizedUrl = normalizeInputUrl(rawUrl);

  if (extractYouTubeVideoId(normalizedUrl)) {
    return getYouTubeMetadata(normalizedUrl);
  }

  if (isTikTokUrl(normalizedUrl)) {
    return getTikTokMetadata(normalizedUrl);
  }

  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      redirect: 'follow'
    });

    const html = await response.text();
    const title = getMetaTag(html, 'og:title') || html.match(/<title>([^<]*)<\/title>/)?.[1] || '';
    const description = getMetaTag(html, 'og:description') || getMetaTag(html, 'description') || '';
    const image = getMetaTag(html, 'og:image') || getMetaTag(html, 'twitter:image') || '';
    const favicon = getFavicon(html, normalizedUrl) || undefined;

    let publisher = '';
    try {
      publisher = new URL(normalizedUrl).hostname.replace(/^www\./, '');
    } catch {
      publisher = '';
    }

    return {
      title,
      description,
      image,
      favicon,
      publisher,
      url: response.url || normalizedUrl
    };
  } catch (error: any) {
    if (error instanceof LinkMetadataError) {
      throw error;
    }

    throw new LinkMetadataError(
      error?.message || 'Failed to fetch link metadata',
      error?.status || 500
    );
  }
};

