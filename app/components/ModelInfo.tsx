import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { getModelById, isChatflixModel } from '@/lib/models/config'
import { getProviderLogo, hasLogo, getChatflixLogo } from '@/lib/models/logoUtils'

// Model name with logo component
export const ModelNameWithLogo = ({ modelId }: { modelId: string }) => {
  const model = getModelById(modelId);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const evaluateTheme = () => {
      const themeAttr = document.documentElement.getAttribute('data-theme');
      if (themeAttr === 'dark') return true;
      if (themeAttr === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return false;
    };

    setIsDarkTheme(evaluateTheme());

    const observer = new MutationObserver(() => {
      setIsDarkTheme(evaluateTheme());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => setIsDarkTheme(evaluateTheme());
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  // Auto-collapse after a delay
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 3000); // Collapse after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // Collapse when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  if (!model) {
    return (
      <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
        {modelId}
      </div>
    );
  }
  
  // Always use abbreviation when available
  const displayName = model.abbreviation || model.name || modelId;
  
  const hasProviderLogo = model.provider && hasLogo(model.provider, model.id);
  const isChatflix = model?.id ? isChatflixModel(model.id) : false;
  const chatflixLogoSrc = getChatflixLogo({ isDark: isDarkTheme });
  const providerLogoSrc = model.provider 
    ? (isChatflix ? chatflixLogoSrc : getProviderLogo(model.provider, model.id))
    : '';

  return (
    <div
      ref={containerRef}
      onClick={() => setIsExpanded(!isExpanded)}
      className={`relative flex items-center transition-all duration-300 ease-in-out cursor-pointer group
        ${isExpanded
            ? 'bg-black/5 dark:bg-white/5 text-[var(--muted)] hover:bg-black/10 dark:hover:bg-white/10 px-2 py-1 gap-1.5 h-7 rounded-full'
            : 'w-7 h-7 justify-center'
        }`
      }
      title={`Model: ${displayName}`}
    >
      <div className={`flex-shrink-0 w-3 h-3 flex items-center justify-center transition-transform duration-300 ease-in-out ${!isExpanded ? 'group-hover:scale-110' : ''}`}>
        {hasProviderLogo && providerLogoSrc && (
            <Image 
                src={providerLogoSrc}
                alt={isChatflix ? 'Chatflix logo' : `${model.provider} logo`}
                width={12}
                height={12}
                className="object-contain"
            />
        )}
      </div>

      {/* Text container */}
      <div 
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxWidth: isExpanded ? '100px' : '0', whiteSpace: 'nowrap' }}
      >
        <span className="uppercase tracking-wider text-xs font-medium">
            {displayName}
        </span>
      </div>
    </div>
  );
};

// Model capability badges component
export const ModelCapabilityBadges = ({ modelId }: { modelId: string }) => {
  const model = getModelById(modelId);
  if (!model) return null;
  
  // Add state to check if on mobile
  const [isMobile, setIsMobile] = useState(false);
  
  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);
  
    return (
    <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
      {/* Vision/Image Support */}
      <div className={`${isMobile ? 'w-7 h-7 rounded-full' : 'rounded-full px-2 py-1'} text-xs flex items-center justify-center cursor-pointer bg-black/5 dark:bg-white/5 text-[var(--muted)] hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-200`} title={model.supportsVision ? "Supports images" : "Text only"}>
        {model.supportsVision ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} flex-shrink-0`}>
              <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            {!isMobile && <span className="ml-1">Image</span>}
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} flex-shrink-0`}>
              <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
              <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
              <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
            </svg>
            {!isMobile && <span className="ml-1">Text</span>}
          </>
        )}
      </div>
      
      {/* PDF Support */}
      {model.supportsPDFs && (
        <div className={`${isMobile ? 'w-7 h-7 rounded-full' : 'rounded-full px-2 py-1'} text-xs font-medium flex items-center justify-center cursor-pointer bg-black/5 dark:bg-white/5 text-[var(--muted)] hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-200`} title="Supports PDFs">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} flex-shrink-0`}>
            <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM9.75 14.25a.75.75 0 000 1.5H15a.75.75 0 000-1.5H9.75z" clipRule="evenodd" />
            <path d="M14.25 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0016.5 7.5h-1.875a.375.375 0 01-.375-.375V5.25z" />
          </svg>
          {!isMobile && <span className="ml-1">PDF</span>}
        </div>
      )}
            
    </div>
  );
}; 