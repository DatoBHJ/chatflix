import { Dispatch, SetStateAction, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getEnabledModels, getActivatedModels, getModelById, isChatflixModel } from '@/lib/models/config';
import Image from 'next/image';
import type { ModelConfig } from '@/lib/models/config';
import { getProviderLogo, hasLogo } from '@/lib/models/logoUtils';
import { checkSubscriptionClient } from '@/lib/subscription-client';
import { getMetricTranslationsForUser, Translations } from '@/app/lib/metricTranslations';
import { getChatInputTranslations } from '@/app/lib/chatInputTranslations';
import { Brain as BrainIOS } from 'react-ios-icons';



interface ModelSelectorProps {
  currentModel: string;
  nextModel: string;
  setNextModel: Dispatch<SetStateAction<string>>;
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
  const [showSortInfo, setShowSortInfo] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  
  // Drag states for mobile header
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentTranslateY, setCurrentTranslateY] = useState(0);
  const [modalHeight, setModalHeight] = useState(0);
  const [maxModalHeight, setMaxModalHeight] = useState(400);
  const modalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  
  // Apple-style animation states
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showElements, setShowElements] = useState({
    modal: false,
    title: false,
    sortControls: false,
    models: false
  });
  
  // Mobile search state
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  
  // Handle mobile search toggle
  const handleMobileSearchToggle = () => {
    if (isMobileSearchOpen) {
      setSearchTerm(''); // Clear search when closing
    }
    setIsMobileSearchOpen(!isMobileSearchOpen);
  };
  
  // Context window limit for non-subscribers - 제거됨 (모든 사용자가 전체 컨텍스트 윈도우 사용 가능)

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

  // Initialize modal height on mount and calculate max height for desktop
  useLayoutEffect(() => {
    if (isMobile && modalRef.current) {
      // Full screen height for mobile - background covers everything
      setModalHeight(window.innerHeight);
    } else if (!isMobile) {
      // Calculate available space for desktop modal
      const viewportHeight = window.innerHeight;
      const triggerElement = containerRef.current;
      if (triggerElement) {
        const rect = triggerElement.getBoundingClientRect();
        const spaceBelow = viewportHeight - rect.bottom - 20; // 20px margin
        const spaceAbove = rect.top - 20; // 20px margin
        
        if (position === 'top') {
          setMaxModalHeight(Math.min(spaceAbove, 600));
        } else {
          setMaxModalHeight(Math.min(spaceBelow, 600));
        }
      }
    }
  }, [isOpen, isMobile, position]);

  // Handle touch events for drag functionality
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
    setCurrentTranslateY(0);
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !isDragging) return;
    e.preventDefault();
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY;
    
    // Only allow downward dragging
    if (diff > 0) {
      setCurrentTranslateY(diff);
    }
  }, [isMobile, isDragging, dragStartY]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !isDragging) return;
    
    setIsDragging(false);
    
    // If dragged down more than 100px, close the modal
    if (currentTranslateY > 100) {
      if (isMobile) {
        // Use closing animation for mobile - elements first, then background
        setIsClosing(true);
        setTimeout(() => setShowElements(prev => ({ ...prev, models: false })), 0);
        setTimeout(() => setShowElements(prev => ({ ...prev, sortControls: false })), 100);
        setTimeout(() => setShowElements(prev => ({ ...prev, title: false })), 200);
        setTimeout(() => setShowElements(prev => ({ ...prev, handle: false })), 300);
        setTimeout(() => setShowElements(prev => ({ ...prev, modal: false })), 500);
        setTimeout(() => {
      setIsOpen(false);
          setIsClosing(false);
        }, 600);
      } else {
        setIsOpen(false);
      }
      setSearchTerm('');
      setKeyboardSelectedIndex(-1);
    } else {
      // Reset position
      setCurrentTranslateY(0);
    }
  }, [isMobile, isDragging, currentTranslateY]);

  // Apple-style closing animation - exact reverse of opening
  const handleClose = useCallback(() => {
    if (isMobile && !isClosing) {
      setIsClosing(true);
      
      // Reverse animation sequence - balanced timing
      // Opening: modal(0) → handle(200) → title(300) → sortControls(400) → models(500)
      // Closing: models(0) → sortControls(100) → title(200) → handle(300) → modal(500)
      const timeouts = [
        setTimeout(() => setShowElements(prev => ({ ...prev, models: false })), 0),
        setTimeout(() => setShowElements(prev => ({ ...prev, sortControls: false })), 100),
        setTimeout(() => setShowElements(prev => ({ ...prev, title: false })), 200),

        setTimeout(() => setShowElements(prev => ({ ...prev, modal: false })), 500),
        setTimeout(() => {
          setIsOpen(false);
          setIsClosing(false);
        }, 600)
      ];
      
      // Store timeouts for cleanup
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    } else {
      // Desktop: immediate close
      setIsOpen(false);
    }
  }, [isMobile, isClosing, setIsOpen]);

  // Reset drag state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsDragging(false);
      setCurrentTranslateY(0);
      setIsAnimating(false);
      setIsClosing(false);
      setShowElements({
        modal: false,

        title: false,
        sortControls: false,
        models: false
      });
    }
  }, [isOpen]);

  // Apple-style staggered animation when opening
  useEffect(() => {
    if (isOpen && isMobile) {
      // Only start animation if not already animating
      if (!isAnimating) {
        setIsAnimating(true);
        
        // Start with all elements hidden
        setShowElements({
          modal: false,
          title: false,
          sortControls: false,
          models: false
        });
        
        // Staggered sequence - background first, then elements
        const timeouts = [
          setTimeout(() => setShowElements(prev => ({ ...prev, modal: true })), 20),
          setTimeout(() => setShowElements(prev => ({ ...prev, title: true })), 250),
          setTimeout(() => setShowElements(prev => ({ ...prev, sortControls: true })), 350),
          setTimeout(() => setShowElements(prev => ({ ...prev, models: true })), 450),
          setTimeout(() => setIsAnimating(false), 550)
        ];
        
        // Cleanup function to clear timeouts
        return () => {
          timeouts.forEach(timeout => clearTimeout(timeout));
        };
      }
    } else if (!isOpen) {
      // Reset immediately when closing
      setIsAnimating(false);
    }
  }, [isOpen, isMobile]); // isAnimating 의존성 제거

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
    ? allModels.filter(model => model.isAgentEnabled === true) 
    : allModels;
    
  // Apply thinking/regular filter, search filter, and sorting
  const MODEL_OPTIONS = (() => {
    // First filter models based on the model type filter
    let filteredByType: ModelConfig[] = [];
    if (modelFilter === 'all') filteredByType = filteredModels;
    if (modelFilter === 'thinking') filteredByType = filteredModels.filter(model => model.name.includes('(Thinking)'));
    if (modelFilter === 'regular') filteredByType = filteredModels.filter(model => !model.name.includes('(Thinking)'));
    
         // Apply search filter - desktop and mobile when search is open
     const filteredBySearch = ((!isMobile || isMobileSearchOpen) && searchTerm.trim()) 
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
  }, [isOpen, keyboardSelectedIndex, MODEL_OPTIONS, disabledModels, allDisabledLevels, isSubscribed, setNextModel, currentModel]);

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
      // Check model filter
      if (modelFilter === 'thinking') {
        if (!MODEL_OPTIONS.some(model => model.id === nextModel && model.name.includes('(Thinking)'))) {
          return false;
        }
      } else if (modelFilter === 'regular') {
        if (!MODEL_OPTIONS.some(model => model.id === nextModel && !model.name.includes('(Thinking)'))) {
          return false;
        }
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
      const targetNode = event.target as Node;
      // If clicking inside the modal, do not treat it as outside
      if (modalRef.current && modalRef.current.contains(targetNode)) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(targetNode)) {
        handleClose();
        setSearchTerm(''); // Clear search when closing
        setKeyboardSelectedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClose]);

  // Handle ESC key to close dropdown
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleClose();
        setSearchTerm(''); // Clear search when closing
        setKeyboardSelectedIndex(-1);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Handle scroll events for gradient overlays - desktop only
  useEffect(() => {
    if (!isOpen || isMobile) return;

    const dropdown = containerRef.current?.querySelector('.model-dropdown');
    if (!dropdown) return;

    const handleScroll = () => {
      const scrollTop = dropdown.scrollTop;
      const scrollHeight = dropdown.scrollHeight;
      const clientHeight = dropdown.clientHeight;
      
      // Show top gradient when scrolled down
      setShowTopGradient(scrollTop > 10);
      
      // Show bottom gradient when not at the bottom
      setShowBottomGradient(scrollTop + clientHeight < scrollHeight - 10);
    };

    dropdown.addEventListener('scroll', handleScroll);
    
    // Initial check
    handleScroll();
    
    return () => dropdown.removeEventListener('scroll', handleScroll);
  }, [isOpen, isMobile]);

  const currentModelOption = MODEL_OPTIONS.find(option => option.id === nextModel) || 
    allModels.find(model => model.id === nextModel);

  // Update nextModel if current model doesn't support web search when web search is enabled
  // or if the model is deactivated
  useEffect(() => {
    const currentModelData = allModels.find(m => m.id === nextModel);
    
    // 🔧 FIX: Agent 모드 강제 변경 로직 제거 - 사용자가 Agent를 끄려고 할 때 모델을 강제로 변경하지 않음
    // if (
    //   (isAgentEnabled && currentModelData?.isAgentEnabled !== true) ||
    //   (currentModelData?.isActivated === false)
    // ) {
    //   // When switching to agent mode, find a non-rate-limited agent-enabled model
    //   const nonRateLimitedAgentModels = allModels.filter(model => 
    //     model.isAgentEnabled === true && 
    //     model.isActivated && 
    //     !disabledLevels.includes(model.rateLimit.level)
    //   );
      
    //   // If we have non-rate-limited agent models, use the first one
    //   if (nonRateLimitedAgentModels.length > 0) {
    //     const newModelId = nonRateLimitedAgentModels[0].id;
    //     setNextModel(newModelId);
    //     // Also update currentModel if the prop is provided
    //     if (setCurrentModel) {
    //       setCurrentModel(newModelId);
    //     }
    //   } else {
    //     // If all agent models are rate-limited, find any non-rate-limited model
    //     const anyNonRateLimitedModel = allModels.find(model => 
    //       model.isActivated && !disabledLevels.includes(model.rateLimit.level)
    //     );
        
    //     if (anyNonRateLimitedModel) {
    //       const newModelId = anyNonRateLimitedModel.id;
    //       setNextModel(newModelId);
    //       // Also update currentModel if the prop is provided
    //       if (setCurrentModel) {
    //         setCurrentModel(newModelId);
    //       }
    //     }
    //   }
    // }
    
    // 🔧 FIX: 모델이 비활성화된 경우에만 대체 모델 찾기
    if (currentModelData?.isActivated === false) {
      const anyNonRateLimitedModel = allModels.find(model => 
        model.isActivated && !disabledLevels.includes(model.rateLimit.level)
      );
      
      if (anyNonRateLimitedModel) {
        const newModelId = anyNonRateLimitedModel.id;
        setNextModel(newModelId);
        
      }
    }
  }, [isAgentEnabled, nextModel, allModels, setNextModel, disabledLevels]);

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
    isDisabled = false,
    isFirstModel = false
  }: { 
    children: React.ReactNode; 
    tooltip: string | React.ReactNode; 
    tooltipId: string;
    isSelected: boolean;
    isProModel?: boolean;
    isDisabled?: boolean;
    isFirstModel?: boolean;
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
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        // 즉시 숨김
        setHoveredTooltip(null);
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
        // 즉시 숨김
        setHoveredTooltip(null);
      }
    };

    // 추가 안전장치: 포커스 아웃 시에도 툴팁 숨김
    const handleBlur = () => {
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
        onBlur={handleBlur}
        onPointerLeave={handleMouseLeave}
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
            className={`absolute z-50 ${isFirstModel ? 'top-full mt-2' : 'bottom-full mb-2'} left-0 w-56 bg-white dark:bg-black border border-black/10 dark:border-white/20 rounded-2xl p-4 shadow-2xl shadow-black/20 dark:shadow-black/60 animate-in fade-in duration-200 ${isFirstModel ? 'slide-in-from-top-2' : 'slide-in-from-bottom-2'} opacity-100`}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
            onPointerLeave={handleTooltipMouseLeave}
            style={{
              transform: isFirstModel ? 'translateY(2px)' : 'translateY(-2px)'
            }}
          >
            <div className="relative">
              <div className="text-sm text-gray-900 dark:text-white font-medium leading-relaxed">
                {tooltip}
              </div>
              {/* Apple-style arrow pointing up or down - removed */}
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
            className={`flex items-center gap-2 cursor-text px-2 pl-3 h-8 ${disabled ? 'cursor-not-allowed' : ''}`}
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
                <div className="flex items-center gap-2 backdrop-blur-md bg-[#007AFF]/5 dark:bg-[#007AFF]/10 px-2 py-1 rounded-full h-6">
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
               // Show search input when open - desktop only
               !isMobile ? (
              <>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search models..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] min-w-[200px] h-6"
                  disabled={disabled}
                />
                {/* Search icon - only show when active */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[var(--muted)] flex-shrink-0">
                  <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
                </svg>
              </>
                                ) : (
                  // Mobile: Show current model name with same styling as closed state
                  <div className="flex items-center gap-2 backdrop-blur-md bg-[#007AFF]/5 dark:bg-[#007AFF]/10 px-2 py-1 rounded-full h-6">
                    <span className="text-[#007AFF]/100 dark:text-[#007AFF] text-sm font-medium">
                      {currentModelOption?.name || nextModel}
                    </span>
                  </div>
                )
            )}
          </div>
        
          {isOpen && !disabled && (
            isMobile ? (
              // Mobile: Use Portal to render at document.body level
                            createPortal(
                <>
                  {/* Backdrop with blur effect */}
                  <div 
                    className={`fixed inset-0 bg-black/10 dark:bg-black/30 backdrop-blur-sm transition-all duration-500 ease-out z-[9999997] ${
                      showElements.modal ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    onClick={handleClose}
                  />
                  
              <div 
                ref={modalRef}
                    className="fixed inset-x-0 bottom-0 w-full bg-background flex flex-col overflow-hidden rounded-t-3xl z-[9999999]"
                style={{
                      transform: showElements.modal ? `translateY(${currentTranslateY}px)` : 'translateY(calc(100vh - 60px))',
                      transition: isDragging ? 'none' : showElements.modal ? 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease-out' : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
                      height: 'calc(100vh - 20px)',
                      backgroundColor: 'var(--background)',
                      backdropFilter: 'blur(0px)',
                      willChange: 'transform, opacity',
                      opacity: showElements.modal ? 1 : 0
                }}
                role="listbox"
              >

              
              {/* Mobile mode header */}
              {isMobile && (
                <>

                  <div 
                    ref={headerRef}
                     className={`relative flex items-center justify-between py-6 px-6 border-b border-[var(--accent)] shrink-0 transition-all duration-250 ease-out ${
                       showElements.title ? 'translate-y-0 opacity-100' : (isClosing ? 'translate-y-6 opacity-0' : 'translate-y-6 opacity-0')
                     }`}
                     style={{ willChange: 'transform, opacity' }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                   >
                    <div className="w-8"></div> {/* Spacer for centering */}
                    <h2 className="text-xl font-semibold">Models</h2>
                    <button
                      onClick={handleClose}
                      className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center transition-all duration-200 hover:bg-black/10 dark:hover:bg-white/20 active:scale-95"
                      aria-label="Close"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-gray-600 dark:text-gray-400"
                      >
                        <path
                          d="M1 1L13 13M1 13L13 1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </>
              )}
              
              {/* Sort Controls */}
              <div className={`sticky top-0 z-10 border-b border-black/5 dark:border-white/5 px-4 py-3 ${isMobile ? 'shrink-0' : '-mx-2 md:-mx-3'} ${
                isMobile ? `transition-all duration-300 ease-out ${
                  showElements.sortControls ? 'translate-y-0 opacity-100' : (isClosing ? 'translate-y-8 opacity-0' : 'translate-y-8 opacity-0')
                }` : ''
              }`}
              style={isMobile ? { willChange: 'transform, opacity' } : {}}>
                {/* Theme-aware gradient overlay for smooth scrolling - desktop only */}
                {!isMobile && showTopGradient && (
                  <div className="absolute inset-x-0 top-0 h-24 theme-gradient-top pointer-events-none transition-opacity duration-200"></div>
                )}
                                                <div className="flex items-center justify-between relative">
                  {/* Mobile Search UI */}
                  <div className={`absolute inset-0 flex items-center transition-all duration-100 ease-out ${
                    isMobile && isMobileSearchOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-0 scale-100 pointer-events-none'
                  }`}>
                    <div className="flex items-center w-full gap-2">
                      <div className="flex items-center bg-[var(--accent)]/10 dark:bg-[var(--accent)]/5 rounded-full px-3 py-2 flex-1 border border-[var(--accent)]/20">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-[var(--muted)] mr-2">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search models..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="bg-transparent text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none flex-1"
                          autoFocus={isMobileSearchOpen}
                        />
                      </div>
                      <button
                        onClick={handleMobileSearchToggle}
                        className="transition-all duration-300 cursor-pointer flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] active:scale-95"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Sort Controls */}
                  <div className={`flex items-center justify-between w-full transition-all duration-100 ease-out ${
                    isMobile && isMobileSearchOpen ? 'opacity-0 translate-y-0 scale-100 pointer-events-none' : 'opacity-100 translate-y-0 scale-100'
                  }`}>
                    <div className={`flex items-center gap-1 sm:gap-3 ${isMobile ? 'flex-nowrap overflow-x-auto scrollbar-hide' : 'flex-wrap'}`}>
                      {/* Mobile Search Icon */}
                      {isMobile && (
                        <button
                          onClick={handleMobileSearchToggle}
                          className="rounded-full p-1 transition-all duration-300 cursor-pointer min-h-[20px] min-w-[20px] flex items-center justify-center bg-black/5 dark:bg-white/5 text-[var(--muted)] active:scale-95 flex-shrink-0 hover:bg-black/10 dark:hover:bg-white/10"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </button>
                      )}
                      
                      {/* Sort Icon - hidden on mobile */}
                      {!isMobile && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[var(--muted)] flex-shrink-0">
                          <path d="M3 7h18v2H3V7zm0 4h12v2H3v-2zm0 4h6v2H3v-2z" />
                        </svg>
                      )}
                      
                      <button 
                        onClick={() => setSortCriteria('default')}
                        className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium whitespace-nowrap ${
                          sortCriteria === 'default' 
                            ? 'bg-[#007AFF] text-white' 
                            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        {translations.names.default}
                      </button>
                      
                      <button 
                        onClick={() => setSortCriteria('latency')}
                        className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium whitespace-nowrap ${
                          sortCriteria === 'latency' 
                            ? 'bg-[#007AFF] text-white' 
                            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        {translations.names.latency}
                      </button>
                      
                      <button 
                        onClick={() => setSortCriteria('tps')}
                        className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium whitespace-nowrap ${
                          sortCriteria === 'tps' 
                            ? 'bg-[#007AFF] text-white' 
                            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        {translations.names.tps}
                      </button>
                      
                      <button 
                        onClick={() => setSortCriteria('intelligenceIndex')}
                        className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium whitespace-nowrap ${
                          sortCriteria === 'intelligenceIndex' 
                            ? 'bg-[#007AFF] text-white' 
                            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        {translations.names.intelligenceIndex}
                      </button>
                      
                      <button 
                        onClick={() => setSortCriteria('contextWindow')}
                        className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium whitespace-nowrap ${
                          sortCriteria === 'contextWindow' 
                            ? 'bg-[#007AFF] text-white' 
                            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        {translations.names.contextWindow}
                      </button>
                    </div>
                    
                    {/* Info Icon - hidden on mobile */}
                    {!isMobile && (
                      <div className="relative">
                        <button
                          onMouseEnter={() => setShowSortInfo(true)}
                          onMouseLeave={() => setShowSortInfo(false)}
                          className="rounded-full p-1 transition-all cursor-pointer min-h-[20px] min-w-[20px] flex items-center justify-center bg-black/5 dark:bg-white/5 text-[var(--muted)] hover:scale-110 hover:text-[var(--foreground)]"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {/* Sort Info Tooltip */}
                        {showSortInfo && (
                          <div className="absolute z-[99999999] bg-white dark:bg-black border border-black/10 dark:border-white/20 rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/40 animate-in fade-in duration-150 top-full mt-2 right-0 w-72 p-3 slide-in-from-top-1"
                            style={{
                              transform: 'translateY(2px)'
                            }}
                            onMouseEnter={() => setShowSortInfo(true)}
                            onMouseLeave={() => setShowSortInfo(false)}
                          >
                            <div className="relative">
                              <div className="space-y-2.5 text-xs">
                                <div className="flex items-start gap-2">
                                  <span className="font-semibold text-gray-900 dark:text-white min-w-[60px]">{translations.names.latency}</span>
                                  <span className="text-gray-600 dark:text-gray-400 leading-relaxed">{translations.tooltips.latency}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="font-semibold text-gray-900 dark:text-white min-w-[60px]">{translations.names.tps}</span>
                                  <span className="text-gray-600 dark:text-gray-400 leading-relaxed">{translations.tooltips.tps}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="font-semibold text-gray-900 dark:text-white min-w-[60px]">{translations.names.intelligenceIndex}</span>
                                  <span className="text-gray-600 dark:text-gray-400 leading-relaxed">{translations.tooltips.intelligenceIndex}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="font-semibold text-gray-900 dark:text-white min-w-[60px]">{translations.names.contextWindow}</span>
                                  <span className="text-gray-600 dark:text-gray-400 leading-relaxed">{translations.tooltips.contextWindow}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            
              
              {/* Model options list */}
              <div 
                className={`py-2 relative ${isMobile ? 'flex-1 min-h-0 overflow-y-auto px-4' : 'overflow-y-auto'} ${
                  isMobile ? `transition-all duration-350 ease-out ${
                    showElements.models ? 'translate-y-0 opacity-100' : (isClosing ? 'translate-y-10 opacity-0' : 'translate-y-10 opacity-0')
                  }` : ''
                }`}
                style={{ 
                  touchAction: isDragging ? 'none' : 'pan-y',
                  pointerEvents: isDragging ? 'none' : 'auto',
                  maxHeight: isMobile ? undefined : `${Math.max(0, maxModalHeight - 180)}px`, // 180px for header and padding
                  willChange: isMobile ? 'transform, opacity' : 'auto'
                }}
              >
                {/* Bottom gradient overlay for smooth scrolling - desktop only */}
                {!isMobile && showBottomGradient && (
                  <div className="absolute inset-x-0 bottom-0 h-24 theme-gradient-bottom pointer-events-none transition-opacity duration-200"></div>
                )}
                  {MODEL_OPTIONS.length > 0 ? (
                    MODEL_OPTIONS.map((option, index) => {
                      // Check if this model is disabled
                      const isModelDisabled = disabledModels.includes(option.id) || 
                                           (allDisabledLevels.length > 0 && allDisabledLevels.includes(option.rateLimit.level)) ||
                                           !option.isActivated ||
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
                        <div key={option.id} className={`border-b border-black/5 dark:border-white/5 last:border-b-0 ${
                          isMobile ? `transition-all duration-500 ease-out ${
                            showElements.models ? 'translate-y-0 opacity-100' : (isClosing ? 'translate-y-6 opacity-0' : 'translate-y-6 opacity-0')
                          }` : ''
                        }`}
                        style={isMobile ? { 
                          transitionDelay: showElements.models ? `${Math.min(index * 50, 300)}ms` : '0ms',
                          willChange: 'transform, opacity'
                        } : {}}>
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
                                handleClose();
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
                            
                            <div className="flex items-center gap-3 w-full pr-0 sm:pr-20">
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
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isSelected 
                                          ? 'bg-white/20 text-white' 
                                          : 'bg-green-400/10 text-green-500 dark:bg-green-500/10 dark:text-green-400'
                                      }`}>
                                        Pro
                                      </span>
                                    )}
                                    
                                    {/* NEW/HOT badges */}
                                    {option.isNew && (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isSelected 
                                          ? 'bg-white/20 text-white' 
                                          : 'bg-blue-400/10 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400'
                                      }`}>
                                        New
                                      </span>
                                    )}
                                    {option.isHot && (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isSelected 
                                          ? 'bg-white/20 text-white' 
                                          : 'bg-orange-400/10 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400'
                                      }`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                                        </svg>
                                        Hot
                                      </span>
                                    )}
                                    
                                    {/* UPDATE badges */}
                                    {option.isUpdated && (
                                      <TooltipWrapper
                                        tooltip={option.updateDescription || "Recently updated with new features and improvements"}
                                        tooltipId={`${option.id}-updated`}
                                        isSelected={isSelected}
                                        isProModel={option.pro}
                                        isDisabled={isModelDisabled}
                                        isFirstModel={index === 0}
                                      >
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                                          isSelected 
                                            ? 'bg-white/20 text-white' 
                                            : 'bg-green-400/10 text-green-500 dark:bg-green-500/10 dark:text-green-400'
                                        }`}>
                                          Updated
                                        </span>
                                      </TooltipWrapper>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Feature badges with Info icon */}
                                <div className="flex items-start gap-1.5 flex-wrap">
                                  {/* Info icon for description - only show if description exists - moved to leftmost position */}
                                  {option.description && option.description.trim() && (
                                    <TooltipWrapper
                                      tooltip={option.description}
                                      tooltipId={`${option.id}-info`}
                                      isSelected={isSelected}
                                      isProModel={option.pro}
                                      isDisabled={isModelDisabled}
                                      isFirstModel={index === 0}
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
                                  
                                  {/* Agent Mode Support */}
                                  {/* {option.isAgentEnabled && (
                                    <div className={`rounded-full px-2 py-0.5 text-xs flex items-center gap-1 min-h-[20px] ${
                                      isSelected ? 'bg-white/15 text-white/80' : 'bg-black/5 dark:bg-white/5 text-[var(--muted)]'
                                    }`}>
                                      <BrainIOS className="w-3 h-3 flex-shrink-0" />
                                      <span>Agent</span>
                                    </div>
                                  )} */}
                                  
                                  {/* Context Window Badge - 제거됨 (정렬에서 표시하므로 불필요) */}
                                  
                                  {/* Vision/Image Support */}
                                  <div className={`rounded-full px-2 py-0.5 text-xs flex items-center gap-1 min-h-[20px] ${
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
                                  
                                  {option.supportsPDFs && (
                                    <div className={`rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1 min-h-[20px] ${
                                      isSelected ? 'bg-white/15 text-white/80' : 'bg-black/5 dark:bg-white/5 text-[var(--muted)]'
                                    }`}>
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                                        <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM9.75 14.25a.75.75 0 000 1.5H15a.75.75 0 000-1.5H9.75z" clipRule="evenodd" />
                                        <path d="M14.25 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0016.5 7.5h-1.875a.375.375 0 01-.375-.375V5.25z" />
                                      </svg>
                                      <span>PDF</span>
                                    </div>
                                  )}
                                  
                                  {/* Activation status badge */}
                                  {!option.isActivated && (
                                    <div className={`rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1 min-h-[20px] ${
                                      isSelected ? 'bg-red-400/20 text-red-200' : 'bg-red-500/10 text-red-500'
                                    }`}>
                                      {/* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                                        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" clipRule="evenodd" />
                                      </svg> */}
                                      <span>Deactivated</span>
                                    </div>
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
                  </>
                , document.body
              )
            ) : (
              // Desktop: Normal rendering
              <>
                <div 
                  ref={modalRef}
                  className={`absolute left-1 ${position === 'top' ? 'bottom-full mb-6 w-[592px] shadow-[0_12px_48px_-12px_rgba(0,0,0,0.25)]' : 'top-full mt-2 w-[600px] shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.25)]'} px-2 md:px-3 left-0 model-selector-scroll rounded-2xl z-50`}
                  style={{
                    maxHeight: `${maxModalHeight}px`,
                    backgroundColor: 'var(--background)'
                  }}
                  role="listbox"
                >

              
              {/* Sort Controls */}
              <div className={`sticky top-0 z-10 border-b border-black/5 dark:border-white/5 px-4 py-3 -mx-2 md:-mx-3`}>
                {/* Theme-aware gradient overlay for smooth scrolling - desktop only */}
                {!isMobile && showTopGradient && (
                  <div className="absolute inset-x-0 top-0 h-24 theme-gradient-top pointer-events-none transition-opacity duration-200"></div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 sm:gap-3 flex-wrap">
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
                    
                    <button 
                      onClick={() => setSortCriteria('latency')}
                      className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        sortCriteria === 'latency' 
                          ? 'bg-[#007AFF] text-white' 
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {translations.names.latency}
                    </button>
                    
                    <button 
                      onClick={() => setSortCriteria('tps')}
                      className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        sortCriteria === 'tps' 
                          ? 'bg-[#007AFF] text-white' 
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {translations.names.tps}
                    </button>
                    
                    <button 
                      onClick={() => setSortCriteria('intelligenceIndex')}
                      className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        sortCriteria === 'intelligenceIndex' 
                          ? 'bg-[#007AFF] text-white' 
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {translations.names.intelligenceIndex}
                    </button>
                    
                    <button 
                      onClick={() => setSortCriteria('contextWindow')}
                      className={`text-xs px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        sortCriteria === 'contextWindow' 
                          ? 'bg-[#007AFF] text-white' 
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {translations.names.contextWindow}
                    </button>
                  </div>
                  
                  {/* Info Icon */}
                  <div className={`${isMobile ? '' : 'relative'}`}>
                    <button
                      onMouseEnter={() => !isMobile && setShowSortInfo(true)}
                      onMouseLeave={() => !isMobile && setShowSortInfo(false)}
                      onClick={() => isMobile && setShowSortInfo(!showSortInfo)}
                      className={`rounded-full p-1 transition-all cursor-pointer min-h-[20px] min-w-[20px] flex items-center justify-center bg-black/5 dark:bg-white/5 text-[var(--muted)] ${
                        !isMobile ? 'hover:scale-110 hover:text-[var(--foreground)]' : 'active:scale-95'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {/* Sort Info Tooltip */}
                    {showSortInfo && (
                      <div className={`absolute z-50 bg-white dark:bg-black border border-black/10 dark:border-white/20 rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/40 animate-in fade-in duration-150 ${
                        isMobile 
                          ? 'top-full mt-1 left-0 right-auto w-[calc(100%-16px)] ml-2 p-4 slide-in-from-top-1' 
                          : 'top-full mt-2 right-0 w-72 p-3 slide-in-from-top-1'
                      }`}
                        style={{
                          transform: isMobile ? 'translateY(1px)' : 'translateY(2px)'
                        }}
                        onMouseEnter={() => !isMobile && setShowSortInfo(true)}
                        onMouseLeave={() => !isMobile && setShowSortInfo(false)}
                      >
                        <div className="relative">
                          <div className={`space-y-2.5 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                            <div className={`flex ${isMobile ? 'flex-col gap-1' : 'items-start gap-2'}`}>
                              <span className={`font-semibold text-gray-900 dark:text-white ${isMobile ? 'text-base' : 'min-w-[60px]'}`}>{translations.names.latency}</span>
                              <span className="text-gray-600 dark:text-gray-400 leading-relaxed">{translations.tooltips.latency}</span>
                            </div>
                            <div className={`flex ${isMobile ? 'flex-col gap-1' : 'items-start gap-2'}`}>
                              <span className={`font-semibold text-gray-900 dark:text-white ${isMobile ? 'text-base' : 'min-w-[60px]'}`}>{translations.names.tps}</span>
                              <span className="text-gray-600 dark:text-gray-400 leading-relaxed">{translations.tooltips.tps}</span>
                            </div>
                            <div className={`flex ${isMobile ? 'flex-col gap-1' : 'items-start gap-2'}`}>
                              <span className={`font-semibold text-gray-900 dark:text-white ${isMobile ? 'text-base' : 'min-w-[60px]'}`}>{translations.names.intelligenceIndex}</span>
                              <span className="text-gray-600 dark:text-gray-400 leading-relaxed">{translations.tooltips.intelligenceIndex}</span>
                            </div>
                            <div className={`flex ${isMobile ? 'flex-col gap-1' : 'items-start gap-2'}`}>
                              <span className={`font-semibold text-gray-900 dark:text-white ${isMobile ? 'text-base' : 'min-w-[60px]'}`}>{translations.names.contextWindow}</span>
                              <span className="text-gray-600 dark:text-gray-400 leading-relaxed">{translations.tooltips.contextWindow}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                                </div>
              </div>

            
              
              {/* Model options list */}
              <div 
                className={`py-2 relative ${isMobile ? 'flex-1 min-h-0 overflow-y-auto px-4' : 'overflow-y-auto'}`}
                style={{ 
                  touchAction: isDragging ? 'none' : 'pan-y',
                  pointerEvents: isDragging ? 'none' : 'auto',
                  maxHeight: isMobile ? undefined : `${Math.max(0, maxModalHeight - 180)}px` // 180px for header and padding
                }}
              >
                {/* Bottom gradient overlay for smooth scrolling - desktop only */}
                {!isMobile && showBottomGradient && (
                  <div className="absolute inset-x-0 bottom-0 h-24 theme-gradient-bottom pointer-events-none transition-opacity duration-200"></div>
                )}
                  {MODEL_OPTIONS.length > 0 ? (
                    MODEL_OPTIONS.map((option, index) => {
                      // Check if this model is disabled
                      const isModelDisabled = disabledModels.includes(option.id) || 
                                           (allDisabledLevels.length > 0 && allDisabledLevels.includes(option.rateLimit.level)) ||
                                           !option.isActivated ||
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
                        <div key={option.id} className={`border-b border-black/5 dark:border-white/5 last:border-b-0 ${
                          isMobile ? `transition-all duration-500 ease-out ${
                            showElements.models ? 'translate-y-0 opacity-100' : (isClosing ? 'translate-y-6 opacity-0' : 'translate-y-6 opacity-0')
                          }` : ''
                        }`}
                        style={isMobile ? { 
                          transitionDelay: showElements.models ? `${Math.min(index * 50, 300)}ms` : '0ms',
                          willChange: 'transform, opacity'
                        } : {}}>
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
                                handleClose();
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
                            
                            <div className="flex items-center gap-3 w-full pr-0 sm:pr-20">
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
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isSelected 
                                          ? 'bg-white/20 text-white' 
                                          : 'bg-green-400/10 text-green-500 dark:bg-green-500/10 dark:text-green-400'
                                      }`}>
                                        Pro
                                      </span>
                                    )}
                                    
                                    {/* NEW/HOT badges */}
                                    {option.isNew && (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isSelected 
                                          ? 'bg-white/20 text-white' 
                                          : 'bg-blue-400/10 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400'
                                      }`}>
                                        New
                                      </span>
                                    )}
                                    {option.isHot && (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isSelected 
                                          ? 'bg-white/20 text-white' 
                                          : 'bg-orange-400/10 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400'
                                      }`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                                        </svg>
                                        Hot
                                      </span>
                                    )}
                                    
                                    {/* UPDATE badges */}
                                    {option.isUpdated && (
                                      <TooltipWrapper
                                        tooltip={option.updateDescription || "Recently updated with new features and improvements"}
                                        tooltipId={`${option.id}-updated`}
                                        isSelected={isSelected}
                                        isProModel={option.pro}
                                        isDisabled={isModelDisabled}
                                        isFirstModel={index === 0}
                                      >
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                                          isSelected 
                                            ? 'bg-white/20 text-white' 
                                            : 'bg-green-400/10 text-green-500 dark:bg-green-500/10 dark:text-green-400'
                                        }`}>
                                          Updated
                                        </span>
                                      </TooltipWrapper>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Feature badges with Info icon */}
                                <div className="flex items-start gap-1.5 flex-wrap">
                                  {/* Info icon for description - only show if description exists - moved to leftmost position */}
                                  {option.description && option.description.trim() && (
                                    <TooltipWrapper
                                      tooltip={option.description}
                                      tooltipId={`${option.id}-info`}
                                      isSelected={isSelected}
                                      isProModel={option.pro}
                                      isDisabled={isModelDisabled}
                                      isFirstModel={index === 0}
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
                                  
                                  {/* Vision/Image Support */}
                                  <div className={`rounded-full px-2 py-0.5 text-xs flex items-center gap-1 min-h-[20px] ${
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
                                  
                                  {option.supportsPDFs && (
                                    <div className={`rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1 min-h-[20px] ${
                                      isSelected ? 'bg-white/15 text-white/80' : 'bg-black/5 dark:bg-white/5 text-[var(--muted)]'
                                    }`}>
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                                        <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM9.75 14.25a.75.75 0 000 1.5H15a.75.75 0 000-1.5H9.75z" clipRule="evenodd" />
                                        <path d="M14.25 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0016.5 7.5h-1.875a.375.375 0 01-.375-.375V5.25z" />
                                      </svg>
                                      <span>PDF</span>
                                    </div>
                                  )}
                                  
                                  {/* Activation status badge */}
                                  {!option.isActivated && (
                                    <div className={`rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1 min-h-[20px] ${
                                      isSelected ? 'bg-red-400/20 text-red-200' : 'bg-red-500/10 text-red-500'
                                    }`}>
                                      <span>Deactivated</span>
                                    </div>
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
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}