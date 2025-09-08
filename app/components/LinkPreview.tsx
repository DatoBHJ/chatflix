'use client';

import { useState, useEffect } from 'react';
import ColorThief from 'colorthief';

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
  const [colors, setColors] = useState<{ background: string; text: string; domainText: string; } | null>(null);

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
        {metadata.image && (
            <img src={metadata.image} alt={metadata.title} className="preview-image" />
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
            <p 
                className="preview-domain"
                style={colors ? { color: colors.domainText } : {}}
            >
                {metadata.publisher || getDomain(metadata.url)}
            </p>
        </div>
    </a>
  );
}; 