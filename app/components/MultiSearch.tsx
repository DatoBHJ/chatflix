import React, { useState, useMemo } from 'react';
import { Globe, Search, ExternalLink, Calendar, ImageIcon, ChevronDown, ChevronUp, Layers } from 'lucide-react';

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

// Image grid component
const ImageGrid = ({ images }: { images: SearchImage[] }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (images.length === 0) return null;
  
  // Determine number of images to display based on total count
  const displayCount = images.length <= 8 ? images.length : (expanded ? images.length : 8);
  const displayImages = images.slice(0, displayCount);
  
  return (
    <div className="mt-4 space-y-2">
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
      
      <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 transition-all duration-300 ${expanded ? 'max-h-[800px]' : 'max-h-[400px]'} overflow-hidden`}>
        {displayImages.map((image, index) => (
          <a
            key={index}
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative rounded-xl overflow-hidden group hover:opacity-90 transition-opacity"
            style={{ aspectRatio: '4/3' }}
          >
            <img
              src={image.url}
              alt={image.description}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {image.description && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 flex items-end">
                <p className="text-xs text-white line-clamp-2">{image.description}</p>
              </div>
            )}
          </a>
        ))}
      </div>
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
      <div className="p-4 bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
        <div className="flex items-center justify-between w-full mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)]">
              <Globe className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
            </div>
            <h2 className="font-medium text-left">Search Results</h2>
          </div>
          <div className="flex items-center">
            <div className="rounded-md px-3 py-1 bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)]">
              <Search className="h-3 w-3 mr-1.5 inline" strokeWidth={1.5} />
              {totalResults} results
            </div>
          </div>
        </div>

        {/* Query filter pills */}
        <div className="flex flex-wrap gap-2 mt-2 mb-4">
          <div
            onClick={() => setActiveFilter(null)}
            className={`px-3 py-1 rounded-md flex-shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors duration-200
                      ${activeFilter === null 
                        ? "bg-[color-mix(in_srgb,var(--foreground)_12%,transparent)]" 
                        : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
                      }`}
          >
            <Search className="h-3 w-3 inline" strokeWidth={1.5} />
            All
          </div>
          {result.searches.map((search, i) => (
            <div
              key={i}
              onClick={() => setActiveFilter(search.query === activeFilter ? null : search.query)}
              className={`px-3 py-1 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors duration-200 break-keep whitespace-nowrap
                        ${search.query === activeFilter 
                          ? "bg-[color-mix(in_srgb,var(--foreground)_12%,transparent)]" 
                          : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
                        }`}
            >
              <Search className="h-3 w-3 inline flex-shrink-0" strokeWidth={1.5} />
              <span className="text-sm">{search.query}</span>
            </div>
          ))}
        </div>

        {/* Results container */}
        <div className="max-h-[600px] overflow-y-auto pr-1 pb-1 space-y-3 no-scrollbar">
          <style jsx global>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .no-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
            .overflow-wrap-anywhere {
              overflow-wrap: anywhere;
            }
            @media (max-width: 640px) {
              .mobile-text-smaller {
                font-size: 0.8125rem;
              }
            }
          `}</style>
          {domainGroups.map(([domain, results]) => (
            <DomainGroup 
              key={domain} 
              domain={domain} 
              results={results}
            />
          ))}
        </div>
        
        {/* Image section */}
        {displayImages.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[color-mix(in_srgb,var(--foreground)_3%,transparent)]">
            <ImageGrid images={displayImages} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiSearch;