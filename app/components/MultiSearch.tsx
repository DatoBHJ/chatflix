import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Search, ExternalLink, Calendar, ImageIcon, ChevronDown, ChevronUp, Layers, X, ChevronLeft, ChevronRight } from 'lucide-react';

type SearchImage = {
  url: string;
  description: string;
};

type SearchResult = {
  url: string;
  title: string;
  content: string;
  raw_content: string;
  published_date?: string;
};

type SearchQueryResult = {
  query: string;
  results: SearchResult[];
  images: SearchImage[];
};

type MultiSearchResponse = {
  searches: SearchQueryResult[];
};

type MultiSearchArgs = {
  queries: string[];
  maxResults: number[];
  topics: ("general" | "news")[];
  searchDepth: ("basic" | "advanced")[];
};

type QueryCompletion = {
  type: 'query_completion';
  data: {
    query: string;
    index: number;
    total: number;
    status: 'completed';
    resultsCount: number;
    imagesCount: number;
  };
};

// Utility function to filter and deduplicate images
const getUniqueValidImages = (images: SearchImage[]) => {
  if (!images || images.length === 0) return [];
  
  // Apply filtering
  const filtered = images.filter(img => 
    img?.url && 
    typeof img.url === 'string' && 
    !img.url.startsWith('data:') && 
    img.url.match(/\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i)
  );
  
  // Remove duplicates
  const uniqueUrls = new Set();
  return filtered.filter(img => {
    if (uniqueUrls.has(img.url)) return false;
    uniqueUrls.add(img.url);
    return true;
  });
};

// Domain extraction helper
const extractDomain = (url: string): string => {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    if (parts.length > 2 && parts[0] === 'www') {
      return parts.slice(1).join('.');
    }
    return hostname;
  } catch (e) {
    return url;
  }
};

