'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { detectCountryFromLanguage, getCountryNameFromGeo } from '../../utils/countryMapping';
import { Globe, ChevronDown, ChevronUp, AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';

interface Trend {
  query: string;
  position: number;
  search_volume: number;
  categories: string[];
}

interface TrendingData {
  trends: Trend[];
  lastUpdated: string;
  geo?: string;
  error?: string;
}

interface InlineTrendingTermsProps {
  isVisible: boolean;
  onTermClick: (term: string) => void;
}

// Popular countries list for UI
const POPULAR_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'KR', name: 'South Korea' },
  { code: 'JP', name: 'Japan' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'AU', name: 'Australia' },
  { code: 'CN', name: 'China' },
  { code: 'RU', name: 'Russia' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IT', name: 'Italy' },
];

export function InlineTrendingTerms({ isVisible, onTermClick }: InlineTrendingTermsProps) {
  const [trendingData, setTrendingData] = useState<TrendingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [countryCode, setCountryCode] = useState<string>('US');
  const [countryName, setCountryName] = useState<string>('United States');
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [compactView, setCompactView] = useState(false);

  // Initialize mounted state
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Add custom CSS to document head for dropdown styles
  useEffect(() => {
    const style = document.createElement('style');
    
    style.textContent = `
      /* Country selector styles */
      .country-selector-button {
        position: relative;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      }
      
      /* Bottom gradient line effect */
      .country-selector-button::after {
        content: "";
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 1px;
        background: linear-gradient(to right, transparent, var(--muted), transparent);
        opacity: 0;
        transform: scaleX(0.8);
        transition: all 0.3s ease;
      }
      
      /* Show line on hover and active state */
      .country-selector-button:hover::after, 
      .country-selector-button.active::after {
        opacity: 0.7;
        transform: scaleX(1);
      }
      
      /* Country dropdown menu styles */
      .country-dropdown-portal {
        position: fixed;
        animation: fadeInUp 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        transform-origin: top center;
        z-index: 99999;
        backdrop-filter: blur(8px);
      }
      
      /* Country option styles */
      .country-option {
        position: relative;
        overflow: hidden;
        transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      
      .country-option.active {
        background: color-mix(in srgb, var(--accent) 30%, transparent);
      }
      
      .country-option:hover {
        background: color-mix(in srgb, var(--accent) 20%, transparent);
      }
      
      /* Trending terms modernized design */
      .trending-terms-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 8px;
        width: 100%;
        overflow-y: hidden;
        padding-top: 8px;
        padding-bottom: 8px;
      }
      
      @media (max-width: 640px) {
        .trending-terms-container {
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 6px;
        }
      }
      
      .trending-term {
        position: relative;
        overflow: hidden;
        font-size: 0.7rem;
        white-space: nowrap;
        text-overflow: ellipsis;
        padding: 0.5rem 0.75rem;
        transition: all 0.2s ease;
        border: 1px solid transparent;
        background: linear-gradient(to right, color-mix(in srgb, var(--accent) 50%, transparent), color-mix(in srgb, var(--accent) 60%, transparent));
        backdrop-filter: blur(5px);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        text-transform: none;
        letter-spacing: 0;
        opacity: 0.85;
        transform: translateY(0);
      }
      
      .trending-term:hover {
        opacity: 1;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-color: color-mix(in srgb, var(--accent) 20%, transparent);
        background: linear-gradient(to right, color-mix(in srgb, var(--foreground) 90%, transparent), color-mix(in srgb, var(--foreground) 100%, transparent));
        color: var(--background);
      }
      
      /* Hide scrollbar but keep functionality */
      .trending-terms-scroll {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      
      .trending-terms-scroll::-webkit-scrollbar {
        display: none;
      }
      
      /* Custom header for trending section */
      .trending-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        padding: 0 4px;
      }
      
      .header-left {
        display: flex;
        align-items: center;
      }
      
      .trending-icon {
        opacity: 0.7;
        margin-right: 6px;
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0% {
          transform: scale(1);
          opacity: 0.7;
        }
        50% {
          transform: scale(1.05);
          opacity: 0.9;
        }
        100% {
          transform: scale(1);
          opacity: 0.7;
        }
      }
      
      /* Fade in up animation */
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* Mobile styles */
      @media (max-width: 640px) {
        .country-dropdown-portal.mobile {
          position: fixed !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          top: auto !important;
          width: 100% !important;
          max-height: 80vh !important;
          border-bottom: none !important;
          border-left: none !important;
          border-right: none !important;
          border-radius: 12px 12px 0 0 !important;
        }
        
        .mobile-handle {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 36px;
          height: 4px;
          background: var(--accent);
          opacity: 0.2;
          border-radius: 2px;
        }
      }
    `;
    
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Calculate dropdown position when it's shown
  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: 240 // Fixed width for non-mobile
      });
    }
  }, []);
  
  // Calculate position when showing dropdown
  useEffect(() => {
    if (showCountrySelector && !isMobile) {
      updateDropdownPosition();
      
      // Also update position on scroll and resize
      window.addEventListener('scroll', updateDropdownPosition);
      window.addEventListener('resize', updateDropdownPosition);
      
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [showCountrySelector, isMobile, updateDropdownPosition]);

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkIfMobile = () => {
      const isMobileView = window.innerWidth < 640;
      setIsMobile(isMobileView);
      setCompactView(window.innerWidth < 768); // Use compact layout on smaller screens
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Detect country from language
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for previously selected country
      const savedCountry = localStorage.getItem('selectedTrendingCountry');
      if (savedCountry) {
        try {
          const { code, name } = JSON.parse(savedCountry);
          setCountryCode(code);
          setCountryName(name);
        } catch (e) {
          // Use detected geo if parse fails
          const detectedGeo = detectCountryFromLanguage();
          setCountryCode(detectedGeo);
          setCountryName(getCountryNameFromGeo(detectedGeo));
        }
      } else {
        // Use language-based detection if no saved preference
        const detectedGeo = detectCountryFromLanguage();
        setCountryCode(detectedGeo);
        setCountryName(getCountryNameFromGeo(detectedGeo));
      }
    }
  }, []);

  // Fetch trending data with country code parameter
  const fetchTrendingData = useCallback(async (geoCode?: string) => {
    try {
      setIsLoading(true);
      setHasError(false);
      
      // Use provided geoCode or fall back to state
      const geo = geoCode || countryCode;
      
      // Include country code in API request
      const response = await fetch(`/api/trends?geo=${geo}`);
      
      // Parse JSON even if status is not 200 to get potential error details
      const data = await response.json();
      
      if (!response.ok) {
        console.error(`API error: ${data.error || response.statusText}`);
        setHasError(true);
        // Don't update the trending data if we have an error response
        return;
      }
      
      // Check if we have valid trends data
      if (!data.trends || !Array.isArray(data.trends) || data.trends.length === 0) {
        console.error('No trending data available');
        setHasError(true);
        return;
      }
      
      setTrendingData(data);
      
      // Cache data by country
      const cacheKey = `trendingData_${geo}`;
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(`trendingLastFetch_${geo}`, Date.now().toString());
    } catch (error) {
      console.error('Error fetching trending data:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [countryCode]); // Add countryCode to dependency array

  // Check for cached data or fetch new data when country changes
  useEffect(() => {
    if (!isVisible || !countryCode) return;
    
    // Check cached data by country
    const cacheKey = `trendingData_${countryCode}`;
    const storedData = localStorage.getItem(cacheKey);
    const lastFetch = localStorage.getItem(`trendingLastFetch_${countryCode}`);
    const eightHoursInMs = 8 * 60 * 60 * 1000;
    
    let shouldFetchData = true;
    
    if (storedData && lastFetch && (Date.now() - parseInt(lastFetch) < eightHoursInMs)) {
      try {
        // Use cached data if less than 8 hours old
        const parsedData = JSON.parse(storedData);
        if (parsedData.trends && Array.isArray(parsedData.trends) && parsedData.trends.length > 0) {
          setTrendingData(parsedData);
          setIsLoading(false);
          setHasError(false);
          shouldFetchData = false;
        }
      } catch (e) {
        console.error('Error parsing cached data:', e);
        // Continue to fetch fresh data if cache parsing fails
      }
    }
    
    // Fetch new data if no valid cache
    if (shouldFetchData) {
      fetchTrendingData(countryCode);
    }
    
    // Regular update check (every 5 minutes)
    const intervalId = setInterval(() => {
      const lastFetch = localStorage.getItem(`trendingLastFetch_${countryCode}`);
      if (lastFetch && (Date.now() - parseInt(lastFetch) >= eightHoursInMs)) {
        fetchTrendingData(countryCode);
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [isVisible, countryCode, fetchTrendingData]);

  // Handle country change
  const handleCountryChange = (code: string, name: string) => {
    // Save selected country
    localStorage.setItem('selectedTrendingCountry', JSON.stringify({ code, name }));
    
    // Close dropdown
    setShowCountrySelector(false);
    
    // Update state
    setCountryCode(code);
    setCountryName(name);
    
    // Immediately fetch data for selected country
    // Pass the new code directly to ensure we use the updated value
    fetchTrendingData(code);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showCountrySelector && 
          buttonRef.current && 
          !buttonRef.current.contains(event.target as Node) &&
          !document.querySelector('.country-dropdown-portal')?.contains(event.target as Node)) {
        setShowCountrySelector(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCountrySelector]);

  // Handle toggle dropdown
  const toggleDropdown = () => {
    if (!showCountrySelector && !isMobile) {
      // Update position before showing
      updateDropdownPosition();
    }
    setShowCountrySelector(!showCountrySelector);
  };

  if (!isVisible) {
    return null;
  }

  // Dropdown content
  const CountryDropdown = () => {
    if (!isMounted || !showCountrySelector) return null;
    
    return createPortal(
      <div 
        className={`
          country-dropdown-portal
          ${isMobile ? 'mobile' : ''}
          border border-[var(--subtle-divider)] bg-[var(--background)]/95
        `}
        style={isMobile ? 
          undefined : 
          { 
            top: `${dropdownPosition.top}px`, 
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight: '320px',
            overflow: 'auto'
          }
        }
      >
        {isMobile && (
          <div className="sticky top-0 z-10 bg-[var(--background)] pt-6 pb-3">
            <div className="mobile-handle"></div>
            <div className="flex items-center justify-between px-4 mt-2">
              <span className="text-xs uppercase tracking-wider text-[var(--muted)]">Countries</span>
              <button 
                onClick={() => setShowCountrySelector(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
        
        {!isMobile && (
          <div className="text-xs uppercase tracking-wider text-[var(--muted)] p-4 border-b border-[var(--subtle-divider)]">
            Countries
          </div>
        )}
        
        <div className="scrollbar-thin">
          {POPULAR_COUNTRIES.map(country => (
            <div
              key={country.code}
              className={`
                country-option w-full text-left p-4 text-xs uppercase tracking-wider cursor-pointer
                ${country.code === countryCode ? 'active' : ''}
              `}
              onClick={() => handleCountryChange(country.code, country.name)}
            >
              {country.name}
            </div>
          ))}
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="w-full max-w-full mb-2 relative" ref={containerRef}>
      <div className="trending-header">
        <div className="header-left">
          <TrendingUp className="trending-icon h-3.5 w-3.5 text-[var(--muted)]" />
          <span className="text-xs uppercase tracking-wider text-[var(--muted)] mr-2">
            Trending
          </span>
        
          {/* Country selector button */}
          <div 
            ref={buttonRef}
            className={`country-selector-button flex items-center rounded-none text-xs uppercase tracking-wider cursor-pointer transition-[var(--transition)] ${showCountrySelector ? 'active text-[var(--foreground)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
            onClick={toggleDropdown}
            title="Select country"
          >
            <Globe className="h-3.5 w-3.5 opacity-80 mr-1.5" />
            <span className="mr-1">{countryName}</span>
            {showCountrySelector ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </div>
        </div>
        
        {hasError && (
          <button 
            onClick={() => fetchTrendingData(countryCode)} 
            className="p-1 hover:bg-[var(--accent)] rounded-none transition-[var(--transition)]"
            title="Try again"
          >
            <RefreshCw className="h-3 w-3 text-orange-500" />
          </button>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center w-full py-4 text-xs text-[var(--muted)]">
          <div className="animate-pulse flex items-center">
            <div className="h-1.5 w-1.5 bg-[var(--muted)] rounded-full mr-1"></div>
            <div className="h-1.5 w-1.5 bg-[var(--muted)] rounded-full mr-1 animate-pulse delay-100"></div>
            <div className="h-1.5 w-1.5 bg-[var(--muted)] rounded-full animate-pulse delay-200"></div>
          </div>
        </div>
      ) : hasError ? (
        <div className="flex items-center justify-center w-full py-4 text-xs text-orange-500">
          <AlertCircle className="h-3 w-3 mr-1" />
          <span>Unable to load trends</span>
        </div>
      ) : (
        <div className={`trending-terms-scroll ${compactView ? 'trending-terms-container' : 'flex flex-wrap gap-2'}`}>
          {trendingData?.trends?.map((trend, index) => (
            <button
              key={trend.position}
              onClick={() => onTermClick(trend.query)}
              className="trending-term"
              title={`Search for "${trend.query}"`}
              style={{
                // Add slight delay to each item to create a staggered animation effect
                animationDelay: `${index * 50}ms`,
                // Subtle variation in opacity based on position
                opacity: Math.max(0.7, 1 - (index * 0.02))
              }}
            >
              {trend.query}
            </button>
          ))}
        </div>
      )}
      
      {/* Country selector dropdown */}
      <CountryDropdown />
    </div>
  );
} 