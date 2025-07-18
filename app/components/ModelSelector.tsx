import { Dispatch, SetStateAction, useState, useRef, useEffect } from 'react';
import { getEnabledModels } from '@/lib/models/config';
import Image from 'next/image';
import type { ModelConfig } from '@/lib/models/config';
import { getProviderLogo, hasLogo } from '@/lib/models/logoUtils';
import { checkSubscriptionClient } from '@/lib/subscription-client';
import { getMetricTranslationsForUser, Translations } from '@/app/lib/metricTranslations';
import { getChatInputTranslations } from '@/app/lib/chatInputTranslations';



interface ModelSelectorProps {
  currentModel: string;
  nextModel: string;
  setNextModel: Dispatch<SetStateAction<string>>;
  setCurrentModel?: Dispatch<SetStateAction<string>>;
  disabled?: boolean;
  position?: 'top' | 'bottom';
  disabledModels?: string[];
  disabledLevel?: string;
  disabledLevels?: string[];
  isAgentEnabled?: boolean;
  onAgentAvailabilityChange?: (hasAgentModels: boolean) => void;
  user?: any; // Add user prop
}

export function ModelSelector({ 
  currentModel, 
  nextModel, 
  setNextModel, 
  setCurrentModel,
  disabled, 
  position = 'bottom',
  disabledModels = [],
  disabledLevel,
  disabledLevels = [],
  isAgentEnabled = false,
  onAgentAvailabilityChange,
  user // Add user parameter
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [modelFilter, setModelFilter] = useState<'all' | 'thinking' | 'regular'>('all');
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sortCriteria, setSortCriteria] = useState<'default' | 'tps' | 'latency' | 'intelligenceIndex' | 'contextWindow'>('default');
  const [hoveredSortMetric, setHoveredSortMetric] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Translations>(getMetricTranslationsForUser('en'));
  const [inputTranslations, setInputTranslations] = useState({
    contextUsage: 'Context Usage',
    upgrade: 'Upgrade',
    upgradeToPro: 'Upgrade to Pro',
    getFullContext: 'Get full {contextWindow} context window',
    proSubscriptionActive: 'Pro subscription active',
    requiresProSubscription: 'Requires Pro subscription',
    getProAccess: 'Get Pro Access',
    fullAccessWithPro: 'Full access with Pro subscription',
    available: 'available',
    context: 'Context'
  });
  
  // Add search functionality
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Add keyboard navigation state
  const [keyboardSelectedIndex, setKeyboardSelectedIndex] = useState<number>(-1);
  
  // Context window limit for non-subscribers (60K tokens)
  const CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER = 60000;

  useEffect(() => {
    // This effect runs only on the client side to get browser language
    setTranslations(getMetricTranslationsForUser());
    
    // Get ChatInput translations and extend with ModelSelector-specific ones
    const chatTranslations = getChatInputTranslations();
    setInputTranslations({
      contextUsage: chatTranslations.contextUsage,
      upgrade: chatTranslations.upgrade,
      upgradeToPro: chatTranslations.upgradeToPro || 'Upgrade to Pro',
      getFullContext: chatTranslations.getFullContext || 'Get full {contextWindow} context window',
      proSubscriptionActive: 'Pro subscription active',
      requiresProSubscription: 'Requires Pro subscription',
      getProAccess: 'Get Pro Access',
      fullAccessWithPro: 'Full access with Pro subscription',
      available: 'available',
      context: 'Context'
    });
  }, []);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Add subscription check
  useEffect(() => {
    let ignore = false;
    async function check() {
      setIsSubscriptionLoading(true);
      if (!user?.id) {
        setIsSubscribed(false);
        setIsSubscriptionLoading(false);
        return;
      }
      try {
        const has = await checkSubscriptionClient();
        if (!ignore) setIsSubscribed(has);
      } catch {
        if (!ignore) setIsSubscribed(false);
      } finally {
        if (!ignore) setIsSubscriptionLoading(false);
      }
    }
    check();
    return () => { ignore = true; };
  }, [user?.id]);

  // Get all models and filter based on web search enabled state and model filter
  const allModels = getEnabledModels();
  const filteredModels = isAgentEnabled 
    ? allModels.filter(model => model.isAgentEnabled) 
    : allModels;
    
  // Apply thinking/regular filter, search filter, and sorting
  const MODEL_OPTIONS = (() => {
    // First filter models based on the model type filter
    let filteredByType: ModelConfig[] = [];
    if (modelFilter === 'all') filteredByType = filteredModels;
    if (modelFilter === 'thinking') filteredByType = filteredModels.filter(model => model.name.includes('(Thinking)'));
    if (modelFilter === 'regular') filteredByType = filteredModels.filter(model => !model.name.includes('(Thinking)'));
    
    // Apply search filter
    const filteredBySearch = searchTerm.trim() 
      ? filteredByType.filter(model => 
          model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          model.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (model.description && model.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : filteredByType;
    
    // Now sort based on selected criteria
    return [...filteredBySearch].sort((a, b) => {
      if (sortCriteria === 'default') {
        // Default sorting: chatflix models first, then new models
      const aChatflix = a.id === 'chatflix-ultimate' || a.id === 'chatflix-ultimate-pro';
      const bChatflix = b.id === 'chatflix-ultimate' || b.id === 'chatflix-ultimate-pro';
      
      if (aChatflix && !bChatflix) return -1;
      if (!aChatflix && bChatflix) return 1;
      
      // If both are chatflix models, pro comes first, then ultimate
      if (aChatflix && bChatflix) {
        if (a.id === 'chatflix-ultimate-pro') return -1;
        if (b.id === 'chatflix-ultimate-pro') return 1;
        return 0;
      }
      
      // Then prioritize new models
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      return 0;
      }
      
      // Sort by selected metric
      const aValue = a[sortCriteria] as number;
      const bValue = b[sortCriteria] as number;
      
      // Handle cases where metric doesn't exist
      if (typeof aValue !== 'number' && typeof bValue !== 'number') return 0;
      if (typeof aValue !== 'number') return 1;
      if (typeof bValue !== 'number') return -1;
      
      // For latency, lower is better (so we reverse the sort)
      if (sortCriteria === 'latency') {
        return aValue - bValue;
      }
      
      // For other metrics, higher is better
      return bValue - aValue;
    });
  })();

  // Combine disabledLevel and disabledLevels for backward compatibility
  const allDisabledLevels = [...disabledLevels];
  if (disabledLevel && !allDisabledLevels.includes(disabledLevel)) {
    allDisabledLevels.push(disabledLevel);
  }

  // Reset keyboard selection when search term changes or models change
  useEffect(() => {
    setKeyboardSelectedIndex(-1);
  }, [searchTerm, modelFilter, sortCriteria]);

  // Keyboard navigation handler
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;
      
      const enabledModels = MODEL_OPTIONS.filter(option => {
        const isModelDisabled = disabledModels.includes(option.id) || 
                             (allDisabledLevels.length > 0 && allDisabledLevels.includes(option.rateLimit.level)) ||
                             !option.isActivated ||
                             (option.pro && !(isSubscribed ?? false));
        return !isModelDisabled;
      });

      if (enabledModels.length === 0) return;
      
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setKeyboardSelectedIndex(prev => {
            const newIndex = prev < enabledModels.length - 1 ? prev + 1 : 0;
            const targetModel = enabledModels[newIndex];
            const overallIndex = MODEL_OPTIONS.findIndex(m => m.id === targetModel.id);
            if (overallIndex !== -1) {
              setTimeout(() => scrollToSelectedItem(overallIndex), 0);
            }
            return newIndex;
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          setKeyboardSelectedIndex(prev => {
            const newIndex = prev > 0 ? prev - 1 : enabledModels.length - 1;
            const targetModel = enabledModels[newIndex];
            const overallIndex = MODEL_OPTIONS.findIndex(m => m.id === targetModel.id);
            if (overallIndex !== -1) {
              setTimeout(() => scrollToSelectedItem(overallIndex), 0);
            }
            return newIndex;
          });
          break;
        case 'Enter':
          event.preventDefault();
          if (keyboardSelectedIndex >= 0 && keyboardSelectedIndex < enabledModels.length) {
            const selectedModel = enabledModels[keyboardSelectedIndex];
            setNextModel(selectedModel.id);
            if (setCurrentModel) {
              setCurrentModel(selectedModel.id);
            }
            setIsOpen(false);
            setSearchTerm('');
            setKeyboardSelectedIndex(-1);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          setSearchTerm('');
          setKeyboardSelectedIndex(-1);
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, keyboardSelectedIndex, MODEL_OPTIONS, disabledModels, allDisabledLevels, isSubscribed, setNextModel, setCurrentModel]);

  // Scroll to selected item function
  const scrollToSelectedItem = (index: number) => {
    const modelElements = containerRef.current?.querySelectorAll('[data-model-option]');
    if (modelElements && modelElements[index]) {
      const element = modelElements[index] as HTMLElement;
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  };

  // Update selected model when filter changes
  useEffect(() => {
    if (modelFilter === 'all') return;
    
    const isCurrentModelInFilter = (() => {
      if (modelFilter === 'thinking') {
        return MODEL_OPTIONS.some(model => model.id === nextModel && model.name.includes('(Thinking)'));
      } else if (modelFilter === 'regular') {
        return MODEL_OPTIONS.some(model => model.id === nextModel && !model.name.includes('(Thinking)'));
      }
      return true;
    })();
    
    // If current model doesn't match filter, select first model in filtered list
    if (!isCurrentModelInFilter && MODEL_OPTIONS.length > 0) {
      setNextModel(MODEL_OPTIONS[0].id);
    }
  }, [modelFilter, nextModel, MODEL_OPTIONS, setNextModel]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(''); // Clear search when closing
        setKeyboardSelectedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle ESC key to close dropdown
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm(''); // Clear search when closing
        setKeyboardSelectedIndex(-1);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const currentModelOption = MODEL_OPTIONS.find(option => option.id === nextModel) || 
    allModels.find(model => model.id === nextModel);

  // Update nextModel if current model doesn't support web search when web search is enabled
  // or if the model is deactivated
  useEffect(() => {
    const currentModelData = allModels.find(m => m.id === nextModel);
    
    if (
      (isAgentEnabled && currentModelData?.isAgentEnabled !== true) ||
      (currentModelData?.isActivated === false)
    ) {
      // When switching to agent mode, find a non-rate-limited agent-enabled model
      const nonRateLimitedAgentModels = allModels.filter(model => 
        model.isAgentEnabled === true && 
        model.isActivated && 
        !disabledLevels.includes(model.rateLimit.level)
      );
      
      // If we have non-rate-limited agent models, use the first one
      if (nonRateLimitedAgentModels.length > 0) {
        const newModelId = nonRateLimitedAgentModels[0].id;
        setNextModel(newModelId);
        // Also update currentModel if the prop is provided
        if (setCurrentModel) {
          setCurrentModel(newModelId);
        }
      } else {
        // If all agent models are rate-limited, find any non-rate-limited model
        const anyNonRateLimitedModel = allModels.find(model => 
          model.isActivated && !disabledLevels.includes(model.rateLimit.level)
        );
        
        if (anyNonRateLimitedModel) {
          const newModelId = anyNonRateLimitedModel.id;
          setNextModel(newModelId);
          // Also update currentModel if the prop is provided
          if (setCurrentModel) {
            setCurrentModel(newModelId);
          }
        }
      }
    }
  }, [isAgentEnabled, nextModel, allModels, setNextModel, setCurrentModel, disabledLevels]);

  // Check if we have any non-rate-limited agent models
  // This can be used to disable the agent toggle button
  const hasNonRateLimitedAgentModels = allModels.some(model => 
    model.isAgentEnabled === true && 
    model.isActivated && 
    !disabledLevels.includes(model.rateLimit.level)
  );

  // Notify parent if agent models are available
  useEffect(() => {
    if (onAgentAvailabilityChange) {
      onAgentAvailabilityChange(hasNonRateLimitedAgentModels);
    }
  }, [hasNonRateLimitedAgentModels, onAgentAvailabilityChange]);

  // Tooltip component with improved hover handling
  const TooltipWrapper = ({ 
    children, 
    tooltip, 
    tooltipId, 
    isSelected,
    isProModel = false,
    isDisabled = false
  }: { 
    children: React.ReactNode; 
    tooltip: string | React.ReactNode; 
    tooltipId: string;
    isSelected: boolean;
    isProModel?: boolean;
    isDisabled?: boolean;
  }) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (!isMobile) {
        setHoveredTooltip(tooltipId);
      }
    };

    const handleMouseLeave = () => {
      if (!isMobile) {
        timeoutRef.current = setTimeout(() => {
          setHoveredTooltip(null);
        }, 300); // 300ms 딜레이로 충분한 시간 제공
      }
    };

    const handleTooltipMouseEnter = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const handleTooltipMouseLeave = () => {
      if (!isMobile) {
        setHoveredTooltip(null);
      }
    };

    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    return (
      <div 
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          if (isMobile) {
            e.preventDefault();
            e.stopPropagation();
            setHoveredTooltip(hoveredTooltip === tooltipId ? null : tooltipId);
          }
        }}
      >
        {children}
        {hoveredTooltip === tooltipId && !(isProModel && isDisabled) && (
          <div 
            className={`absolute z-50 bottom-full mb-3 left-0 w-56 bg-white/90 dark:bg-black/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/20 dark:shadow-black/60 animate-in fade-in duration-200 slide-in-from-bottom-2 opacity-100 ${
              isSelected 
                ? 'bg-white/95 dark:bg-black/85' 
                : ''
            }`}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
            style={{
              transform: 'translateY(-4px)',
              WebkitBackdropFilter: 'blur(24px)',
              backdropFilter: 'blur(24px)'
            }}
          >
            <div className="relative">
              <div className="text-sm text-gray-900 dark:text-white font-medium leading-relaxed">
                {tooltip}
              </div>
              {/* Apple-style arrow pointing down */}
              <div className={`absolute top-full left-6 mt-1.5 w-3 h-3 bg-white/90 dark:bg-black/80 border-r border-b border-black/5 dark:border-white/10 rotate-45 backdrop-blur-2xl -z-10 ${
                isSelected 
                  ? 'bg-white/95 dark:bg-black/85' 
                  : ''
              }`}></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-4 pb-0">
        <div className={`relative inline-block ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {/* iMessage-style "To:" field */}
          <div 
            className={`flex items-center gap-2 cursor-text px-2 pl-3 ${disabled ? 'cursor-not-allowed' : ''}`}
            onClick={() => {
              if (!disabled) {
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 100);
              }
            }}
          >
            <span className="text-[var(--muted)] text-sm font-medium">To:</span>
            
            {!isOpen ? (
              // Show selected model when not searching
              <>
                <div className="flex items-center gap-2 backdrop-blur-md bg-[#007AFF]/5 dark:bg-[#007AFF]/10 px-2 py-1 rounded-full">
                  {/* {currentModelOption?.provider && (
                    <div className="provider-logo w-4 h-4 flex-shrink-0">
                      {hasLogo(currentModelOption.provider) ? (
                        <Image 
                          src={getProviderLogo(currentModelOption.provider, currentModelOption.id)}
                          alt={`${currentModelOption.provider} logo`}
                          width={16}
                          height={16}
                          className="object-contain"
                        />
                      ) : (
                        <div className="w-4 h-4 flex items-center justify-center text-[8px] uppercase bg-[#007AFF]/20 text-[#007AFF] rounded-sm">
                          {currentModelOption.provider.substring(0, 1)}
                        </div>
                      )}
                    </div>
                  )} */}
                  <span className="text-[#007AFF]/100 dark:text-[#007AFF] text-sm font-medium">
                    {currentModelOption?.name || nextModel}
                  </span>
                </div>
                {/* <span className="ml-1 opacity-60 text-xl text-[var(--muted)]">▾</span> */}
              </>
            ) : (
              // Show search input when open
              <>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search models..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] min-w-[200px]"
                  disabled={disabled}
                />
                {/* Search icon - only show when active */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[var(--muted)] flex-shrink-0">
                  <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
                </svg>
              </>
            )}
          </div>
        
          {isOpen && !disabled && (
            <div 
              className={`
                model-dropdown
                ${isMobile 
                  ? 'px-2 fixed inset-x-0 bottom-0 w-full max-h-[80vh] overflow-y-auto pb-6 model-selector-scroll rounded-t-2xl bg-white/80 dark:bg-neutral-950/80 backdrop-blur-2xl shadow-2xl border-t border-black/5 dark:border-white/5' 
                  : `absolute left-1 ${position === 'top' ? 'bottom-full mb-2 w-[592px] max-h-[600px]' : 'top-full mt-2 w-[600px] max-h-[400px]'} px-2 md:px-3 left-0 overflow-y-auto model-selector-scroll rounded-2xl bg-white/80 dark:bg-neutral-950/80 backdrop-blur-2xl shadow-2xl border border-black/5 dark:border-white/5`
                }
                z-50
              `}
              role="listbox"
            >

              
              {/* Mobile mode header */}
              {isMobile && (
                <div className="sticky top-0 z-10 bg-white/95 dark:bg-neutral-950/95 pt-6 pb-3 -mx-2 px-2">
                  <div className="mobile-handle"></div>
                  <div className="flex items-center justify-between px-4 mt-2">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wider opacity-70">Models</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setIsOpen(false)}
                        className="text-[var(--muted)] hover:text-[var(--foreground)] text-xs"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Sort Controls */}
              <div className="sticky top-0 z-10 bg-white/95 dark:bg-neutral-950/95 border-b border-black/5 dark:border-white/5 px-4 py-3 -mx-2 md:-mx-3">
                <div className="flex items-center gap-1 sm:gap-3 flex-wrap relative">
                  {/* Sort Icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[var(--muted)] flex-shrink-0">
                    <path d="M3 7h18v2H3V7zm0 4h12v2H3v-2zm0 4h6v2H3v-2z" />
                  </svg>
                  
                  <button 
                    onClick={() => setSortCriteria('default')}
                    className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
                      sortCriteria === 'default' 
                        ? 'bg-[#007AFF] text-white' 
                        : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {translations.names.default}
                  </button>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setSortCriteria('latency')}
                      onMouseEnter={() => setHoveredSortMetric('latency')}
                      onMouseLeave={() => setHoveredSortMetric(null)}
                      className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        sortCriteria === 'latency' 
                          ? 'bg-[#007AFF] text-white' 
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {translations.names.latency}
                    </button>
                    {hoveredSortMetric === 'latency' && (
                      <div 
                        className="absolute top-full mt-3 left-0 z-50 w-72 bg-white/90 dark:bg-black/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/20 dark:shadow-black/60 animate-in fade-in duration-200 slide-in-from-top-2"
                        style={{
                          transform: 'translateY(4px)',
                          WebkitBackdropFilter: 'blur(24px)',
                          backdropFilter: 'blur(24px)'
                        }}
                      >
                        <div className="relative">
                          <div className="text-sm text-gray-900 dark:text-white font-medium leading-relaxed">
                            {translations.tooltips.latency}
                          </div>
                          {/* Apple-style arrow pointing up */}
                          <div className="absolute bottom-full left-6 mb-1.5 w-3 h-3 bg-white/90 dark:bg-black/80 border-l border-t border-black/5 dark:border-white/10 rotate-45 backdrop-blur-2xl -z-10"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setSortCriteria('tps')}
                      onMouseEnter={() => setHoveredSortMetric('tps')}
                      onMouseLeave={() => setHoveredSortMetric(null)}
                      className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        sortCriteria === 'tps' 
                          ? 'bg-[#007AFF] text-white' 
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {translations.names.tps}
                    </button>
                    {hoveredSortMetric === 'tps' && (
                      <div 
                        className="absolute top-full mt-3 left-0 z-50 w-72 bg-white/90 dark:bg-black/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/20 dark:shadow-black/60 animate-in fade-in duration-200 slide-in-from-top-2"
                        style={{
                          transform: 'translateY(4px)',
                          WebkitBackdropFilter: 'blur(24px)',
                          backdropFilter: 'blur(24px)'
                        }}
                      >
                        <div className="relative">
                          <div className="text-sm text-gray-900 dark:text-white font-medium leading-relaxed">
                            {translations.tooltips.tps}
                          </div>
                          {/* Apple-style arrow pointing up */}
                          <div className="absolute bottom-full left-6 mb-1.5 w-3 h-3 bg-white/90 dark:bg-black/80 border-l border-t border-black/5 dark:border-white/10 rotate-45 backdrop-blur-2xl -z-10"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setSortCriteria('intelligenceIndex')}
                      onMouseEnter={() => setHoveredSortMetric('intelligenceIndex')}
                      onMouseLeave={() => setHoveredSortMetric(null)}
                      className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        sortCriteria === 'intelligenceIndex' 
                          ? 'bg-[#007AFF] text-white' 
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {translations.names.intelligenceIndex}
                    </button>
                    {hoveredSortMetric === 'intelligenceIndex' && (
                      <div 
                        className="absolute top-full mt-3 left-0 z-50 w-72 bg-white/90 dark:bg-black/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/20 dark:shadow-black/60 animate-in fade-in duration-200 slide-in-from-top-2"
                        style={{
                          transform: 'translateY(4px)',
                          WebkitBackdropFilter: 'blur(24px)',
                          backdropFilter: 'blur(24px)'
                        }}
                      >
                        <div className="relative">
                          <div className="text-sm text-gray-900 dark:text-white font-medium leading-relaxed">
                            {translations.tooltips.intelligenceIndex}
                          </div>
                          {/* Apple-style arrow pointing up */}
                          <div className="absolute bottom-full left-6 mb-1.5 w-3 h-3 bg-white/90 dark:bg-black/80 border-l border-t border-black/5 dark:border-white/10 rotate-45 backdrop-blur-2xl -z-10"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setSortCriteria('contextWindow')}
                      onMouseEnter={() => setHoveredSortMetric('contextWindow')}
                      onMouseLeave={() => setHoveredSortMetric(null)}
                      className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        sortCriteria === 'contextWindow' 
                          ? 'bg-[#007AFF] text-white' 
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {translations.names.contextWindow}
                    </button>
                    {hoveredSortMetric === 'contextWindow' && (
                      <div 
                        className="absolute top-full mt-3 right-0 z-50 w-72 bg-white/90 dark:bg-black/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/20 dark:shadow-black/60 animate-in fade-in duration-200 slide-in-from-top-2"
                        style={{
                          transform: 'translateY(4px)',
                          WebkitBackdropFilter: 'blur(24px)',
                          backdropFilter: 'blur(24px)'
                        }}
                      >
                        <div className="relative">
                          <div className="text-sm text-gray-900 dark:text-white font-medium leading-relaxed">
                            {translations.tooltips.contextWindow}
                          </div>
                          {/* Apple-style arrow pointing up - positioned for right alignment */}
                          <div className="absolute bottom-full right-6 mb-1.5 w-3 h-3 bg-white/90 dark:bg-black/80 border-l border-t border-black/5 dark:border-white/10 rotate-45 backdrop-blur-2xl -z-10"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            
              
              {/* Model options list */}
              <div className="py-2">
                  {MODEL_OPTIONS.length > 0 ? (
                    MODEL_OPTIONS.map((option, index) => {
                      // Check if this model is disabled
                      const isModelDisabled = disabledModels.includes(option.id) || 
                                           (allDisabledLevels.length > 0 && allDisabledLevels.includes(option.rateLimit.level)) ||
                                           !option.isActivated ||
                                           // Add Pro model check
                                           (option.pro && !(isSubscribed ?? false));
                      
                      const isSelected = option.id === nextModel;
                      
                      // Get index in enabled models for keyboard navigation
                      const enabledModels = MODEL_OPTIONS.filter(opt => {
                        const isDisabled = disabledModels.includes(opt.id) || 
                                       (allDisabledLevels.length > 0 && allDisabledLevels.includes(opt.rateLimit.level)) ||
                                       !opt.isActivated ||
                                       (opt.pro && !(isSubscribed ?? false));
                        return !isDisabled;
                      });
                      const enabledIndex = enabledModels.findIndex(opt => opt.id === option.id);
                      const isKeyboardSelected = !isModelDisabled && enabledIndex === keyboardSelectedIndex;
                      
                      // Calculate max value for the selected metric to scale bars
                      const maxValue = sortCriteria !== 'default' ? 
                        Math.max(...MODEL_OPTIONS
                          .filter(m => typeof m[sortCriteria] === 'number')
                          .map(m => m[sortCriteria] as number)
                        ) : 0;
                      
                      // Calculate bar width for current metric
                      const metricValue = sortCriteria !== 'default' ? option[sortCriteria] as number : 0;
                      const hasMetricValue = typeof metricValue === 'number';
                      const barWidth = hasMetricValue && maxValue > 0 ? 
                        (metricValue / maxValue) * 100 : 0;
                      
                      // Format value helper
                      const formatValue = (value: number, metric: string) => {
                        switch(metric) {
                          case 'tps':
                            return `${Math.round(value)}`;
                          case 'intelligenceIndex':
                            return `${Math.round(value)}`;
                          case 'contextWindow':
                            return value >= 1000000 
                              ? `${(value / 1000000).toFixed(1)}M`
                              : `${Math.round(value / 1000)}K`;
                          case 'latency':
                            return `${value.toFixed(1)}s`;
                          default:
                            return `${value}`;
                        }
                      };
                      
                      return (
                        <div key={option.id} className="border-b border-black/5 dark:border-white/5 last:border-b-0">
                          <div 
                            data-model-option
                            className={`group relative transition-all p-3 rounded-xl cursor-pointer
                                     ${isModelDisabled 
                                       ? 'opacity-50 cursor-not-allowed disabled' 
                                       : ''}
                                     ${isSelected 
                                       ? 'bg-[#007AFF] text-white' 
                                       : isKeyboardSelected
                                       ? 'bg-black/5 dark:bg-white/5'
                                       : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                            onClick={() => {
                              if (!isModelDisabled) {
                                setNextModel(option.id);
                                if (setCurrentModel) {
                                  setCurrentModel(option.id);
                                }
                                setIsOpen(false);
                                setSearchTerm(''); // Clear search when selecting
                                setKeyboardSelectedIndex(-1);
                              }
                            }}
                            onMouseEnter={() => {
                              if (!isModelDisabled) {
                                setHoverIndex(index);
                                // Update keyboard selection to match mouse hover for enabled models
                                if (enabledIndex >= 0) {
                                  setKeyboardSelectedIndex(enabledIndex);
                                }
                              }
                            }}
                            onMouseLeave={() => !isModelDisabled && setHoverIndex(null)}
                            role="option"
                            aria-selected={isSelected}
                            aria-disabled={isModelDisabled ? 'true' : 'false'}
                          >
                            {/* Metric Bar - positioned on the right */}
                            {sortCriteria !== 'default' && hasMetricValue && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                <span className={`text-xs font-medium min-w-[2.5rem] text-right ${
                                  isSelected ? 'text-white/80' : 'text-[var(--muted)]'
                                }`}>
                                  {formatValue(metricValue, sortCriteria)}
                                </span>
                                <div className="w-16 h-2 bg-transparent rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-300 ${
                                      isSelected ? 'bg-white/40' : 'bg-[var(--foreground)]'
                                    }`}
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-3 w-full pr-20">
                              {/* Provider Logo - Large circular style like sidebar */}
                              <div className="flex-shrink-0">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                  isSelected ? 'bg-white/25' : 'bg-[var(--accent)]'
                                }`}>
                                  {option.provider && hasLogo(option.provider) ? (
                                    <Image 
                                      src={getProviderLogo(option.provider, option.id)}
                                      alt={`${option.provider} logo`}
                                      width={20}
                                      height={20}
                                      className="object-contain"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center rounded-full">
                                      <span className={`text-lg font-semibold ${
                                        isSelected ? 'text-white' : 'text-gray-500'
                                      }`}>
                                        {option.provider ? option.provider.substring(0, 1).toUpperCase() : 'A'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                {/* Top line: Model name + Badges */}
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-semibold text-sm ${
                                      isSelected ? 'text-white' : 'text-[var(--foreground)]'
                                    }`}>
                                      {option.name}
                                    </span>
                                    
                                    {/* Add Pro badge for Pro models */}
                                    {option.pro && (
                                      <TooltipWrapper
                                                                            tooltip={
                                        isSubscribed ? 
                                          inputTranslations.proSubscriptionActive : 
                                          (
                                            <div>
                                              <p className="mb-2">{inputTranslations.requiresProSubscription}</p>
                                              <a 
                                                href="/pricing" 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="group mt-2 w-full inline-flex items-center justify-center gap-2 text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110">
                                                  <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3V12.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                                </svg>
                                                {inputTranslations.getProAccess}
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5">
                                                  <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                                                </svg>
                                              </a>
                                            </div>
                                          )
                                      }
                                        tooltipId={`${option.id}-pro`}
                                        isSelected={isSelected}
                                        isProModel={true}
                                        isDisabled={isModelDisabled}
                                      >
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                                          isSelected 
                                            ? 'bg-white/20 text-white' 
                                            : 'bg-green-400/10 text-green-500 dark:bg-green-500/10 dark:text-green-400'
                                        }`}>
                                          Pro
                                        </span>
                                      </TooltipWrapper>
                                    )}
                                    
                                    {/* NEW/HOT badges */}
                                    {option.isNew && (
                                      <TooltipWrapper
                                        tooltip="Newly added model"
                                        tooltipId={`${option.id}-new`}
                                        isSelected={isSelected}
                                        isProModel={option.pro}
                                        isDisabled={isModelDisabled}
                                      >
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                                          isSelected 
                                            ? 'bg-white/20 text-white' 
                                            : 'bg-blue-400/10 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400'
                                        }`}>
                                          New
                                        </span>
                                      </TooltipWrapper>
                                    )}
                                    {option.isHot && (
                                      <TooltipWrapper
                                        tooltip="Popular model"
                                        tooltipId={`${option.id}-hot`}
                                        isSelected={isSelected}
                                        isProModel={option.pro}
                                        isDisabled={isModelDisabled}
                                      >
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                                          isSelected 
                                            ? 'bg-white/20 text-white' 
                                            : 'bg-orange-400/10 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400'
                                        }`}>
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                                          </svg>
                                          Hot
                                        </span>
                                      </TooltipWrapper>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Feature badges with Info icon */}
                                <div className="flex items-start gap-1.5 flex-wrap">
                                  {/* Context Window Badge */}
                                  {option.contextWindow && (
                                    <TooltipWrapper
                                      tooltip={(() => {
                                        if (isSubscribed) {
                                          const contextValue = option.contextWindow >= 1000000 
                                            ? `${(option.contextWindow / 1000000).toFixed(0)}M tokens`
                                            : `${Math.round(option.contextWindow / 1000)}K tokens`;
                                          return (
                                            <div>
                                              <p>Pro {inputTranslations.context}: {contextValue}</p>
                                              <p className="text-xs opacity-80">{inputTranslations.fullAccessWithPro}</p>
                                            </div>
                                          );
                                        } else {
                                          const actualValue = option.contextWindow >= 1000000 
                                            ? `${(option.contextWindow / 1000000).toFixed(0)}M tokens`
                                            : `${Math.round(option.contextWindow / 1000)}K tokens`;
                                          const limitedValue = Math.min(option.contextWindow, CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER);
                                          const limitedFormatted = limitedValue >= 1000000 
                                            ? `${(limitedValue / 1000000).toFixed(0)}M tokens`
                                            : `${Math.round(limitedValue / 1000)}K tokens`;
                                          
                                          if (option.contextWindow <= CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER) {
                                            return `${inputTranslations.context}: ${actualValue}`;
                                          } else {
                                            return (
                                                                                            <div>
                                                  <p>{inputTranslations.context}: {limitedFormatted} {inputTranslations.available}</p>
                                                  <p className="text-xs mb-2">Pro: <span className="font-bold text-[#007AFF]">{actualValue}</span></p>
                                                <a 
                                                  href="/pricing" 
                                                  target="_blank" 
                                                  rel="noopener noreferrer"
                                                  className="group mt-2 w-full inline-flex items-center justify-center gap-2 text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  {/* <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                  </svg> */}
                                                  {inputTranslations.upgrade}
                                                  <svg className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                                  </svg>
                                                </a>
                                              </div>
                                            );
                                          }
                                        }
                                      })()}
                                      tooltipId={`${option.id}-context`}
                                      isSelected={isSelected}
                                      isProModel={option.pro}
                                      isDisabled={isModelDisabled}
                                    >
                                      <div className={`rounded-full pl-1 pr-2 py-0.5 text-xs flex items-center gap-1 cursor-pointer min-h-[20px] ${
                                        isSelected 
                                          ? 'bg-white/15 text-white/80' 
                                          : 'bg-black/5 dark:bg-white/5 text-[var(--muted)]'
                                      }`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                                          <path fillRule="evenodd" d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 003 3h15.75a3 3 0 01-3-3V4.875C18 3.839 17.16 3 16.125 3H4.125zM12 9.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5H12zm-.75-2.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H12a.75.75 0 01-.75-.75zM6 12.75a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5H6zm-.75 3.75a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5H6a.75.75 0 01-.75-.75zM6 6.75a.75.75 0 00-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 00.75-.75v-3A.75.75 0 009 6.75H6z" clipRule="evenodd" />
                                          <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 01-3 0V6.75z" />
                                        </svg>
                                        <span className="text-xs flex items-center gap-1">
                                          {(() => {
                                            if (isSubscribed) {
                                              const contextValue = option.contextWindow >= 1000000 
                                                ? `${(option.contextWindow / 1000000).toFixed(0)}M`
                                                : `${Math.round(option.contextWindow / 1000)}K`;
                                              return (
                                                <>
                                                  {contextValue}
                                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-green-500">
                                                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                                  </svg>
                                                </>
                                              );
                                            } else {
                                              const limitedValue = Math.min(option.contextWindow, CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER);
                                              const limitedFormatted = limitedValue >= 1000000 
                                                ? `${(limitedValue / 1000000).toFixed(0)}M`
                                                : `${Math.round(limitedValue / 1000)}K`;
                                              
                                              if (option.contextWindow <= CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER) {
                                                return limitedFormatted;
                                              } else {
                                                return (
                                                  <>
                                                    {limitedFormatted}
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-[var(--muted)]">
                                                      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3V12.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                                    </svg>
                                                  </>
                                                );
                                              }
                                            }
                                          })()}
                                        </span>
                                      </div>
                                    </TooltipWrapper>
                                  )}
                                  
                                  {/* Vision/Image Support */}
                                  <TooltipWrapper
                                    tooltip={option.supportsVision ? "Supports images" : "Text only"}
                                    tooltipId={`${option.id}-vision`}
                                    isSelected={isSelected}
                                    isProModel={option.pro}
                                    isDisabled={isModelDisabled}
                                  >
                                    <div className={`rounded-full ${option.contextWindow ? 'px-2' : 'pl-1 pr-2'} py-0.5 text-xs flex items-center gap-1 cursor-pointer min-h-[20px] ${
                                      option.supportsVision 
                                        ? (isSelected ? 'bg-white/15 text-white/80' : 'bg-black/5 dark:bg-white/5 text-[var(--muted)]') 
                                        : (isSelected ? 'bg-white/15 text-white/80' : 'bg-black/5 dark:bg-white/5 text-[var(--muted)]')
                                    }`}>
                                      {option.supportsVision ? (
                                        <>
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                                            <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                          </svg>
                                          <span>Image</span>
                                        </>
                                      ) : (
                                        <>
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                                            <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                                            <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                                            <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 016.75 12Z" />
                                          </svg>
                                          <span>Text</span>
                                        </>
                                      )}
                                    </div>
                                  </TooltipWrapper>
                                  
                                  {option.supportsPDFs && (
                                    <TooltipWrapper
                                      tooltip="Supports PDFs"
                                      tooltipId={`${option.id}-pdf`}
                                      isSelected={isSelected}
                                      isProModel={option.pro}
                                      isDisabled={isModelDisabled}
                                    >
                                      <div className={`rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1 cursor-pointer min-h-[20px] ${
                                        isSelected ? 'bg-white/15 text-white/80' : 'bg-black/5 dark:bg-white/5 text-[var(--muted)]'
                                      }`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                                          <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM9.75 14.25a.75.75 0 000 1.5H15a.75.75 0 000-1.5H9.75z" clipRule="evenodd" />
                                          <path d="M14.25 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0016.5 7.5h-1.875a.375.375 0 01-.375-.375V5.25z" />
                                        </svg>
                                        <span>PDF</span>
                                      </div>
                                    </TooltipWrapper>
                                  )}
                                  
                                  {/* Activation status badge */}
                                  {!option.isActivated && (
                                    <TooltipWrapper
                                      tooltip="Temporarily disabled"
                                      tooltipId={`${option.id}-deactivated`}
                                      isSelected={isSelected}
                                      isProModel={option.pro}
                                      isDisabled={isModelDisabled}
                                    >
                                      <div className={`rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1 cursor-pointer min-h-[20px] ${
                                        isSelected ? 'bg-red-400/20 text-red-200' : 'bg-red-500/10 text-red-500'
                                      }`}>
                                        {/* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" clipRule="evenodd" />
                                        </svg> */}
                                        <span>Deactivated</span>
                                      </div>
                                    </TooltipWrapper>
                                  )}
                                  
                                  {/* Info icon for description - only show if description exists */}
                                  {option.description && option.description.trim() && (
                                    <TooltipWrapper
                                      tooltip={option.description}
                                      tooltipId={`${option.id}-info`}
                                      isSelected={isSelected}
                                      isProModel={option.pro}
                                      isDisabled={isModelDisabled}
                                    >
                                      <div className={`rounded-full p-1 transition-all hover:scale-110 cursor-pointer min-h-[20px] min-w-[20px] flex items-center justify-center ${
                                        isSelected 
                                          ? 'bg-white/20 text-white/80 hover:bg-white/30' 
                                          : 'bg-black/5 dark:bg-white/5 text-[var(--muted)] hover:text-[var(--foreground)]'
                                      }`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    </TooltipWrapper>
                                  )}
                                </div>
                                
                                {/* Add subscription required message for Pro models */}
                                {option.pro && !(isSubscribed ?? false) && (
                                  <div>
                                    <p className={`text-xs ${
                                      isSelected ? 'text-white/70' : 'text-[var(--muted)]'
                                    }`}>
                                      Requires Pro subscription
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                  <div className="text-center py-4 text-gray-500">
                    {searchTerm ? `No models found for "${searchTerm}"` : 'No models available'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}