// Loading state component
const SearchLoadingState = ({ 
  queries,
  annotations 
}: { 
  queries: string[];
  annotations: QueryCompletion[];
}) => {
  const completedQueries = annotations.length;
  const totalResults = annotations.reduce((sum, a) => sum + (a.data?.resultsCount || 0), 0);
  const totalImages = annotations.reduce((sum, a) => sum + (a.data?.imagesCount || 0), 0);
  const hasCompletedQueries = completedQueries > 0;

  return (
    <div className="w-full space-y-4 my-4">
      <div className="p-4 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between w-full mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[color-mix(in_srgb,var(--foreground)_7%,transparent)] to-[color-mix(in_srgb,var(--foreground)_3%,transparent)]">
              <Globe className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
            </div>
            <h2 className="font-medium text-left tracking-tight">Chatflix Search</h2>
          </div>
          <div className="rounded-full px-3.5 py-1.5 bg-gradient-to-r from-[color-mix(in_srgb,var(--foreground)_7%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)] flex items-center gap-2 border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-sm">
            <Search className="h-3 w-3" strokeWidth={1.5} />
            <span className="text-sm flex items-center gap-1">
              <span className="animate-pulse">{completedQueries}/{queries.length}</span> 
              {totalResults > 0 && <span>({totalResults} Results)</span>}
            </span>
          </div>
        </div>
        
        {/* Query filter pills */}
        <div className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)] px-1">Search Queries</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {queries.map((query, i) => {
            const isCompleted = annotations.some(a => a.data?.query === query);
            const annotation = annotations.find(a => a.data?.query === query);
            
            return (
              <div
                key={i}
                className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 break-keep ${
                  isCompleted ? "bg-gradient-to-r from-[color-mix(in_srgb,var(--foreground)_15%,transparent)] to-[color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-sm border border-[color-mix(in_srgb,var(--foreground)_20%,transparent)]" 
                  : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border border-transparent"
                }`}
              >
                {/* Status indicator */}
                <div className={`p-1.5 rounded-full ${isCompleted ? "bg-[color-mix(in_srgb,var(--foreground)_25%,transparent)]" : "bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"} transition-colors flex items-center justify-center`}>
                  {isCompleted ? (
                    <span className="h-3 w-3 flex items-center justify-center">✓</span>
                  ) : (
                    <div className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  )}
                </div>
                
                {/* Query info */}
                <div className="flex flex-col leading-tight">
                  <span className="font-medium text-sm">{query}</span>
                  {annotation?.data && (
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <div className="flex items-center gap-1">
                        <span>{annotation.data.resultsCount}</span>
                        <span className="hidden sm:inline">results</span>
                      </div>
                      
                      {annotation.data.imagesCount > 0 && (
                        <div className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" strokeWidth={1.5} />
                          <span>{annotation.data.imagesCount}</span>
                          <span className="hidden sm:inline">images</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Image results preview */}
        <div className="mt-1">
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <div className="p-1 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
              <ImageIcon className="h-3 w-3 text-[var(--foreground)]" strokeWidth={1.5} />
            </div>
            {totalImages > 0 ? (
              <span className="text-xs text-[var(--muted)]">{totalImages} images found</span>
            ) : (
              <div className="h-3.5 bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-md animate-pulse w-24" />
            )}
          </div>
          
          <div className="grid grid-cols-4 gap-1 h-[60px] overflow-hidden">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-full bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] rounded-md animate-pulse" />
            ))}
          </div>

          {totalResults > 0 && (
            <div className="flex justify-end mt-1">
              <button
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1"
              >
                <span>Show All ({totalResults})</span>
                <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Result card component
const ResultCard = ({ result }: { result: SearchResult }) => {
  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block py-3 px-3 hover:bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] transition-colors duration-200"
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="w-5 h-5 rounded-md bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] flex items-center justify-center overflow-hidden">
          <img
            src={`https://www.google.com/s2/favicons?sz=128&domain=${new URL(result.url).hostname}`}
            alt=""
            className="w-3.5 h-3.5 object-contain"
            onError={(e) => {
              e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='16'/%3E%3Cline x1='8' y1='12' x2='16' y2='12'/%3E%3C/svg%3E";
            }}
          />
        </div>
        <span className="text-xs text-[var(--muted)] truncate">
          {new URL(result.url).hostname}
        </span>
      </div>

      <h3 className="font-medium text-sm mb-1.5 line-clamp-2">
        {result.title}
      </h3>

      <p className="text-sm text-[var(--muted)] mb-2 line-clamp-3 break-words overflow-hidden overflow-wrap-anywhere hyphens-auto max-w-full" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
        {result.content}
      </p>

      {result.published_date && (
        <time className="text-xs text-[var(--muted)] flex items-center gap-1.5">
          <Calendar className="h-3 w-3" strokeWidth={1.5} />
          {new Date(result.published_date).toLocaleDateString()}
        </time>
      )}
    </a>
  );
};

// Domain group component
const DomainGroup = ({ 
  domain, 
  results
}: { 
  domain: string; 
  results: SearchResult[];
}) => {
  // Create domain URL
  const domainUrl = `https://${domain}`;
  
  return (
    <div className="mb-3 last:mb-0 bg-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] rounded-lg border border-[color-mix(in_srgb,var(--foreground)_3%,transparent)] shadow-sm">
      <div className="flex items-center justify-between py-2.5 px-3 border-b border-[color-mix(in_srgb,var(--foreground)_3%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_1%,transparent)]">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-md bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] flex items-center justify-center overflow-hidden flex-shrink-0">
            <img
              src={`https://www.google.com/s2/favicons?sz=128&domain=${domain}`}
              alt=""
              className="w-4 h-4 object-contain"
              onError={(e) => {
                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='16'/%3E%3Cline x1='8' y1='12' x2='16' y2='12'/%3E%3C/svg%3E";
              }}
            />
          </div>
          <div className="truncate min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <a 
                href={domainUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:underline flex items-center gap-1.5 group truncate"
              >
                {domain}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </a>
              <span className="text-xs text-[var(--muted)] flex-shrink-0">({results.length})</span>
            </div>
          </div>
        </div>
        
        <a 
          href={domainUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] px-2.5 py-1 rounded-md transition-colors text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1 flex-shrink-0"
        >
          Visit
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
      
      <div className="divide-y divide-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
        {results.map((result, index) => (
          <ResultCard key={`${domain}-${index}`} result={result} />
        ))}
      </div>
    </div>
  );
};

