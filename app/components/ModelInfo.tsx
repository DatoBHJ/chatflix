import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { getModelById } from '@/lib/models/config'
import { getProviderLogo, hasLogo } from '@/app/lib/models/logoUtils'

// Model name with logo component
export const ModelNameWithLogo = ({ modelId }: { modelId: string }) => {
  const model = getModelById(modelId);
  
  if (!model) {
    return (
      <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
        {modelId}
      </div>
    );
  }
  
  // Always use abbreviation when available
  const displayName = model.abbreviation || model.name || modelId;
  
  return (
    <div className="flex items-center gap-1.5">
      {/* Provider Logo */}
      {model.provider && hasLogo(model.provider) && (
        <div className="w-3.5 h-3.5 flex-shrink-0 rounded-full overflow-hidden border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
          <Image 
            src={getProviderLogo(model.provider, model.id)}
            alt={`${model.provider} logo`}
            width={14}
            height={14}
            className="object-contain"
          />
        </div>
      )}
      <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
        {displayName}
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
    <div className="flex items-center gap-2">
      {/* Context Window Badge */}
      {model.contextWindow && (
        <div 
          className="rounded-full px-1.5 py-0.5 text-xs flex items-center gap-1 hover:bg-[var(--foreground)]/5" 
          title={`Context Window: ${model.contextWindow.toLocaleString()} tokens - Maximum amount of text this model can process in a single conversation.`}
        >
          {/* 데스크탑에서만 아이콘 표시 */}
          {!isMobile && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 003 3h15.75a3 3 0 01-3-3V4.875C18 3.839 17.16 3 16.125 3H4.125zM12 9.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5H12zm-.75-2.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H12a.75.75 0 01-.75-.75zM6 12.75a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5H6zm-.75 3.75a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5H6a.75.75 0 01-.75-.75zM6 6.75a.75.75 0 00-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 00.75-.75v-3A.75.75 0 009 6.75H6z" clipRule="evenodd" />
              <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 01-3 0V6.75z" />
            </svg>
          )}
          <span className="text-xs">
            {isMobile ? (
              // 모바일에서는 숫자만 표시 (예: "200K")
              model.contextWindow >= 1000000 
                ? `${(model.contextWindow / 1000000).toFixed(0)}M`
                : `${Math.round(model.contextWindow / 1000)}K`
            ) : (
              // 데스크탑에서는 기존 형식 유지 (예: "200K Context")
              model.contextWindow >= 1000000 
                ? `${(model.contextWindow / 1000000).toFixed(0)}M Context`
                : `${Math.round(model.contextWindow / 1000)}K Context`
            )}
          </span>
        </div>
      )}
      
      {/* Vision/Image Support - existing badge */}
      <div className={`rounded-full px-1.5 py-0.5 text-xs flex items-center gap-1 ${ 
        model.supportsVision 
          ? 'bg-[var(--accent)]/20' 
          : 'bg-[var(--muted)]/20'
      }`} title={model.supportsVision ? "Supports image input" : "Text-only model"}>
        {model.supportsVision ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
            <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
            <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
            <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
            <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
          </svg>
        )}
        {/* Show text only on desktop */}
        {!isMobile && (
          <span className="text-[9px] font-medium">
            {model.supportsVision ? 'Image' : 'Text-only'}
          </span>
        )}
      </div>
      
      {/* PDF Support - Use the exact ModelSelector.tsx styling */}
      {model.supportsPDFs && (
        <div className="rounded-full px-1.5 py-0.5 text-xs bg-[var(--accent)]/20 flex items-center gap-1" title="Can process PDF documents">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM9.75 14.25a.75.75 0 000 1.5H15a.75.75 0 000-1.5H9.75z" clipRule="evenodd" />
            <path d="M14.25 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0016.5 7.5h-1.875a.375.375 0 01-.375-.375V5.25z" />
          </svg>
          {/* Show text only on desktop */}
          {!isMobile && <span className="text-[9px] font-medium">PDF</span>}
        </div>
      )}
      
      {/* Censorship Status - Use the exact ModelSelector.tsx styling */}
      {typeof model.censored !== 'undefined' && (
        <div className={`rounded-full px-1.5 py-0.5 text-xs flex items-center gap-1 ${ 
          model.censored 
            ? 'bg-[#FFA07A]/20' 
            : 'bg-[#90EE90]/20'
        }`} title={model.censored ? "Content may be filtered" : "Uncensored"}>
          {model.censored ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path d="M18 1.5c2.9 0 5.25 2.35 5.25 5.25v3.75a.75.75 0 0 1-1.5 0V6.75a3.75 3.75 0 1 0-7.5 0v3a3 3 0 0 1 3 3v6.75a3 3 0 0 1-3 3H3.75a3 3 0 0 1-3-3v-6.75a3 3 0 0 1 3-3h9v-3c0-2.9 2.35-5.25 5.25-5.25Z" />
            </svg>
          )}
          {/* Show text only on desktop */}
          {!isMobile && (
            <span className="text-[9px] font-medium">
              {model.censored ? 'Censored' : 'Uncensored'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}; 