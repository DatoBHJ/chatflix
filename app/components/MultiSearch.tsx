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
  const totalResults = annotations.reduce((sum, a) => sum + a.data.resultsCount, 0);

  return (
    <div className="w-full space-y-4 my-4">
      <div className="p-4 bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-sm">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
              <Globe className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
            </div>
            <h2 className="font-medium text-left">Searching...</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full px-3 py-1 bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
              <Search className="h-3 w-3 mr-1.5 inline" strokeWidth={1.5} />
              {totalResults || '0'} results
            </div>
          </div>
        </div>
        
        {/* Query badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {queries.map((query, i) => {
            const annotation = annotations.find(a => a.data.query === query);
            return (
              <div
                key={i}
                className={`px-3 py-1.5 rounded-full flex-shrink-0 flex items-center gap-1.5 ${
                  annotation 
                    ? "bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]" 
                    : "bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[var(--muted)]"
                }`}
              >
                {annotation ? (
                  <span className="h-3 w-3">✓</span>
                ) : (
                  <div className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                )}
                <span className="text-sm break-keep whitespace-nowrap">{query}</span>
              </div>
            );
          })}
        </div>

        {/* Mobile-optimized loading skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {[...Array(3)].map((_, i) => (
            <div 
              key={i}
              className="bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] rounded-xl border border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] p-4"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-md animate-pulse w-3/4" />
                  <div className="h-3 bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-md animate-pulse w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-md animate-pulse w-full" />
                <div className="h-3 bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-md animate-pulse w-5/6" />
                <div className="h-3 bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-md animate-pulse w-4/6" />
              </div>
            </div>
          ))}
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
  
  if (!isOpen) return null;
  
  return (
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
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-4 border-b border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] flex justify-between items-center">
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
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto sidebar-scroll px-4 py-4">
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
      </div>
    </>
  );
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
    const newIndex = direction === 'next' 
      ? (selectedIndex + 1) % images.length 
      : (selectedIndex - 1 + images.length) % images.length;
    setSelectedImage(images[newIndex]);
    setSelectedIndex(newIndex);
  };
  
  // Early return after all hooks are declared
  if (images.length === 0) return null;
  
  // Determine number of images to display based on total count
  const displayCount = images.length <= 8 ? images.length : (expanded ? images.length : 8);
  const displayImages = images.slice(0, displayCount);
  
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
            {images.filter(img => img.url !== selectedImage.url).slice(0, 12).map((image, idx) => (
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
                    const newIndex = images.findIndex(img => img.url === image.url);
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
  
  return (
    <div className=" space-y-2 px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
            <ImageIcon className="h-3.5 w-3.5 text-[var(--foreground)]" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-medium">Image Results ({images.length})</h3>
        </div>
        {images.length > 8 && (
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
                <span className="hidden sm:inline">Show More ({images.length - 8})</span>
                <span className="sm:hidden">More ({images.length - 8})</span>
              </>
            )}
          </button>
        )}
      </div>
      
      <style jsx global>{`
        .tetris-grid {
          column-count: 2;
          column-gap: 8px;
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
        }
        
        .tetris-img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 8px;
          background-color: color-mix(in srgb, var(--foreground) 3%, transparent);
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
  args: MultiSearchArgs;
  annotations?: QueryCompletion[];
}> = ({
  result,
  args,
  annotations = []
}) => {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Calculate all images from search results
  const allImages = useMemo(() => {
    return result?.searches.reduce<SearchImage[]>((acc, search) => {
      return [...acc, ...search.images];
    }, []) || [];
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

  // Early return for loading state
  if (!result) {
    return <SearchLoadingState queries={args.queries} annotations={annotations} />;
  }

  // Calculate total results based on active filter
  const totalResults = activeFilter
    ? result.searches.find(s => s.query === activeFilter)?.results.length || 0
    : result.searches.reduce((sum, search) => sum + search.results.length, 0);

  // Get filtered images based on active filter
  const displayImages = activeFilter
    ? result.searches.find(s => s.query === activeFilter)?.images || []
    : allImages;

  return (
    <div className="w-full space-y-4 my-4">
      <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
        <div className="flex items-center justify-between w-full mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[color-mix(in_srgb,var(--foreground)_7%,transparent)] to-[color-mix(in_srgb,var(--foreground)_3%,transparent)]">
              <Globe className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
            </div>
            <h2 className="font-medium text-left tracking-tight">Chatflix Search</h2>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-full px-3.5 py-1.5 bg-gradient-to-r from-[color-mix(in_srgb,var(--foreground)_7%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:from-[color-mix(in_srgb,var(--foreground)_10%,transparent)] hover:to-[color-mix(in_srgb,var(--foreground)_8%,transparent)] transition-all duration-300 flex items-center gap-2 border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-sm hover:shadow"
          >
            <Search className="h-3 w-3" strokeWidth={1.5} />
            <span className="text-sm">{totalResults} Results</span>
          </button>
        </div>

        {/* Query filter pills */}
        <div className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)] px-1">Search Queries</div>
        <div className="flex flex-wrap gap-2">
          <div
            onClick={() => {
              setActiveFilter(null);
              setSidebarOpen(true);
            }}
            className={`group px-3.5 py-2 rounded-lg flex-shrink-0 flex items-center gap-2 cursor-pointer transition-all duration-200
                      ${activeFilter === null 
                        ? "bg-gradient-to-r from-[color-mix(in_srgb,var(--foreground)_15%,transparent)] to-[color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-sm translate-y-0 border border-[color-mix(in_srgb,var(--foreground)_20%,transparent)]" 
                        : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] border border-transparent hover:border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] hover:-translate-y-0.5 hover:shadow-sm"
                      }`}
          >
            <div className={`p-1.5 rounded-full ${activeFilter === null ? "bg-[color-mix(in_srgb,var(--foreground)_25%,transparent)]" : "bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--foreground)_15%,transparent)]"} transition-colors`}>
              <Search className="h-3 w-3" strokeWidth={1.5} />
            </div>
            <span className="font-medium">All Queries</span>
          </div>

          {result.searches.map((search, i) => (
            <div
              key={i}
              onClick={() => {
                setActiveFilter(search.query === activeFilter ? null : search.query);
                setSidebarOpen(true);
              }}
              className={`group px-3.5 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-all duration-200 break-keep
                        ${search.query === activeFilter 
                          ? "bg-gradient-to-r from-[color-mix(in_srgb,var(--foreground)_15%,transparent)] to-[color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-sm translate-y-0 border border-[color-mix(in_srgb,var(--foreground)_20%,transparent)]" 
                          : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] border border-transparent hover:border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] hover:-translate-y-0.5 hover:shadow-sm"
                        }`}
            >
              <div className={`p-1.5 rounded-full ${search.query === activeFilter ? "bg-[color-mix(in_srgb,var(--foreground)_25%,transparent)]" : "bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--foreground)_15%,transparent)]"} transition-colors`}>
                <Search className="h-3 w-3" strokeWidth={1.5} />
              </div>
              
              <div className="flex flex-col leading-tight">
                <span className="font-medium text-sm">{search.query}</span>
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <div className="flex items-center gap-1">
                    <span>{search.results.length}</span>
                    <span className="hidden sm:inline">results</span>
                  </div>
                  
                  {search.images.length > 0 && (
                    <div className="flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" strokeWidth={1.5} />
                      <span>{search.images.length}</span>
                      <span className="hidden sm:inline">images</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Right sidebar with results */}
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