// Right sidebar for search results and images
const SearchSidebar = ({ 
  isOpen, 
  onClose, 
  domainGroups, 
  images, 
  totalResults 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  domainGroups: [string, SearchResult[]][];
  images: SearchImage[];
  totalResults: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Handle mounting for portal
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // Validate and deduplicate images
  const validImages = useMemo(() => {
    return getUniqueValidImages(images);
  }, [images]);
  
  const hasImages = validImages.length > 0;
  
  if (!isOpen || !isMounted) return null;
  
  const sidebarContent = (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden" 
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 right-0 h-full z-50 w-full max-w-[420px] transform transition-transform duration-300
        bg-[var(--background)] shadow-lg border-l border-[color-mix(in_srgb,var(--foreground)_7%,transparent)]
        flex flex-col
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" strokeWidth={1.5} />
            <h2 className="font-medium">Search Results</h2>
            <span className="text-sm text-[var(--muted)]">({totalResults})</span>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        
        {/* Content - using sidebar-scroll class for proper scrolling */}
        <div className="flex-1 overflow-y-auto sidebar-scroll px-4 py-4">
          {/* Image thumbnails if available */}
          {hasImages && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Images ({validImages.length})</span>
                </h3>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {validImages.slice(0, 8).map((image, idx) => (
                  <a 
                    key={idx}
                    href={image.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] rounded-md overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <img 
                      src={image.url} 
                      alt={image.description || ''} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </a>
                ))}
              </div>
              {validImages.length > 8 && (
                <div className="flex justify-end mt-1">
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1"
                  >
                    <span>View all {validImages.length} images</span>
                    <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Domain groups results */}
          <div className="space-y-3">
            {domainGroups.map(([domain, results]) => (
              <DomainGroup 
                key={domain} 
                domain={domain} 
                results={results}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
  
  return createPortal(sidebarContent, document.body);
};

// Image grid component
const ImageGrid = ({ images }: { images: SearchImage[] }) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedImage, setSelectedImage] = useState<SearchImage | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isMounted, setIsMounted] = useState(false);
  const metaTagRef = useRef<HTMLMetaElement | null>(null);
  
  // Check if we're in the browser environment for portal rendering
  useEffect(() => {
    setIsMounted(true);
    
    // Add meta tag to hide referrer for all requests
    const metaTag = document.createElement('meta');
    metaTag.name = 'referrer';
    metaTag.content = 'no-referrer';
    document.head.appendChild(metaTag);
    metaTagRef.current = metaTag;
    
    return () => {
      setIsMounted(false);
      // Remove meta tag when component unmounts - safely
      if (metaTagRef.current && document.head.contains(metaTagRef.current)) {
        document.head.removeChild(metaTagRef.current);
      }
    };
  }, []);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return;
      
      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'ArrowRight') {
        navigateImage('next');
      } else if (e.key === 'ArrowLeft') {
        navigateImage('prev');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, selectedIndex]);
  
  const handleImageClick = (image: SearchImage, index: number, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedImage(image);
    setSelectedIndex(index);
    document.body.style.overflow = 'hidden';
  };
  
  const closeModal = () => {
    setSelectedImage(null);
    setSelectedIndex(-1);
    document.body.style.overflow = '';
  };
  
  const navigateImage = (direction: 'prev' | 'next') => {
    if (!images || images.length === 0) return;
    
    const newIndex = direction === 'next' 
      ? (selectedIndex + 1) % images.length 
      : (selectedIndex - 1 + images.length) % images.length;
    setSelectedImage(images[newIndex]);
    setSelectedIndex(newIndex);
  };
  
  // Validate the images array to make sure each item has a valid URL
  const validImages = useMemo(() => {
    return getUniqueValidImages(images);
  }, [images]);
  
  // Determine number of images to display based on total count
  const displayImages = useMemo(() => {
    const count = validImages.length <= 8 ? validImages.length : (expanded ? validImages.length : 8);
    return validImages.slice(0, count);
  }, [validImages, expanded]);
  
  // Return early if there are no valid images
  if (!validImages || validImages.length === 0) {
    return null;
  }
  
  // Modal content to be rendered in the portal
  const modalContent = selectedImage && (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center" 
      onClick={closeModal}
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        width: '100vw', 
        height: '100vh',
        margin: 0,
        padding: 0
      }}
    >
      <div className="close-button">
        <X className="h-5 w-5 text-white" strokeWidth={1.5} />
      </div>
      
      <a 
        href={selectedImage.url}
        target="_blank"
        rel="noopener noreferrer"
        className="view-original-button"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
        View Original
      </a>
      
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="image-container">
          <img 
            src={selectedImage.url} 
            alt={selectedImage.description || ''} 
            className="main-image"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          
          {selectedImage.description && (
            <div className="image-description">
              <p>{selectedImage.description}</p>
            </div>
          )}
        </div>
        
        <div className="nav-button prev-button" onClick={() => navigateImage('prev')}>
          <ChevronLeft className="h-6 w-6 text-white" strokeWidth={1.5} />
        </div>
        
        <div className="nav-button next-button" onClick={() => navigateImage('next')}>
          <ChevronRight className="h-6 w-6 text-white" strokeWidth={1.5} />
        </div>
        
        <div className="similar-images-container">
          <h4 className="similar-images-title">Related Images</h4>
          
          <div className="similar-images-grid">
            {validImages.filter(img => img.url !== selectedImage.url).slice(0, 12).map((image, idx) => (
              <div key={idx} className="relative">
                <img
                  src={image.url}
                  alt={image.description || ''}
                  className="w-full h-32 object-cover rounded-lg cursor-pointer"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newIndex = validImages.findIndex(img => img.url === image.url);
                    setSelectedImage(image);
                    setSelectedIndex(newIndex);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
  
  // Only show header if we have valid images
  if (validImages.length === 0) return null;

  console.log("Image Grid - valid images:", validImages.length); // Debug
  
  return (
    <div className="space-y-2 px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-3.5 w-3.5 text-[var(--foreground)]" strokeWidth={1.5} />
          <h3 className="text-sm font-medium">Images ({validImages.length})</h3>
        </div>
        {validImages.length > 8 && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-2 py-1 rounded-md bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" strokeWidth={1.5} />
                <span className="hidden sm:inline">Show Less</span>
                <span className="sm:hidden">Less</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
                <span className="hidden sm:inline">Show More ({validImages.length - 8})</span>
                <span className="sm:hidden">More ({validImages.length - 8})</span>
              </>
            )}
          </button>
        )}
      </div>
      
      <style jsx global>{`
        .tetris-grid {
          column-count: 2;
          column-gap: 8px;
          width: 100%;
        }
        
        @media (min-width: 640px) {
          .tetris-grid {
            column-count: 3;
          }
        }
        
        @media (min-width: 768px) {
          .tetris-grid {
            column-count: 4;
          }
        }
        
        .tetris-item {
          break-inside: avoid;
          margin-bottom: 8px;
          display: block;
          position: relative;
          width: 100%;
        }
        
        .tetris-img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 8px;
          background-color: color-mix(in srgb, var(--foreground) 3%, transparent);
          max-height: 240px;
          object-fit: cover;
        }
        
        .image-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
          background-color: rgba(0, 0, 0, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          width: 100vw;
          height: 100vh;
          pointer-events: auto;
          margin: 0;
          padding: 0;
          border: none;
          box-sizing: border-box;
          isolation: isolate;
        }
        
        body:has(.image-modal) {
          overflow: hidden;
          position: relative;
        }
        
        .modal-content {
          max-width: 100%;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 0;
          position: relative;
        }
        
        .image-container {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          width: 100%;
          padding: 0;
          margin: 0;
          overflow: hidden;
        }
        
        .main-image {
          max-height: 85vh;
          max-width: 95vw;
          object-fit: contain;
        }
        
        .image-description {
          color: white;
          background-color: rgba(0, 0, 0, 0.7);
          padding: 12px 20px;
          border-radius: 8px;
          position: absolute;
          bottom: 24px;
          left: 24px;
          max-width: 80%;
          z-index: 10;
        }
        
        .close-button {
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: rgba(0, 0, 0, 0.6);
          border-radius: 50%;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10000;
          transition: background-color 0.2s;
        }
        
        .close-button:hover {
          background-color: rgba(0, 0, 0, 0.8);
        }
        
        .nav-button {
          position: fixed;
          top: 50%;
          transform: translateY(-50%);
          background-color: rgba(0, 0, 0, 0.6);
          border-radius: 50%;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10000;
          transition: background-color 0.2s;
        }
        
        .nav-button:hover {
          background-color: rgba(0, 0, 0, 0.8);
        }
        
        .prev-button {
          left: 20px;
        }
        
        .next-button {
          right: 20px;
        }
        
        .similar-images-container {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background-color: rgba(0, 0, 0, 0.8);
          padding: 16px;
          transform: translateY(100%);
          transition: transform 0.3s ease;
        }
        
        .image-modal:hover .similar-images-container {
          transform: translateY(0);
        }
        
        .similar-images-title {
          color: white;
          margin-bottom: 16px;
          font-size: 18px;
          font-weight: 500;
          padding-left: 16px;
        }
        
        .similar-images-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 8px;
          padding: 0 16px;
          max-height: 160px;
          overflow-x: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
        }
        
        .similar-images-grid::-webkit-scrollbar {
          height: 6px;
        }
        
        .similar-images-grid::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .similar-images-grid::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.3);
          border-radius: 6px;
        }
        
        .view-original-button {
          position: absolute;
          top: 20px;
          left: 20px;
          background-color: rgba(0, 0, 0, 0.6);
          border-radius: 8px;
          padding: 8px 16px;
          color: white;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 10000;
          transition: background-color 0.2s;
        }
        
        .view-original-button:hover {
          background-color: rgba(0, 0, 0, 0.8);
        }
      `}</style>
      
      <div className={`tetris-grid transition-all duration-300 ${expanded ? '' : 'max-h-[200px] overflow-hidden'}`}>
        {displayImages.map((image, index) => (
          <div key={index} className="tetris-item">
            <a
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group hover:opacity-90 transition-opacity cursor-pointer"
              onClick={(e) => handleImageClick(image, index, e)}
            >
              <img
                src={image.url}
                alt={image.description || ''}
                className="tetris-img"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  // Hide images that fail to load
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              {image.description && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 flex items-end rounded-lg">
                  <p className="text-xs text-white line-clamp-2">{image.description}</p>
                </div>
              )}
            </a>
          </div>
        ))}
      </div>
      
      {/* Render the modal in a portal */}
      {isMounted && selectedImage && createPortal(
        modalContent,
        document.body
      )}
    </div>
  );
};

