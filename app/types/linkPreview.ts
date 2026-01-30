export interface LinkMetadataResult {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  publisher?: string;
  url?: string;
}

export interface LinkMetaEntry {
  url?: string;
  title?: string;
  summary?: string;
  domain?: string;
  topic?: string;
  query?: string;
  thumbnail?: string | null;
  author?: string | null;
  publishedDate?: string | null;
  score?: number | null;
  snippetHighlightedWords?: string[];
  source?: string | null;
  favicon?: string | null;
  metadata?: LinkMetadataResult | null;
}

export interface LinkCardData {
  url: string;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  domain?: string | null;
  fallbackSeed?: string;
  thumbnail?: string | null;
  metadata?: LinkMetadataResult | null;
  snippetHighlightedWords?: string[];
  author?: string | null;
  publishedDate?: string | null;
  topic?: string | null;
  topicIcon?: string | null;
  searchQuery?: string | null;
  score?: number | null;
  source?: string | null;
  linkId?: string;
}

