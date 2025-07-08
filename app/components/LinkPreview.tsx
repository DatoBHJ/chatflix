'use client';

import { useState, useEffect } from 'react';

interface LinkMetadata {
  title: string;
  description: string;
  image: string;
  publisher: string;
  url: string;
}

interface LinkPreviewProps {
  url: string;
}

export const LinkPreview = ({ url }: LinkPreviewProps) => {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch preview');
        }
        const data = await response.json();
        setMetadata(data);
      } catch (e) {
        // Silently fail and just show the link as a fallback
        setMetadata(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  const getDomain = (urlString: string) => {
    try {
      return new URL(urlString).hostname.replace(/^www\./, '');
    } catch {
      return urlString;
    }
  }

  if (loading) {
    return <div className="imessage-link-preview-loading">{getDomain(url)}</div>;
  }
  
  if (!metadata || !metadata.title) {
     return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="imessage-link-preview-fallback">
            {getDomain(url)}
        </a>
    );
  }

  return (
    <a href={metadata.url} target="_blank" rel="noopener noreferrer" className="imessage-link-preview">
        {metadata.image && (
            <img src={metadata.image} alt={metadata.title} className="preview-image" />
        )}
        <div className="preview-content">
            <p className="preview-title" title={metadata.title}>{metadata.title}</p>
            <p className="preview-domain">{metadata.publisher || getDomain(metadata.url)}</p>
        </div>
    </a>
  );
}; 