// Main MultiSearch component
const MultiSearch: React.FC<{ 
  result: MultiSearchResponse | null; 
  args: MultiSearchArgs | null;
  annotations?: QueryCompletion[];
}> = ({
  result,
  args,
  annotations = []
}) => {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Show loading state if we have args and annotations but no results yet
  const isLoading = !result && args && annotations.length >= 0;
  
  // Get the queries from args or from result if available
  const queries = useMemo(() => {
    if (args && args.queries) {
      return args.queries;
    }
    if (result) {
      return result.searches.map(s => s.query);
    }
    return [];
  }, [args, result]);
  
  // Calculate total images from all search results
  const allImages = useMemo(() => {
    if (!result || !result.searches) return [];
    
    // Extract all valid images with source information
    const images = result.searches.flatMap((search, searchIndex) => {
      if (!search.images) return [];
      
      // First, filter valid images
      return getUniqueValidImages(search.images)
        .map(img => ({
          ...img,
          sourceQuery: search.query || 'Search Result',
          searchIndex
        }));
    });
    
    // Remove duplicates across all searches
    const uniqueUrls = new Set();
    return images.filter(img => {
      if (uniqueUrls.has(img.url)) return false;
      uniqueUrls.add(img.url);
      return true;
    });
  }, [result]);

  // Group all results by domain
  const domainGroups = useMemo(() => {
    if (!result) return [];
    
    const groups: Record<string, SearchResult[]> = {};
    
    // If filter is active, only include results from that search query
    const filteredSearches = activeFilter 
      ? result.searches.filter(search => search.query === activeFilter)
      : result.searches;
    
    filteredSearches.forEach(search => {
      search.results.forEach(result => {
        const domain = extractDomain(result.url);
        if (!groups[domain]) {
          groups[domain] = [];
        }
        groups[domain].push(result);
      });
    });
    
    // Sort by result count
    return Object.entries(groups)
      .sort(([, resultsA], [, resultsB]) => resultsB.length - resultsA.length);
  }, [result, activeFilter]);

  // Calculate total results based on active filter
  const totalResults = useMemo(() => {
    if (!result) return 0;
    
    return activeFilter
      ? result.searches.find(s => s.query === activeFilter)?.results.length || 0
      : result.searches.reduce((sum, search) => sum + search.results.length, 0);
  }, [result, activeFilter]);

  // Get filtered images based on active filter
  const displayImages = useMemo(() => {
    if (!result) return [];
    
    if (activeFilter) {
      // For individual query, apply the same filtering as allImages
      const search = result.searches.find(s => s.query === activeFilter);
      if (!search) return [];
      
      const validFilteredImages = getUniqueValidImages(search.images);
      return validFilteredImages.map(img => ({
        ...img,
        sourceQuery: search.query || 'Search Result',
        searchIndex: result.searches.findIndex(s => s.query === activeFilter)
      }));
    }
    
    // For "All Queries", return deduplicated images
    return allImages;
  }, [result, activeFilter, allImages]);

  // Early return for loading state
  if (isLoading) {
    return <SearchLoadingState queries={queries} annotations={annotations} />;
  }

  // If no args or results, don't render anything
  if (!result && (!args || !args.queries || args.queries.length === 0)) {
    return null;
  }

  // Show loading state if we just have results without content
  if (!result || !result.searches || result.searches.length === 0) {
    return <SearchLoadingState queries={queries} annotations={annotations} />;
  }

  return (
    <div className="w-full space-y-4 my-4">
      <div className="p-4 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)]">
        {/* Query filter pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div
            onClick={() => {
              setActiveFilter(null);
              setSidebarOpen(true);
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all
                      ${activeFilter === null 
                        ? "bg-gradient-to-r from-[color-mix(in_srgb,var(--foreground)_15%,transparent)] to-[color-mix(in_srgb,var(--foreground)_10%,transparent)]" 
                        : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
                      }`}
          >
            <Search className="h-3.5 w-3.5 min-w-[14px] min-h-[14px]" strokeWidth={1.5} />
            <span className="text-xs font-medium">All Queries</span>
          </div>

          {result.searches.map((search, i) => (
            <div
              key={i}
              onClick={() => {
                setActiveFilter(search.query === activeFilter ? null : search.query);
                setSidebarOpen(true);
              }}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all break-keep
                        ${search.query === activeFilter 
                          ? "bg-gradient-to-r from-[color-mix(in_srgb,var(--foreground)_15%,transparent)] to-[color-mix(in_srgb,var(--foreground)_10%,transparent)]" 
                          : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
                        }`}
            >
              <Search className="h-3.5 w-3.5 min-w-[14px] min-h-[14px]" strokeWidth={1.5} />
              <span className="text-xs font-medium">{search.query}</span>
              {search.results.length > 0 && (
                <span className="text-xs text-[var(--muted)]">({search.results.length})</span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Right sidebar with results - now rendered at document root level via portal */}
      <SearchSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        domainGroups={domainGroups} 
        images={displayImages}
        totalResults={totalResults}
      />
      
      {/* Image viewer modal */}
      <ImageGrid images={displayImages} />
    </div>
  );
};

export default MultiSearch;