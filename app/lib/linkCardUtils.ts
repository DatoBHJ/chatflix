import type { LinkMetaEntry, LinkCardData, LinkMetadataResult } from '@/app/types/linkPreview';

export const ensureProtocol = (value?: string): string => {
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

export const extractDomain = (url?: string): string => {
  if (!url) return '';
  try {
    const normalizedUrl = ensureProtocol(url);
    return new URL(normalizedUrl).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export const formatPublishedDate = (dateInput?: string | null) => {
  if (!dateInput) return null;
  const parsedDate = new Date(dateInput);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }
  return parsedDate.toLocaleDateString();
};

export const getSeedGradient = (seed?: string) => {
  if (!seed) {
    return 'linear-gradient(135deg, #4f46e5, #9333ea)';
  }
  
  const charCodes = seed.split('').map(char => char.charCodeAt(0));
  const hue = charCodes.reduce((acc, code) => acc + code, 0) % 360;
  const secondaryHue = (hue + 25) % 360;
  
  return `linear-gradient(135deg, hsl(${hue} 75% 55%), hsl(${secondaryHue} 70% 45%))`;
};

export const linkMetaEntryToCardData = (entry: LinkMetaEntry): LinkCardData | null => {
  if (!entry?.url) return null;
  const metadata: LinkMetadataResult | undefined =
    entry.metadata ||
    (entry.favicon || entry.domain || entry.thumbnail
      ? {
          title: entry.title,
          description: entry.summary,
          image: entry.thumbnail || undefined,
          favicon: entry.favicon || undefined,
          publisher: entry.domain || undefined,
          url: entry.url
        }
      : undefined);
  return {
    url: entry.url,
    title: entry.title ?? null,
    summary: entry.summary ?? null,
    content: entry.summary ?? null,
    domain: entry.domain ?? null,
    fallbackSeed: entry.url || `${entry.topic || ''}-${entry.query || ''}`,
    thumbnail: entry.thumbnail ?? entry.metadata?.image ?? null,
    metadata: metadata ?? null,
    snippetHighlightedWords: entry.snippetHighlightedWords ?? [],
    author: entry.author ?? null,
    publishedDate: entry.publishedDate ?? null,
    topic: entry.topic ?? null,
    searchQuery: entry.query ?? null,
    score: entry.score ?? null,
    source: entry.source ?? null
  };
};

