import React, { Dispatch, SetStateAction, useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from 'react-tooltip';
import { getEnabledModels, getModelVariantId, isChatflixModel } from '@/lib/models/config';
import Image from 'next/image';
import type { ModelConfig } from '@/lib/models/config';
import { getProviderLogo, hasLogo, getChatflixLogo } from '@/lib/models/logoUtils';
import { getIconClassName, getTextStyle as getTextStyleUtil, getInitialTheme, getAdaptiveGlassStyleBlur, getAdaptiveGlassBackgroundColor } from '@/app/lib/adaptiveGlassStyle';
import { 
  Search, 
  ChevronRight, 
  Check, 
  X, 
  Globe, 
  Star,
  Zap, 
  Brain, 
  Cpu,
  ShieldCheck,
  Smartphone,
  ArrowUpDown,
  Activity,
  Gauge,
  Lightbulb,
  Box,
  Eye,
  ChevronLeft,
  SlidersHorizontal
} from 'lucide-react';
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
  user?: any;
  selectedTool?: string | null;
  hasBackgroundImage?: boolean;
}

type FilterGroup = 'all' | 'chatflix' | 'openai' | 'anthropic' | 'google' | 'deepseek' | 'xai' | 'moonshot' | 'vision' | 'reasoning' | 'fast';
type SortMetric = 'default' | 'tps' | 'latency' | 'intelligenceIndex' | 'contextWindow';

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
  user,
  selectedTool,
  hasBackgroundImage = false
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(getInitialTheme());
  const [isMobile, setIsMobile] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterGroup>('all');
  const [sortCriteria, setSortCriteria] = useState<SortMetric>('default');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showSortOptions, setShowSortOptions] = useState(false);
  
  // Mobile specific states (matching BackgroundSettingsModal)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentTranslateY, setCurrentTranslateY] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showElements, setShowElements] = useState({ modal: false, title: false, content: false });
  const [view, setView] = useState<'sidebar' | 'list'>('list');
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);

  useEffect(() => {
    setView('list');
  }, [isMobile]);

  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 || 'ontouchstart' in window;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDark(theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches));
    };
    checkTheme();
    
    const themeObserver = new MutationObserver(checkTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      themeObserver.disconnect();
    };
  }, []);

  // Animation logic for mobile (matching BackgroundSettingsModal)
  useEffect(() => {
    if (!isOpen) {
      setIsDragging(false);
      setCurrentTranslateY(0);
      setIsAnimating(false);
      setIsClosing(false);
      setShowElements({ modal: false, title: false, content: false });
      // Reset to default view when closed
      if (isMobile) {
        setView('list');
        setActiveFilter('all');
        setShowSortOptions(false);
      }
      return;
    }

    if (isMobile) {
      if (isAnimating) return;
      setIsAnimating(true);
      setShowElements({ modal: false, title: false, content: false });
      const t = [
        setTimeout(() => setShowElements(prev => ({ ...prev, modal: true })), 20),
        setTimeout(() => setShowElements(prev => ({ ...prev, title: true })), 250),
        setTimeout(() => setShowElements(prev => ({ ...prev, content: true })), 350),
        setTimeout(() => setIsAnimating(false), 550)
      ];
      return () => t.forEach(clearTimeout);
    }
  }, [isOpen, isMobile]);

  const handleClose = useCallback(() => {
    if (isMobile) {
      setIsClosing(true);
      setTimeout(() => setShowElements(prev => ({ ...prev, content: false })), 0);
      setTimeout(() => setShowElements(prev => ({ ...prev, title: false })), 100);
      setTimeout(() => setShowElements(prev => ({ ...prev, modal: false })), 400);
      setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
      }, 500);
    } else {
      setIsOpen(false);
    }
  }, [isMobile]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
    setCurrentTranslateY(0);
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY;
    if (diff > 0) setCurrentTranslateY(diff);
  }, [isMobile, isDragging, dragStartY]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !isDragging) return;
    setIsDragging(false);
    if (currentTranslateY > 100) {
      handleClose();
    } else {
      setCurrentTranslateY(0);
    }
  }, [isMobile, isDragging, currentTranslateY, handleClose]);

  // 모바일에서 Chatflix 툴팁이 열려있을 때 외부 클릭 시 닫기 (도구 선택창과 동일)
  useEffect(() => {
    if (!isOpen || !isMobile || !openTooltipId) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-tooltip-id="model-selector-tooltip"]') && !target.closest('[data-tooltip-is-open]')) {
        setOpenTooltipId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, isMobile, openTooltipId]);

  const allModels = useMemo(() => getEnabledModels(), []);

  const filteredAndSortedModels = useMemo(() => {
    let filtered = allModels.filter(model => {
      const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          model.provider.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      switch (activeFilter) {
        case 'chatflix': return isChatflixModel(model.id);
        case 'openai': return (model.creator === 'openai' || model.provider === 'openai') && !isChatflixModel(model.id);
        case 'anthropic': return (model.creator === 'anthropic' || model.provider === 'anthropic') && !isChatflixModel(model.id);
        case 'google': return (model.creator === 'google' || model.provider === 'google') && !isChatflixModel(model.id);
        case 'deepseek': return (model.creator === 'deepseek' || model.provider === 'deepseek') && !isChatflixModel(model.id);
        case 'xai': return (model.creator === 'xai' || model.provider === 'xai') && !isChatflixModel(model.id);
        case 'moonshot': return (model.creator === 'moonshot' || (model.provider as string) === 'moonshot') && !isChatflixModel(model.id);
        case 'vision': return model.supportsVision === true;
        case 'reasoning': return model.reasoning === true;
        case 'fast': return isChatflixModel(model.id) || (model.tps || 0) >= 200 || (model.latency != null && model.latency <= 0.5);
        default: return true;
      }
    });

    return [...filtered].sort((a, b) => {
      // Chatflix models always at the top, regardless of sort criteria
      const aChatflix = isChatflixModel(a.id);
      const bChatflix = isChatflixModel(b.id);
      
      if (aChatflix && !bChatflix) return -1;
      if (!aChatflix && bChatflix) return 1;
      
      // If both are Chatflix, or both are regular models, apply selected sort criteria
      if (sortCriteria === 'default') {
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
        return a.name.localeCompare(b.name);
      }

      const aValue = a[sortCriteria] as number;
      const bValue = b[sortCriteria] as number;
      
      if (typeof aValue !== 'number' && typeof bValue !== 'number') return 0;
      if (typeof aValue !== 'number') return 1;
      if (typeof bValue !== 'number') return -1;
      
      const comparison = sortCriteria === 'latency' ? aValue - bValue : bValue - aValue;
      return sortOrder === 'desc' ? comparison : -comparison;
    });
  }, [allModels, activeFilter, searchTerm, sortCriteria, sortOrder]);

  const currentModelData = useMemo(() => 
    allModels.find(m => getModelVariantId(m) === nextModel) || allModels[0]
  , [allModels, nextModel]);

  const handleSelect = (modelId: string) => {
    setNextModel(modelId);
    handleClose();
  };

  const handleFilterClick = (filterId: FilterGroup) => {
    setActiveFilter(filterId);
    if (isMobile) {
      setView('list');
    }
  };

  const renderModelItem = (model: ModelConfig, isLast: boolean = false) => {
    const variantId = getModelVariantId(model);
    const isSelected = nextModel === variantId;
    const modelKey = `${variantId}-${sortCriteria}-${sortOrder}`;
    
    // Calculate max and min values for the current metric to scale the visual bars
    const metricValues = sortCriteria !== 'default' ? 
      allModels
        .filter(m => typeof m[sortCriteria] === 'number')
        .map(m => m[sortCriteria] as number)
      : [];
    
    const maxValue = metricValues.length > 0 ? Math.max(...metricValues) : 0;
    const minValue = metricValues.length > 0 ? Math.min(...metricValues) : 0;

    const renderStatBar = (value: number, colorClass: string) => {
      const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
      const totalBoxes = 5;
      const filledBoxes = Math.round((percentage / 100) * totalBoxes);

  return (
        <div className="flex items-center">
          <div className="flex gap-0.5 items-center w-[55px] justify-start">
            {[...Array(totalBoxes)].map((_, i) => (
              <div 
                key={i}
                className={`w-2 h-3.5 rounded-[1.5px] transition-all duration-500 ${
                  i < filledBoxes 
                    ? colorClass 
                    : 'bg-black/5 dark:bg-white/5'
                }`}
                  style={{
                  opacity: i < filledBoxes ? 0.4 + (i * 0.15) : 1
                }}
              />
            ))}
                        </div>
          <span className={`w-10 text-right text-[11px] font-bold opacity-40 ${isSelected ? 'text-white' : 'text-black dark:text-white'}`}>
            {sortCriteria === 'contextWindow' 
              ? `${Math.round(value / 1000)}k` 
              : sortCriteria === 'latency' 
                ? `${value.toFixed(1)}s` 
                : Math.round(value)}
                          </span>
                  </div>
    );
  };

  return (
      <button
        key={modelKey}
        onClick={() => handleSelect(variantId)}
        className={`w-full flex items-center gap-4 px-3 rounded-2xl transition-all duration-200 group text-left ${
          isSelected 
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
            : 'hover:bg-black/5 dark:hover:bg-white/5'
        }`}
      >
        <div className="py-3 shrink-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center overflow-visible shrink-0 border dark:border-transparent transition-all relative ${
              isSelected 
                ? 'bg-white border-transparent' 
                : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] border-black/5'
            }`}
            style={!isSelected ? getAdaptiveGlassStyleBlur() : undefined}
          >
            {isChatflixModel(model.id) ? (
              <Image 
                key={isSelected ? 'selected' : 'unselected'}
                src={getChatflixLogo({ isSelected: !isSelected })} 
                alt="Chatflix" 
                width={24} 
                height={24}
                className="object-contain"
              />
            ) : hasLogo(model.provider, model.id) ? (
              <Image 
                src={getProviderLogo(model.provider, model.id)} 
                alt={model.provider} 
                width={24} 
                height={24}
                          className="object-contain"
                        />
                      ) : (
              <div className={`text-lg font-bold ${isSelected ? 'text-blue-500' : 'text-black/20 dark:text-white/20'}`}>
                {model.name[0]}
                </div>
                      )}
            {model.id === 'accounts/fireworks/models/deepseek-v3p2' && (
              <div 
                className="absolute -bottom-0.5 right-0 text-[8px] font-bold px-1 py-0.5 rounded-full leading-none whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--foreground)',
                  color: 'var(--background)'
                }}
              >
              BETA
              </div>
            )}
                      </div>
                    </div>
        <div className={`flex-1 min-w-0 min-h-[64px] flex items-center gap-2 ${!isSelected && !isLast ? 'border-b border-black/5 dark:border-white/5' : ''}`}>
          <div className="flex-1 min-w-0 flex items-center">
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`font-semibold text-[17px] truncate ${isSelected ? 'text-white' : 'text-black dark:text-white'}`}>
                  {model.name}
                </span>
                {model.isNew && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-500'
                  }`}>New</span>
                )}
              </div>
              {sortCriteria !== 'default' && (
                <div className="shrink-0 w-24 flex justify-end">
                  {sortCriteria === 'intelligenceIndex' && model.intelligenceIndex && 
                    renderStatBar(model.intelligenceIndex, isSelected ? 'bg-white' : 'bg-purple-500')}
                  {sortCriteria === 'tps' && model.tps && 
                    renderStatBar(model.tps, isSelected ? 'bg-white' : 'bg-yellow-500')}
                  {sortCriteria === 'latency' && model.latency && 
                    renderStatBar(model.latency, isSelected ? 'bg-white' : 'bg-blue-500')}
                  {sortCriteria === 'contextWindow' && model.contextWindow && 
                    renderStatBar(model.contextWindow, isSelected ? 'bg-white' : 'bg-green-500')}
                </div>
              )}
            </div>
          </div>
          {isChatflixModel(model.id) && model.description && (
            <div
              className="shrink-0 flex items-center justify-center self-center"
              data-tooltip-id="model-selector-tooltip"
              data-tool-id={variantId}
              data-tooltip-content={model.description}
              data-tooltip-is-open={isMobile && openTooltipId === variantId}
              onClick={(e) => {
                e.stopPropagation();
                if (isMobile) {
                  setOpenTooltipId(prev => prev === variantId ? null : variantId);
                }
              }}
            >
              <div
                className="rounded-full p-0.5 cursor-pointer flex items-center justify-center"
                style={{ backgroundColor: 'transparent' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'color-mix(in srgb, var(--foreground) 40%, transparent)' }}>
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}
        </div>
                        </button>
    );
  };

  const allModelGroup: { id: FilterGroup; label: string; icon: React.ReactNode } = { id: 'all', label: 'All Contacts', icon: <Globe size={18} /> };
  const featureFilterGroups: { id: FilterGroup; label: string; icon: React.ReactNode }[] = [
    { id: 'vision', label: 'Vision', icon: <Eye size={18} className="text-cyan-500" /> },
    { id: 'reasoning', label: 'Reasoning', icon: <Lightbulb size={18} className="text-purple-500" /> },
    { id: 'fast', label: 'Fast Models', icon: <Zap size={18} className="text-yellow-500" /> },
  ];
  const creatorFilterGroups: { id: FilterGroup; label: string; icon: React.ReactNode }[] = [
    { id: 'chatflix', label: 'Chatflix', icon: null },
    { id: 'anthropic', label: 'Anthropic', icon: <Image src={getProviderLogo('anthropic')} alt="Anthropic" width={14} height={14} /> },
    { id: 'deepseek', label: 'DeepSeek', icon: <Image src={getProviderLogo('deepseek')} alt="DeepSeek" width={14} height={14} /> },
    { id: 'google', label: 'Google', icon: <Image src={getProviderLogo('google')} alt="Google" width={14} height={14} /> },
    { id: 'moonshot', label: 'Moonshot', icon: <Image src={getProviderLogo('moonshot')} alt="Moonshot" width={14} height={14} /> },
    { id: 'openai', label: 'OpenAI', icon: <Image src={getProviderLogo('openai')} alt="OpenAI" width={14} height={14} /> },
    { id: 'xai', label: 'xAI', icon: <Image src={getProviderLogo('xai')} alt="xAI" width={14} height={14} /> },
  ];

  const renderFilterButton = (group: { id: FilterGroup; label: string; icon: React.ReactNode }) => (
    <button 
      key={group.id}
      onClick={() => handleFilterClick(group.id)}
      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200 text-left ${activeFilter === group.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'hover:bg-black/5 dark:hover:bg-white/5 text-black/70 dark:text-white/70'}`}
    >
      <div
        className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 transition-all border dark:border-transparent ${
          activeFilter === group.id ? 'bg-white border-black/5' : isDark ? 'bg-white/5' : 'bg-black/5 border-black/5'
        }`}
        style={activeFilter !== group.id ? getAdaptiveGlassStyleBlur() : undefined}
      >
        {group.id === 'all' ? (
          <Globe size={14} className={activeFilter === group.id ? 'text-blue-500' : 'text-blue-500'} />
        ) : group.id === 'vision' ? (
          <Eye size={14} className={activeFilter === group.id ? 'text-cyan-500' : 'text-cyan-500'} />
        ) : group.id === 'reasoning' ? (
          <Lightbulb size={14} className={activeFilter === group.id ? 'text-purple-500' : 'text-purple-500'} />
        ) : group.id === 'fast' ? (
          <Zap size={14} className={activeFilter === group.id ? 'text-yellow-500' : 'text-yellow-500'} />
        ) : group.id === 'chatflix' ? (
          <div className="flex items-center justify-center w-full h-full">
            <Image
              key={activeFilter === group.id ? 'selected' : 'unselected'}
              src={getChatflixLogo({ isSelected: activeFilter !== group.id })}
              alt="Chatflix"
              width={14}
              height={14}
                                  />
                                </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full">{group.icon}</div>
                                )}
                              </div>
      <span className="font-medium text-[15px] leading-none min-h-6 flex items-center">{group.label}</span>
                      </button>
  );

  const sortOptions: { id: SortMetric; label: string; icon: React.ReactNode }[] = [
    { id: 'default', label: 'Default', icon: <ArrowUpDown size={14} /> },
    { id: 'intelligenceIndex', label: 'Intelligence', icon: <Brain size={14} /> },
    { id: 'tps', label: 'Speed (TPS)', icon: <Gauge size={14} /> },
    { id: 'latency', label: 'Latency', icon: <Activity size={14} /> },
    { id: 'contextWindow', label: 'Context', icon: <Box size={14} /> },
  ];

  if (!mounted) return null;

  const filterGroups = [allModelGroup, ...featureFilterGroups, ...creatorFilterGroups];

  const ModalContent = (
    <div 
      className="fixed inset-0" 
      style={{ 
        touchAction: 'none', 
        overflow: 'hidden', 
        zIndex: 9999,
        display: isOpen ? 'block' : 'none'
      }}
    >
      {isMobile ? (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 bg-black/20 transition-all duration-500 ease-out ${showElements.modal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={handleClose}
            style={{ touchAction: 'none', zIndex: 9998 }}
          />
          
          {/* Modal Sheet */}
          <div
            className="fixed inset-x-0 bottom-0 w-full flex flex-col overflow-hidden rounded-t-[30px]"
            style={{
              height: 'calc(100vh - 80px)',
              maxHeight: 'calc(100vh - 80px)',
              transform: !showElements.modal ? 'translateY(calc(100vh - 40px))' : `translateY(${currentTranslateY}px)`,
              transition: isDragging ? 'none' : showElements.modal ? 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease-out' : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
              willChange: 'transform, opacity',
              opacity: showElements.modal ? 1 : 0,
              ...getAdaptiveGlassStyleBlur(),
              backgroundColor: isDark ? 'rgba(28, 28, 30, 0.85)' : 'rgba(242, 242, 247, 0.85)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              zIndex: 9999
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div
              className={`text-center pt-4 pb-2 shrink-0 transition-all duration-250 ease-out ${showElements.title ? 'translate-y-0 opacity-100' : isClosing ? 'translate-y-6 opacity-0' : 'translate-y-6 opacity-0'}`}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ touchAction: 'none', willChange: 'transform, opacity' }}
            >
              <div className="w-12 h-1.5 rounded-full mx-auto transition-colors duration-200" style={{ backgroundColor: isDragging ? 'rgba(156, 163, 175, 0.4)' : 'rgba(209, 213, 219, 0.3)' }} />
            </div>

            {/* Header */}
            <div
              className={`relative flex items-center justify-center py-4 px-6 shrink-0 transition-all duration-250 ease-out ${showElements.title ? 'translate-y-0 opacity-100' : isClosing ? 'translate-y-6 opacity-0' : 'translate-y-6 opacity-0'}`}
              style={{ willChange: 'transform, opacity' }}
            >
              {view === 'list' && (
                <button 
                  onClick={() => setView('sidebar')} 
                  className="absolute left-6 p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/5" 
                  style={{ WebkitTapHighlightColor: 'transparent' }} 
                  aria-label="Back"
                >
                  <ChevronLeft size={24} className={isDark ? 'text-white' : 'text-black'} />
                </button>
              )}
              <h2 className="text-xl font-bold tracking-tight text-black dark:text-white">
                {view === 'sidebar' ? 'Contacts' : filterGroups.find((g: any) => g.id === activeFilter)?.label || 'Contacts'}
              </h2>
              <div className="absolute right-6 flex items-center gap-1">
                {view === 'list' && (
                  <button 
                    onClick={() => setShowSortOptions(!showSortOptions)} 
                    className={`p-2 rounded-full transition-all ${showSortOptions ? 'bg-blue-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 text-black dark:text-white'}`}
                    style={{ WebkitTapHighlightColor: 'transparent' }} 
                    aria-label="Sort"
                  >
                    <SlidersHorizontal size={20} />
                  </button>
                )}
                <button 
                  onClick={handleClose} 
                  className="p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/5" 
                  style={{ WebkitTapHighlightColor: 'transparent' }} 
                  aria-label="Close"
                >
                  <X size={24} className={isDark ? 'text-white' : 'text-black'} />
                </button>
              </div>
            </div>

            {/* Sort Options (Mobile - Toggleable) */}
            {isMobile && view === 'list' && (
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out px-6 ${showSortOptions ? 'max-h-24 opacity-100 mt-4 mb-4' : 'max-h-0 opacity-0'}`}
              >
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
                  {sortOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        if (sortCriteria === option.id) {
                          setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                        } else {
                          setSortCriteria(option.id);
                          setSortOrder('desc');
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-medium transition-all shrink-0 ${sortCriteria === option.id ? 'bg-blue-500 text-white shadow-sm' : 'bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40'}`}
                    >
                      {option.label}
                      {sortCriteria === option.id && option.id !== 'default' && (
                        <ChevronRight size={12} className={`transition-transform duration-200 ${sortOrder === 'desc' ? 'rotate-90' : '-rotate-90'}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content Area */}
            <div className={`flex-1 min-h-0 overflow-y-auto px-4 pb-10 transition-all duration-300 ease-out ${showElements.content ? 'translate-y-0 opacity-100' : isClosing ? 'translate-y-8 opacity-0' : 'translate-y-8 opacity-0'}`} style={{ willChange: 'transform, opacity' }}>
              {view === 'sidebar' ? (
                <div className="flex flex-col gap-6 pt-2">
                  {/* All Models */}
                  <div className="flex flex-col gap-0.5">
                    {renderFilterButton(allModelGroup)}
                  </div>
                  {/* Features */}
                  <div className="flex flex-col gap-0.5">
                    {featureFilterGroups.map((group) => (
                      <div key={group.id}>{renderFilterButton(group)}</div>
                    ))}
                  </div>
                  {/* Providers */}
                  <div className="flex flex-col gap-0.5">
                    {creatorFilterGroups.map((group) => (
                      <div key={group.id}>{renderFilterButton(group)}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Search in List View */}
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/20 dark:text-white/20" size={18} />
                    <input 
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl py-2 pl-10 pr-4 text-[17px] focus:ring-0 outline-none transition-all placeholder:text-black/20 dark:placeholder:text-white/20"
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/20 dark:text-white/20">
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Model List */}
                  <div className="space-y-6">
                    {sortCriteria === 'default' ? (
                      Object.entries(
                        filteredAndSortedModels.reduce((acc, model) => {
                          const firstLetter = model.name[0].toUpperCase();
                          if (!acc[firstLetter]) acc[firstLetter] = [];
                          acc[firstLetter].push(model);
                          return acc;
                        }, {} as Record<string, ModelConfig[]>)
                      ).sort().map(([letter, models]) => (
                        <div key={`group-${letter}`} className="space-y-1">
                          <div className="sticky top-0 z-10">
                            <div className="bg-transparent py-1 px-2 text-[13px] font-bold text-black/40 dark:text-white/40">
                              {letter}
                            </div>
                          </div>
                          <div className="border-b border-black/5 dark:border-white/5 mx-2" />
                          <div className="divide-y-0">
                            {models.map((model, idx) => renderModelItem(model, idx === models.length - 1))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="divide-y-0">
                        {filteredAndSortedModels.map((model, idx) => renderModelItem(model, idx === filteredAndSortedModels.length - 1))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Desktop View (Keep existing logic but wrap in same structure) */
        <div 
          className={`fixed inset-0 z-9999 flex items-center justify-center p-4 md:p-0 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-300`}
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          
          <div 
            ref={modalRef}
            onClick={e => e.stopPropagation()}
            className={`relative w-full max-w-[900px] h-[650px] max-h-[90vh] bg-[#F2F2F7] dark:bg-[#1C1C1E] rounded-[30px] shadow-2xl overflow-hidden flex flex-col md:flex-row transform transition-transform duration-500 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-10'}`}
          >
            {/* Sidebar */}
            <div className="w-full md:w-[260px] bg-[#E5E5EA] dark:bg-[#2C2C2E] flex flex-col border-r border-black/5 dark:border-white/5">
              <div className="p-6 pb-2">
                <h2 className="text-2xl font-bold tracking-tight text-black dark:text-white">Contacts</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-6">
                {/* All Models - separate at top */}
                <div className="flex flex-col gap-0.5">
                  {renderFilterButton(allModelGroup)}
                </div>
                {/* Features (Vision, Reasoning, Fast) */}
                <div className="flex flex-col gap-0.5">
                  {featureFilterGroups.map((group) => (
                    <div key={group.id}>{renderFilterButton(group)}</div>
                  ))}
                </div>
                {/* Providers */}
                <div className="flex flex-col gap-0.5">
                  {creatorFilterGroups.map((group) => (
                    <div key={group.id}>{renderFilterButton(group)}</div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white dark:bg-[#1C1C1E]">
              {/* Header with Search and Sort */}
              <div className="p-4 md:p-6 pb-2 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/20 dark:text-white/20" size={18} />
                  <input 
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-[#8E8E93]/10 dark:bg-[#8E8E93]/20 border-none rounded-xl py-2 pl-10 pr-4 text-[17px] focus:ring-0 outline-none transition-all placeholder:text-black/20 dark:placeholder:text-white/20"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-black/20 dark:text-white/20 hover:text-black/40 dark:hover:text-white/40"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                
                {/* Sort Controls */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {sortOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        if (sortCriteria === option.id) {
                          setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                        } else {
                          setSortCriteria(option.id);
                          setSortOrder('desc');
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-medium transition-all shrink-0 ${sortCriteria === option.id ? 'bg-blue-500 text-white shadow-sm' : 'bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/10'}`}
                    >
                      {option.label}
                      {sortCriteria === option.id && option.id !== 'default' && (
                        <ChevronRight size={12} className={`transition-transform duration-200 ${sortOrder === 'desc' ? 'rotate-90' : '-rotate-90'}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Model List */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
                <div className="space-y-6">
                  {sortCriteria === 'default' ? (
                    Object.entries(
                      filteredAndSortedModels.reduce((acc, model) => {
                        const firstLetter = model.name[0].toUpperCase();
                        if (!acc[firstLetter]) acc[firstLetter] = [];
                        acc[firstLetter].push(model);
                        return acc;
                      }, {} as Record<string, ModelConfig[]>)
                    ).sort().map(([letter, models]) => (
                      <div key={`group-${letter}`} className="space-y-1">
                        <div className="sticky top-0 z-10">
                          <div className="bg-transparent py-1 px-2 text-[13px] font-bold text-black/40 dark:text-white/40">
                            {letter}
                          </div>
                        </div>
                        <div className="border-b border-black/5 dark:border-white/5 mx-2" />
                        <div className="divide-y-0">
                          {models.map((model, idx) => renderModelItem(model, idx === models.length - 1))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="divide-y-0">
                      {filteredAndSortedModels.map((model, idx) => renderModelItem(model, idx === filteredAndSortedModels.length - 1))}
                    </div>
                  )}
                  
                  {filteredAndSortedModels.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-black/30 dark:text-white/30">
                      <Search size={48} strokeWidth={1} className="mb-4" />
                      <p className="text-lg font-medium">No models found</p>
                      <p className="text-sm">Try a different search term or filter</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

                      return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-4 pb-0">
        <div className={`relative inline-block ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {/* iMessage-style "To:" field */}
          <div 
            className={`flex items-center gap-2 cursor-text px-2 pl-3.5 h-8 ${disabled ? 'cursor-not-allowed' : ''}`}
                            onClick={() => {
              if (!disabled) {
                setIsOpen(true);
              }
            }}
          >
                                    <span 
              className="text-sm font-medium"
              style={getTextStyleUtil(hasBackgroundImage)}
            >
              To:
                                    </span>
            
            <div 
              className="flex items-center gap-2 px-2 py-1 rounded-full h-6 transition-all duration-300 active:scale-95 cursor-pointer"
                                  style={{
                ...getAdaptiveGlassStyleBlur(),
                ...getAdaptiveGlassBackgroundColor(),
              }}
            >
                                    <div className="flex items-center gap-2">
                                      {(() => {
                  const modelName = currentModelData?.name || nextModel;
                  const displayName = modelName.replace(' (Thinking)', '');
                                        const effortMatch = displayName.match(/\s*\((high|medium|low|minimal)\)/i);
                                        const nameWithoutEffort = effortMatch ? displayName.replace(effortMatch[0], '') : displayName;
                                        const effortLabel = effortMatch ? effortMatch[0].trim() : null;
                  const hasReasoningIndicator = modelName.includes('(Thinking)') || effortLabel;
                                        
                                        return (
                                          <>
                      <span className="text-[#007AFF] dark:text-[#007AFF] text-xs font-bold">
                                              {nameWithoutEffort}
                                            </span>
                                            {effortLabel && (
                        <span className="text-[#007AFF]/70 dark:text-[#007AFF]/70 text-xs font-medium">
                                                {effortLabel}
                                              </span>
                                            )}
                                            {hasReasoningIndicator && (
                        <BrainIOS className="w-3.5 h-3.5 text-[#007AFF]/80 dark:text-[#007AFF]/80" />
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                      </div>
                                  </div>
                                </div>
                                    </div>

      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          {ModalContent}
          <Tooltip
            key={`model-tooltip-${openTooltipId || 'none'}`}
            id="model-selector-tooltip"
            anchorSelect={isMobile && openTooltipId ? `[data-tool-id="${openTooltipId}"]` : '[data-tooltip-id="model-selector-tooltip"]'}
            place="right"
            offset={15}
            delayShow={isMobile ? 0 : 200}
            delayHide={100}
            noArrow={true}
            opacity={1}
            clickable={true}
            isOpen={isMobile ? openTooltipId !== null : undefined}
            openEvents={isMobile ? {} : undefined}
            style={{
              backgroundColor: (isDark || hasBackgroundImage) ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              border: (isDark || hasBackgroundImage) ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
              boxShadow: (isDark || hasBackgroundImage) ? '0 8px 32px rgba(0, 0, 0, 0.6)' : '0 8px 32px rgba(0, 0, 0, 0.2)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 500,
              maxWidth: '240px',
              color: (isDark || hasBackgroundImage) ? '#ffffff' : '#000000',
              zIndex: 99999999,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              lineHeight: '1.5',
            }}
          />
        </>,
        document.body
      )}
    </div>
  );
}
