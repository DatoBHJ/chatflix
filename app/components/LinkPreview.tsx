'use client';

import { useState, useEffect, useMemo } from 'react';
import ColorThief from 'colorthief';
import { useLazyLoad } from '@/app/hooks/useIntersectionObserver';
import { linkMetadataCache } from '@/app/lib/linkMetadataCache';

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
  isVideoLink?: boolean; // 🚀 FEATURE: Indicates if this is a video link
  videoDuration?: string; // 🚀 FEATURE: Video duration for video links
}

export const LinkPreview = ({ url, thumbnailUrl, searchApiTitle, isVideoLink = false, videoDuration }: LinkPreviewProps) => {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [colors, setColors] = useState<{ background: string; text: string; domainText: string; } | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [faviconLoadError, setFaviconLoadError] = useState(false);

  // 🚀 Intersection Observer로 뷰포트 최적화
  const { ref, shouldLoad } = useLazyLoad(150);

  // 🚀 즉시 기본 메타데이터 설정
  const getDomainName = (urlString: string) => {
    try {
      return new URL(urlString).hostname.replace(/^www\./, '');
    } catch {
      return urlString;
    }
  };

  // 🚀 초기 메타데이터 즉시 설정
  const initialMetadata = useMemo(() => {
    const domain = getDomainName(url);
    return {
      title: searchApiTitle || domain,
      description: '',
      image: thumbnailUrl || '',
      publisher: domain,
      url: url
    };
  }, [url, searchApiTitle, thumbnailUrl]);

  useEffect(() => {
    // 🚀 즉시 초기 메타데이터 설정 (동기적으로)
    setMetadata(initialMetadata);
    
    // 🚀 SearchAPI 데이터가 있으면 캐시에 저장
    if (thumbnailUrl && searchApiTitle) {
      linkMetadataCache.setSearchApiData(url, searchApiTitle, thumbnailUrl);
    }
  }, [url, searchApiTitle, thumbnailUrl, initialMetadata]);

  // 🚀 초기 렌더링 시 즉시 메타데이터 설정 (동기적)
  if (!metadata) {
    setMetadata(initialMetadata);
  }

  // 🚀 뷰포트에 들어왔을 때만 메타데이터 가져오기
  useEffect(() => {
    if (!shouldLoad) return;

    const fetchMetadata = async () => {
      try {
        // 🚀 캐시에서 먼저 확인
        const cached = linkMetadataCache.get(url);
        if (cached) {
          setMetadata(cached);
          return;
        }

        setLoading(true);
        setImageLoadError(false);
        setFaviconLoadError(false);
        
        // 🚀 SearchAPI 데이터가 있으면 우선 사용하고 백그라운드에서 보완
        if (thumbnailUrl && searchApiTitle) {
          const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
          if (response.ok) {
            const data = await response.json();
            
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
            
            const enhancedMetadata = {
              ...data,
              title: finalTitle,
              description: data.description ? decodeHtmlEntities(data.description) : data.description,
              image: thumbnailUrl // SearchAPI 썸네일 우선 사용
            };
            
            // 🚀 캐시에 저장
            linkMetadataCache.set(url, enhancedMetadata);
            setMetadata(enhancedMetadata);
          }
          setLoading(false);
          return;
        }
        
        // 🚀 SearchAPI 데이터가 없으면 백그라운드에서 메타데이터 가져오기
        const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch preview');
        }
        const data = await response.json();
        
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
        
        const enhancedMetadata = {
          ...data,
          title: finalTitle,
          description: data.description ? decodeHtmlEntities(data.description) : data.description
        };
        
        // 🚀 캐시에 저장
        linkMetadataCache.set(url, enhancedMetadata);
        setMetadata(enhancedMetadata);
      } catch (e) {
        // 🚀 실패해도 초기 메타데이터 유지
        console.warn('Failed to fetch link metadata:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [shouldLoad, url, thumbnailUrl, searchApiTitle]);

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

  // 🚀 로딩 스켈레톤 완전 제거 - 항상 기본 링크 표시
  
  // 🚀 항상 동일한 카드 구조 사용 (가로 길이 일관성 완전 보장)
  const displayMetadata = metadata || initialMetadata;
  const hasImage = displayMetadata?.image && !imageLoadError;
  const displayTitle = displayMetadata?.title || getDomainName(url);
  const displayPublisher = displayMetadata?.publisher || getDomainName(url);

  return (
    <div ref={ref}>
      <a href={displayMetadata?.url || url} target="_blank" rel="noopener noreferrer" className="imessage-link-preview">
        {/* 🚀 컴팩트한 이미지 영역 (세로 길이 미세 조정, 다크모드 지원) */}
        <div className="relative bg-gray-100 dark:bg-[#262626]" style={{ 
          height: '140px', // 🚀 120px → 140px로 미세 증가
          width: '100%',
          borderRadius: '8px 8px 0 0',
          overflow: 'hidden'
        }}>
          {hasImage ? (
            <img 
              src={displayMetadata.image} 
              alt={displayTitle} 
              className="preview-image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              onError={(e) => {
                console.warn(`Failed to load image (likely CORS or network error): ${displayMetadata.image}`);
                setImageLoadError(true);
              }}
              onLoad={() => setImageLoadError(false)}
            />
          ) : (
            // 🚀 컴팩트한 플레이스홀더 (세로 길이 축소, 다크모드 지원)
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-[#262626]" style={{ width: '100%' }}>
              <div className="text-center" style={{ width: '100%', padding: '12px' }}>
                <div className="w-10 h-10 mx-auto mb-2 bg-gray-300 dark:bg-[#404040] rounded-full flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 dark:text-[#999999]">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </div>
                <p className="text-xs text-gray-500 dark:text-[#999999] font-medium" style={{ 
                  wordBreak: 'break-all',
                  lineHeight: '1.2'
                }}>
                  {getDomainName(url)}
                </p>
              </div>
            </div>
          )}
          
          {/* Video play button overlay */}
          {isVideoLink && hasImage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 rounded-full p-3">
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="white"
                  className="ml-1"
                >
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          )}
          
          {/* Video duration badge */}
          {isVideoLink && videoDuration && hasImage && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {videoDuration}
            </div>
          )}
        </div>
        
        <div 
          className="preview-content"
          style={{
            ...(colors ? { backgroundColor: colors.background } : {}),
            padding: '10px 14px', // 🚀 패딩 미세 증가: 8px 12px → 10px 14px
            minHeight: '48px' // 🚀 최소 높이 미세 증가: 40px → 48px
          }}
        >
          <p 
            className="preview-title" 
            title={displayTitle}
            style={{
              ...(colors ? { color: colors.text } : {}),
              fontSize: '13px', // 폰트 크기 유지
              fontWeight: '500',
              lineHeight: '1.35', // 🚀 라인 높이 미세 증가: 1.3 → 1.35
              margin: '0 0 6px 0', // 🚀 마진 미세 증가: 4px → 6px
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {displayTitle}
          </p>
          
          <div className="preview-domain-container" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '5px', // 🚀 갭 미세 증가: 4px → 5px
            marginTop: 'auto'
          }}>
            {(displayMetadata as any)?.favicon && !faviconLoadError && (
              <img 
                src={(displayMetadata as any).favicon} 
                alt="favicon" 
                className="preview-favicon"
                style={{ 
                  width: '14px', // 🚀 파비콘 크기 축소: 16px → 14px
                  height: '14px', // 🚀 파비콘 크기 축소: 16px → 14px
                  objectFit: 'contain',
                  flexShrink: 0 
                }}
                onError={(e) => {
                  console.warn(`Failed to load favicon (likely CORS or network error): ${(displayMetadata as any).favicon}`);
                  setFaviconLoadError(true);
                }}
                onLoad={() => setFaviconLoadError(false)}
              />
            )}
            <p 
              className="preview-domain"
              style={{
                ...(colors ? { color: colors.domainText } : {}),
                fontSize: '11px', // 🚀 도메인 폰트 크기 축소: 12px → 11px
                color: '#666',
                margin: 0
              }}
            >
              {displayPublisher}
              {isVideoLink && (
                <span className="ml-2 text-xs opacity-75">🎥</span>
              )}
            </p>
          </div>
        </div>
      </a>
    </div>
  );
}; 