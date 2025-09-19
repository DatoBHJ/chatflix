'use client';

import { useState, useEffect } from 'react';
import ColorThief from 'colorthief';

// HTML 엔티티 디코딩 함수 (10진수 및 16진수 엔티티 모두 처리)
const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  
  // 먼저 16진수 엔티티 디코딩 (&#x...;)
  let decoded = text.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  // 10진수 엔티티 디코딩 (&#...;)
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });
  
  // 일반적인 HTML 엔티티 디코딩
  const textarea = document.createElement('textarea');
  textarea.innerHTML = decoded;
  return textarea.value;
};

interface LinkMetadata {
  title: string;
  description: string;
  image: string;
  favicon?: string;
  publisher: string;
  url: string;
}

interface LinkPreviewProps {
  url: string;
  thumbnailUrl?: string; // 🚀 FEATURE: Optional thumbnail URL from SearchAPI
  searchApiTitle?: string; // 🚀 FEATURE: Optional title from SearchAPI
}

export const LinkPreview = ({ url, thumbnailUrl, searchApiTitle }: LinkPreviewProps) => {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [colors, setColors] = useState<{ background: string; text: string; domainText: string; } | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [faviconLoadError, setFaviconLoadError] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        // Reset error states when fetching new metadata
        setImageLoadError(false);
        setFaviconLoadError(false);
        
        // If we have a thumbnail URL from SearchAPI, try to get proper metadata first
        if (thumbnailUrl) {
          try {
            // Still fetch metadata for proper title, but use SearchAPI thumbnail
            const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
            if (response.ok) {
              const data = await response.json();
              
              // Use SearchAPI title if available and API title is generic
              const isGenericTitle = data.title && (
                data.title.includes('Reddit - The heart of the internet') ||
                data.title === 'Instagram' ||
                data.title === 'Facebook' ||
                data.title.startsWith('Twitter') ||
                data.title.includes(' - Instagram')
              );
              
              const finalTitle = (searchApiTitle && isGenericTitle) 
                ? searchApiTitle 
                : (data.title ? decodeHtmlEntities(data.title) : data.title);
              
              setMetadata({
                ...data,
                title: finalTitle,
                description: data.description ? decodeHtmlEntities(data.description) : data.description,
                image: thumbnailUrl // Override with SearchAPI thumbnail
              });
            } else {
              // Fallback to domain name if API fails
              const domain = new URL(url).hostname.replace(/^www\./, '');
              setMetadata({
                title: domain,
                description: '',
                image: thumbnailUrl,
                publisher: domain,
                url: url
              });
            }
          } catch (e) {
            // Fallback to domain name if fetch fails
            const domain = new URL(url).hostname.replace(/^www\./, '');
            setMetadata({
              title: domain,
              description: '',
              image: thumbnailUrl,
              publisher: domain,
              url: url
            });
          }
          setLoading(false);
          return;
        }
        
        // Otherwise, fetch metadata from the API
        const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch preview');
        }
        const data = await response.json();
        
        // Use SearchAPI title if available and API title is generic
        const isGenericTitle = data.title && (
          data.title.includes('Reddit - The heart of the internet') ||
          data.title === 'Instagram' ||
          data.title === 'Facebook' ||
          data.title.startsWith('Twitter') ||
          data.title.includes(' - Instagram')
        );
        
        const finalTitle = (searchApiTitle && isGenericTitle) 
          ? searchApiTitle 
          : (data.title ? decodeHtmlEntities(data.title) : data.title);
        
        setMetadata({
          ...data,
          title: finalTitle,
          description: data.description ? decodeHtmlEntities(data.description) : data.description
        });
      } catch (e) {
        // Silently fail and just show the link as a fallback
        setMetadata(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [url, thumbnailUrl]);

  useEffect(() => {
    if (metadata?.image) {
      const colorThief = new ColorThief();
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = metadata.image;

      img.onload = () => {
        try {
            const dominantColor = colorThief.getColor(img);
            const palette = colorThief.getPalette(img, 5);

            // Function to calculate luminance
            const getLuminance = (rgb: number[]) => {
                const [r, g, b] = rgb.map(c => {
                    const s = c / 255;
                    return (s <= 0.03928) ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
                });
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };

            const dominantLuminance = getLuminance(dominantColor);
            
            // Determine text color based on luminance
            const primaryTextColor = dominantLuminance > 0.4 ? '#000000' : '#FFFFFF';
            const secondaryTextColor = dominantLuminance > 0.4 ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)';

            setColors({
                background: `rgb(${dominantColor.join(',')})`,
                text: primaryTextColor,
                domainText: secondaryTextColor,
            });
        } catch (error) {
            console.error('Error getting color from image:', error);
            setColors(null); // Fallback to default styles
        }
      };
      
      img.onerror = (error) => {
        setColors(null); // Fallback to default styles
      };
    }
  }, [metadata]);

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
        <div className="my-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="imessage-link-preview-fallback">
              {getDomain(url)}
          </a>
        </div>
    );
  }

  return (
    <a href={metadata.url} target="_blank" rel="noopener noreferrer" className="imessage-link-preview">
        {metadata.image && !imageLoadError && (
            <img 
                src={metadata.image} 
                alt={metadata.title} 
                className="preview-image"
                onError={(e) => {
                    console.warn(`Failed to load image (likely CORS or network error): ${metadata.image}`);
                    setImageLoadError(true);
                }}
                onLoad={() => setImageLoadError(false)}
            />
        )}
        <div 
            className="preview-content"
            style={colors ? { backgroundColor: colors.background } : {}}
        >
            <p 
                className="preview-title" 
                title={metadata.title}
                style={colors ? { color: colors.text } : {}}
            >
                {metadata.title}
            </p>
            <div className="preview-domain-container" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {metadata.favicon && !faviconLoadError && (
                    <img 
                        src={metadata.favicon} 
                        alt="favicon" 
                        className="preview-favicon"
                        style={{ 
                            width: '16px', 
                            height: '16px', 
                            objectFit: 'contain',
                            flexShrink: 0 
                        }}
                        onError={(e) => {
                            console.warn(`Failed to load favicon (likely CORS or network error): ${metadata.favicon}`);
                            setFaviconLoadError(true);
                        }}
                        onLoad={() => setFaviconLoadError(false)}
                    />
                )}
                <p 
                    className="preview-domain"
                    style={colors ? { color: colors.domainText } : {}}
                >
                    {metadata.publisher || getDomain(metadata.url)}
                </p>
            </div>
        </div>
    </a>
  );
}; 