import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Info, Trash2, Plus } from 'lucide-react';
import { getAdaptiveGlassStyleBlur, getIconClassName as getIconClassNameUtil, getTextStyle as getTextStyleUtil } from '@/app/lib/adaptiveGlassStyle';
import { createPortal } from 'react-dom';
import { VALID_APP_IDS } from '@/lib/quick-access-apps';
import { WIDGET_COMPONENTS } from './widgets';
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage';
import { useBackgroundImageBrightness } from '@/app/hooks/useBackgroundImageBrightness';
import { DEFAULT_APP_PRIORITY_ORDER } from './apps/appRegistry';

// Modal App Item Component with individual background brightness detection
interface ModalAppItemProps {
  app: App & { gradient?: string; iconColor?: string; isFullAppIcon?: boolean };
  isSelected: boolean;
  isAvailable: boolean;
  isSelectionMode: boolean;
  isDarkMode: boolean;
  onSelectApp: (appId: string) => void;
  onAddApp: (appId: string) => void;
  onClose: () => void;
  renderAddButton: (appId: string, position: 'top-0 right-0' | 'top-2 right-2') => React.ReactNode;
  isSelectedForAdd: (appId: string) => boolean;
  isSelectedForDelete: (appId: string) => boolean;
  isContentVisible: boolean;
}

function ModalAppItem({
  app,
  isSelected,
  isAvailable,
  isSelectionMode,
  isDarkMode,
  onSelectApp,
  onAddApp,
  onClose,
  renderAddButton,
  isSelectedForAdd,
  isSelectedForDelete,
  isContentVisible,
}: ModalAppItemProps) {
  // AppSelectionModal is always on home view which has background image
  const hasBackgroundImage = true;
  const iconBoxRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const Icon = app.icon;
  const isComingSoon = app.comingSoon || false;
  // comingSoon이면 항상 비활성화
  const isActuallyAvailable = isAvailable && !isComingSoon;
 
  // Style functions that use individual background brightness
  const getTextStyle = () => {
    return { color: 'rgba(255, 255, 255)', textShadow: 'none' };
  };
  const getButtonStyle = () => {
    const baseStyle = getAdaptiveGlassStyleBlur();
    
    if (app.isFullAppIcon) {
      return {
        ...baseStyle,
        background: 'transparent', // The SVG has its own semi-transparent background
        border: 'none',
        padding: 0,
        position: 'relative' as const,
        overflow: 'hidden' as const,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }

    // 도구 선택창과 동일: 글라스 boxShadow(inset 하이라이트) 유지, gradient만 덮어씀
    return {
      ...baseStyle,
      background: app.gradient || baseStyle.backgroundColor,
      border: 'none',
      position: 'relative' as const,
      overflow: 'hidden' as const,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  };
  const getButtonStyle2D = () => {
    if (app.isFullAppIcon) {
      return {
        ...getAdaptiveGlassStyleBlur(),
        background: 'transparent',
        border: 'none',
        padding: 0,
        position: 'relative' as const,
        overflow: 'hidden' as const,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }

    // 이미 추가된 앱도 글라스 효과 유지 (2D 제거)
    const baseStyle = getAdaptiveGlassStyleBlur();
    return {
      ...baseStyle,
      background: app.gradient || baseStyle.backgroundColor,
      border: 'none',
      position: 'relative' as const,
      overflow: 'hidden' as const,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  };
  const getIconClassName = () => {
    return ''; // We'll use inline style for color
  };

  return (
    <div 
      className={`flex flex-col items-center relative ${
        isAvailable ? 'app-2d-container' : ''
      }`}
    >
      <div className="relative">
        {isSelectionMode && (
          <div className="absolute top-0 left-0 z-20">
            <div 
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                isSelected 
                  ? 'bg-[#007AFF] border-[#007AFF]' 
                  : 'border-[var(--muted)] opacity-50'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectApp(app.id);
              }}
            >
              {isSelectedForAdd(app.id) ? (
                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" strokeWidth="3" />
              ) : isSelectedForDelete(app.id) ? (
                <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" strokeWidth="3" />
              ) : null}
            </div>
          </div>
        )}
        {!isSelectionMode && isActuallyAvailable && renderAddButton(app.id, 'top-0 right-0')}
        {/* Soon 배지 */}
        {isComingSoon && (
          <div className="absolute -top-1 -right-1 z-30 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full px-2 py-0.5 flex items-center justify-center shadow-lg">
            <span className="text-[9px] sm:text-[10px] font-bold text-white leading-none">Soon</span>
          </div>
        )}
        <button
          ref={iconBoxRef}
          onClick={() => {
            if (isComingSoon) return; // comingSoon이면 클릭 무시
            if (isSelectionMode) {
              onSelectApp(app.id);
            } else {
              if (isActuallyAvailable) {
                onAddApp(app.id);
                onClose();
              }
            }
          }}
          className={`w-16 h-16 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl transition-all duration-300 shadow-md ${
            isComingSoon 
              ? 'cursor-not-allowed opacity-60' 
              : isActuallyAvailable 
                ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' 
                : 'cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
          }`}
          style={isActuallyAvailable ? getButtonStyle2D() : getButtonStyle()}
          disabled={isComingSoon}
        >
          {!app.isFullAppIcon && (
            <>
              {/* Glass Inner Gloss - 도구 선택창과 동일 */}
              <div className="absolute inset-0 rounded-2xl bg-linear-to-tr from-white/25 to-transparent opacity-50 pointer-events-none" />
              <div className="absolute inset-0 rounded-2xl bg-linear-to-b from-black/5 to-transparent pointer-events-none" />
            </>
          )}

          <div 
            style={isActuallyAvailable ? { opacity: 0.6 } : {}}
            className={`${app.isFullAppIcon ? 'w-full h-full rounded-2xl overflow-hidden' : 'flex items-center justify-center'} relative z-10`}
          >
            <Icon
              className={app.isFullAppIcon ? 'w-full h-full' : `${
                app.isCustomIcon ? 'w-7 h-7 sm:w-7 sm:h-7 *:stroke-[2.5]' : 'w-9 h-9 sm:w-9 sm:h-9 *:stroke-[2.5]'
              }`}
              style={{ 
                color: !app.isFullAppIcon ? (app.iconColor || 'white') : undefined,
                filter: !app.isFullAppIcon ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' : 'none'
              }}
            />
          </div>
        </button>
      </div>
      <span
        ref={textRef}
        className="text-xs sm:text-xs font-bold mt-1 transition-colors duration-300 text-center"
        style={{
          ...getTextStyle(),
          zIndex: 10,
          ...(isActuallyAvailable ? { opacity: 0.6 } : {}),
          ...(isComingSoon ? { opacity: 0.6 } : {}),
        }}
      >
        {app.label}
      </span>
    </div>
  );
}

// Modal Widget Item Component with individual background brightness detection
interface ModalWidgetItemProps {
  widget: App;
  isSelected: boolean;
  isAvailable: boolean;
  isSelectionMode: boolean;
  isDarkMode: boolean;
  onSelectApp: (appId: string) => void;
  onAddApp: (appId: string) => void;
  onClose: () => void;
  renderAddButton: (appId: string, position: 'top-0 right-0' | 'top-2 right-2') => React.ReactNode;
  renderWidgetContent: (widget: App, hasBackgroundImage: boolean) => React.ReactNode;
  isSelectedForAdd: (appId: string) => boolean;
  isSelectedForDelete: (appId: string) => boolean;
  user?: { id?: string };
  isContentVisible: boolean;
}

function ModalWidgetItem({
  widget,
  isSelected,
  isAvailable,
  isSelectionMode,
  isDarkMode,
  onSelectApp,
  onAddApp,
  onClose,
  renderAddButton,
  renderWidgetContent,
  isSelectedForAdd,
  isSelectedForDelete,
  user,
  isContentVisible,
}: ModalWidgetItemProps) {
  // AppSelectionModal is always on home view which has background image
  const hasBackgroundImage = true;
  const widgetRef = useRef<HTMLDivElement>(null);

  // Style functions that use individual background brightness
  const getWidgetContainerStyle2D = () => {
    return {
      boxShadow: 'none',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      opacity: 0.6,
    };
  };

  const getTextStyle = () => {
    return { color: 'rgba(255, 255, 255)', textShadow: 'none' };
  };

  return (
    <div 
      key={widget.id} 
      className="w-full max-w-[320px] md:max-w-[360px] lg:max-w-[400px] xl:max-w-none mx-auto relative"
    >
      {isSelectionMode && (
        <div className="absolute top-2 left-2 z-20">
          <div 
            className={`w-5 h-5 lg:w-7 lg:h-7 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
              isSelected 
                ? 'bg-[#007AFF] border-[#007AFF]' 
                : 'border-[var(--muted)] opacity-50'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectApp(widget.id);
            }}
          >
            {isSelectedForAdd(widget.id) ? (
              <Plus className="w-3 h-3 lg:w-4 lg:h-4 text-white" strokeWidth="3" />
            ) : isSelectedForDelete(widget.id) ? (
              <Trash2 className="w-3 h-3 lg:w-4 lg:h-4 text-white" strokeWidth="3" />
            ) : null}
          </div>
        </div>
      )}
      {!isSelectionMode && isAvailable && renderAddButton(widget.id, 'top-2 right-2')}
      <div
        onClick={() => {
          if (isSelectionMode) {
            onSelectApp(widget.id);
          } else {
            if (isAvailable) {
              onAddApp(widget.id);
              onClose();
            }
          }
        }}
        className={`w-full min-h-[144px] sm:min-h-[150px] md:min-h-[170px] max-h-[190px] rounded-[24px] overflow-visible cursor-pointer relative ${
          isAvailable ? 'widget-2d-container' : ''
        }`}
        style={{
          boxSizing: 'border-box',
          height: '100%',
          overflow: 'visible',
          ...(isAvailable ? getWidgetContainerStyle2D() : {}),
          // 외부 컨테이너에서는 글라스 효과를 제거하고, 위젯 내부에서만 적용되도록 함
          backgroundColor: 'transparent',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          border: 'none',
          boxShadow: 'none',
        }}
      >
        <div 
          ref={widgetRef}
          className="w-full h-full overflow-hidden rounded-[24px]"
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          {renderWidgetContent(widget, hasBackgroundImage)}
        </div>
      </div>
      <div className="text-center mt-1">
        <span
          className="text-xs sm:text-xs font-bold transition-colors duration-300"
          style={{
            ...getTextStyle(),
            ...(isAvailable ? { opacity: 0.6 } : {}),
          }}
        >
          {widget.label}
        </span>
      </div>
    </div>
  );
}

interface App {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  path: string;
  isCustomIcon?: boolean; // Custom SVG icons (smaller size)
  isWidget?: boolean; // Marks this as a widget
  comingSoon?: boolean; // Marks this app as coming soon
}

interface AppSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableApps: App[];
  visibleApps: App[];
  onAddApp: (appId: string) => void;
  onRemoveApp?: (appId: string) => void;
  onAddMultipleApps?: (appIds: string[]) => void;
  onRemoveMultipleApps?: (appIds: string[]) => void;
  isDarkMode: boolean;
  user?: { id?: string };
  onPromptClick?: (prompt: string) => void;
}

export function AppSelectionModal({
  isOpen,
  onClose,
  availableApps,
  visibleApps,
  onAddApp,
  onRemoveApp,
  onAddMultipleApps,
  onRemoveMultipleApps,
  isDarkMode,
  user,
  onPromptClick
}: AppSelectionModalProps) {
  // AppSelectionModal is always on home view which has background image
  const hasBackgroundImage = true;
  const [panelElements, setPanelElements] = useState({
    background: false,
    content: false,
  });

  // Tab state
  const [activeTab, setActiveTab] = useState<'apps' | 'widgets'>('apps');

  // Selection mode state - starts as false (like Photo component)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);

  // Clear selection when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedAppIds([]);
      setIsSelectionMode(false);
    }
  }, [isOpen]);

  // Clear selection when exiting selection mode (like PhotoContext)
  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedAppIds([]);
    }
  }, [isSelectionMode]);

  // Background management using shared hook
  const {
    currentBackground,
    backgroundType,
    backgroundId,
    isBackgroundLoading,
    refreshBackground
  } = useBackgroundImage(user?.id, {
    refreshOnMount: true,
    preload: true,
    useSupabase: false
  });

  // Refresh background when modal opens
  useEffect(() => {
    if (isOpen && user?.id) {
      refreshBackground();
            }
  }, [isOpen, user?.id, refreshBackground]);

  // Calculate background image brightness for overlay
  const { brightness, isLoading: isBrightnessLoading, isVeryDark, isVeryBright } = useBackgroundImageBrightness(
    currentBackground
  );

  const overlayColor = useMemo(() => {
    if (isVeryDark) {
      return 'rgba(255, 255, 255, 0.125)';
    }
    if (isVeryBright) {
      return 'rgba(0, 0, 0, 0.2)';
    }
    return undefined;
  }, [isVeryDark, isVeryBright]);

  // Animation sequence on open/close
  useEffect(() => {
    if (isOpen) {
      // 애니메이션 없이 즉시 표시
      setPanelElements({ background: true, content: true });
    } else {
      // Close animation sequence
      setPanelElements({ background: false, content: false });
    }
  }, [isOpen]);

  // Modal's own background brightness detection removed - using hasBackgroundImage instead
  const modalRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Filter out apps/widgets that are not in VALID_APP_IDS
  const validApps = availableApps.filter(app => VALID_APP_IDS.includes(app.id));
  
  // Filter out launch pad (add-app) - it opens the modal, so shouldn't appear inside it
  const validAppsWithoutLaunchpad = validApps.filter(app => app.id !== 'add-app');
  
  // Filter out already visible apps
  const visibleAppIds = visibleApps.map(app => app.id);
  const availableToAdd = validAppsWithoutLaunchpad.filter(app => !visibleAppIds.includes(app.id));
  
  // Separate apps and widgets
  const appsToAdd = availableToAdd.filter(item => !item.isWidget);
  const widgetsToAdd = availableToAdd.filter(item => item.isWidget);
  
  // Visible apps and widgets (for deletion)
  // Also filter out launch pad from visible apps
  const visibleAppsList = visibleApps.filter(app => !app.isWidget && app.id !== 'add-app');
  const visibleWidgetsList = visibleApps.filter(app => app.isWidget);
  
  // Combine for display - available to add and currently visible
  const apps = [...appsToAdd, ...visibleAppsList];
  const widgets = [...widgetsToAdd, ...visibleWidgetsList];

  // Selection handlers
  const handleSelectApp = (appId: string) => {
    setSelectedAppIds(prev =>
      prev.includes(appId)
        ? prev.filter(id => id !== appId)
        : [...prev, appId]
    );
  };

  // Determine which items are available to add vs visible (for deletion)
  const isAvailableToAdd = (appId: string) => {
    const app = availableToAdd.find(app => app.id === appId);
    // comingSoon인 앱은 추가할 수 없음
    if (app?.comingSoon) return false;
    return !!app;
  };

  // Helper functions to determine selection type
  const isSelectedForAdd = (appId: string) => {
    return selectedAppIds.includes(appId) && isAvailableToAdd(appId);
  };

  const isSelectedForDelete = (appId: string) => {
    return selectedAppIds.includes(appId) && !isAvailableToAdd(appId);
  };

  // Separate selected items by action type
  const selectedToAdd = selectedAppIds.filter(id => isAvailableToAdd(id));
  const selectedToRemove = selectedAppIds.filter(id => !isAvailableToAdd(id));

  // Action handlers
  const handleAddSelected = () => {
    if (selectedToAdd.length === 0) return;
    
    if (onAddMultipleApps) {
      onAddMultipleApps(selectedToAdd);
    } else {
      selectedToAdd.forEach(appId => onAddApp(appId));
    }
    
    // Only remove selectedToAdd items from selection, keep selectedToRemove items selected
    setSelectedAppIds(prev => prev.filter(id => !selectedToAdd.includes(id)));
  };

  const handleRemoveSelected = () => {
    if (selectedToRemove.length === 0 || !onRemoveApp) return;
    
    if (onRemoveMultipleApps) {
      onRemoveMultipleApps(selectedToRemove);
    } else {
      selectedToRemove.forEach(appId => onRemoveApp(appId));
    }
    
    // Only remove selectedToRemove items from selection, keep selectedToAdd items selected
    setSelectedAppIds(prev => prev.filter(id => !selectedToRemove.includes(id)));
  };

  const handleCancel = () => {
    setSelectedAppIds([]);
    onClose();
  };

  const getTextStyle = () => {
    // AppSelectionModal is always on home view which has background image - always white
    return { color: 'rgba(255, 255, 255)', textShadow: 'none' };
  };

  const getButtonStyle = () => {
    return {
      ...getAdaptiveGlassStyleBlur(),
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  };

  // 2D 스타일 - 글라스 효과 없는 평면적 스타일
  const getButtonStyle2D = () => {
    return {
      backgroundColor: 'transparent',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      boxShadow: 'none',
      // opacity는 버튼 자체에 적용하지 않고 아이콘/텍스트에만 적용 (자식 요소 영향 방지)
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  };

  // 앱 정렬 함수: 메세지 → 포토 → 세팅 → 일반 앱 → soon 앱 순서로 정렬 (기본 상태와 동일)
  const sortApps = (apps: App[]): App[] => {
    const priorityOrder = DEFAULT_APP_PRIORITY_ORDER;
    const soonApps: App[] = [];
    const regularApps: App[] = [];
    const priorityApps: App[] = [];
    
    apps.forEach(app => {
      if (app.comingSoon) {
        soonApps.push(app);
      } else if (priorityOrder.includes(app.id)) {
        priorityApps.push(app);
      } else {
        regularApps.push(app);
      }
    });
    
    // 우선순위 앱들을 순서대로 정렬
    const sortedPriority = priorityOrder
      .map(id => priorityApps.find(app => app.id === id))
      .filter((app): app is App => app !== undefined);
    
    return [...sortedPriority, ...regularApps, ...soonApps];
  };

  // + 버튼 렌더링 헬퍼 (재사용 가능)
  const renderAddButton = (appId: string, position: 'top-0 right-0' | 'top-2 right-2' = 'top-0 right-0') => {
    return (
      <div 
        className={`absolute ${position} z-20`}
        onClick={(e) => {
          e.stopPropagation();
          onAddApp(appId);
        }}
      >
        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#007AFF] flex items-center justify-center shadow-md cursor-pointer hover:bg-[#0056CC] transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 sm:w-3.5 sm:h-3.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
      </div>
    );
  };

  // 위젯 컨텐츠 렌더링 헬퍼 (개별 배경 밝기 받음)
  const renderWidgetContent = (widget: App, hasBackgroundImage: boolean) => {
    const commonProps = {
      isDarkMode,
      isBackgroundDark: hasBackgroundImage,
      isEditMode: false, // 모달에서는 항상 일반 모드
      widgetId: widget.id, // Pass widget ID for automatic style mode determination
    };
    const C = WIDGET_COMPONENTS[widget.id];
    if (!C) return null;
    return <C {...commonProps} user={user} />;
  };

  const getGlassStyle = () => {
    const baseStyle = getAdaptiveGlassStyleBlur();
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    
    // background를 완전히 덮어쓰기 위해 baseStyle의 backgroundColor를 제거하고 새로 설정
    const { backgroundColor, ...restStyle } = baseStyle;
    
    return {
      ...restStyle,
      // backgroundColor 대신 background만 사용하여 이중 레이어 방지
      background: isDarkMode 
        ? (isMobile ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.7)')
        : (isMobile ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.8)'),
      boxShadow: isDarkMode
        ? '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
        : '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    };
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Dynamic overlay opacity based on theme and background
  // 홈 화면과 동일한 느낌을 위해 거의 투명하게 설정
  const getOverlayOpacity = () => {
    // 홈 화면에는 모달 오버레이가 없으므로 매우 투명하게 설정 (배경 클릭 처리용으로만 유지)
    return 0;
  };

  const modalContent = (
    <div 
      ref={modalRef}
      className="fixed inset-0 z-9999 text-[var(--foreground)] pointer-events-auto"
    >
      {/* Background Image Layer */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat min-h-screen w-full pointer-events-none"
        style={{
          backgroundImage: currentBackground ? `url("${currentBackground.replace(/"/g, '\\"')}")` : undefined,
          zIndex: 0
        }}
      />
      
      {/* Blur overlay */}
      <div 
        className="fixed inset-0 min-h-screen w-full pointer-events-none"
        style={{
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          zIndex: 0.5
        }}
      />
      
      {/* Color overlay for very dark or very bright backgrounds */}
      {overlayColor && (
        <div 
          className="fixed inset-0 min-h-screen w-full pointer-events-none"
          style={{
            backgroundColor: overlayColor,
            zIndex: 0.6
          }}
        />
      )}
      
      {/* Invisible overlay for backdrop click handling */}
      <div 
        className="absolute inset-0 pointer-events-auto"
        style={{ 
          backgroundColor: 'transparent',
          zIndex: 1
        }}
        onClick={handleBackdropClick}
      />
      
      <div 
        className="relative h-full w-full flex flex-col transform-gpu"
        style={{ zIndex: 2 }}
      >
        <button
          aria-label="Close"
          className="absolute top-3 right-3 rounded-full z-10 cursor-pointer p-[8px] md:p-[4px]"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            willChange: 'left, background-color, border, box-shadow',
            outline: '0 !important',
            WebkitTapHighlightColor: 'transparent',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            appearance: 'none',
            ...getAdaptiveGlassStyleBlur(),
            ...getTextStyle()
          }}
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        
        {/* 2D 스타일 - 모든 글라스 효과 개별 제거 */}
        <style>{`
          /* 위젯 2D 컨테이너 - 모든 자식 요소의 글라스 효과 제거 */
          .widget-2d-container,
          .widget-2d-container *,
          .widget-2d-container *::before,
          .widget-2d-container *::after {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-shadow: none !important;
            text-shadow: none !important;
            filter: none !important;
          }
          /* 위젯 컴포넌트 루트 div (rounded-[24px]이 있는 요소) 배경 투명하게 */
          .widget-2d-container > div > div[class*="rounded-[24px]"] {
            background-color: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-shadow: none !important;
            border: none !important;
          }
          /* 위젯 내부 버튼, span, div 등의 글라스 효과 제거 */
          .widget-2d-container button,
          .widget-2d-container button *,
          .widget-2d-container span,
          .widget-2d-container span *,
          .widget-2d-container div[style*="backdrop-filter"],
          .widget-2d-container div[style*="box-shadow"] {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          
          /* 앱 2D 컨테이너 - 아이콘과 텍스트의 글라스 효과 제거 */
          .app-2d-container,
          .app-2d-container *,
          .app-2d-container *::before,
          .app-2d-container *::after {
            text-shadow: none !important;
            filter: none !important;
          }
          .app-2d-container button {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-shadow: none !important;
          }
          .app-2d-container span {
            text-shadow: none !important;
          }
        `}</style>
        
        {/* Content */}
        <div className="px-12 sm:px-16 md:px-20 lg:px-28 pt-12 sm:pt-30 pb-24 overflow-y-auto">
          <div className="flex items-center justify-between">
          <h2 
            className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight"
            style={getTextStyle()}
          >
            Launchpad
          </h2>

            {/* Selection Mode Toggle Button */}
            <button
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className="text-[var(--foreground)] rounded-full flex items-center justify-center group w-[60px] h-[36px] flex-shrink-0 cursor-pointer"
              title={isSelectionMode ? 'Done selecting' : 'Toggle selection mode'}
              style={{
                willChange: 'left, background-color, border, box-shadow',
                outline: '0 !important',
                WebkitTapHighlightColor: 'transparent',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none',
                ...(isSelectionMode ? {
                  background: 'transparent',
                  border: '1px solid transparent',
                  boxShadow: 'none',
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                } : getAdaptiveGlassStyleBlur())
              }}
            >
              {isSelectionMode ? (
                <div 
                  className="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer"
                  style={{
                    color: 'white',
                    backgroundColor: '#007AFF',
                    border: '1px solid #007AFF',
                    boxShadow: '0 8px 40px rgba(0, 122, 255, 0.3), 0 4px 20px rgba(0, 122, 255, 0.2), 0 2px 8px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  }}
                  title="Done selecting"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-full px-2">
                  <span className="text-sm font-semibold" style={getTextStyle()}>Select</span>
                </div>
              )}
            </button>
          </div>

          {/* Experimental Space Notice */}
          {/* <div 
            className="mt-6 mb-8 p-4 sm:p-5 rounded-[24px] border"
            style={{
              ...getButtonStyle(),
              borderColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Info 
                  className={`w-5 h-5 sm:w-6 sm:h-6 ${getIconClassName()}`}
                />
              </div>
              <p 
                className="text-sm sm:text-base leading-relaxed flex-1"
                style={getTextStyle()}
              >
                <span className="font-semibold">Launchpad is an experimental feature.</span>
              </p> 
            </div>
          </div> */}

          {/* Tab Header */}
          <div className="mt-10 mb-6 border-b border-[var(--subtle-divider)] pb-3 pl-1 sm:pl-2">
            <nav className="flex gap-6">
              <button
                onClick={() => setActiveTab('apps')}
                className="text-sm pb-3 transition-all relative cursor-pointer"
                style={{
                  color: 'rgba(255, 255, 255)',
                  textShadow: 'none',
                  borderBottom: activeTab === 'apps' 
                    ? `2px solid rgba(255, 255, 255)` 
                    : '2px solid transparent',
                  marginBottom: '-12px',
                  opacity: activeTab === 'apps' ? 1 : 0.6
                }}
              >
                Apps
              </button>
              <button
                onClick={() => setActiveTab('widgets')}
                className="text-sm pb-3 transition-all relative cursor-pointer"
                style={{
                  color: 'rgba(255, 255, 255)',
                  textShadow: 'none',
                  borderBottom: activeTab === 'widgets' 
                    ? `2px solid rgba(255, 255, 255)` 
                    : '2px solid transparent',
                  marginBottom: '-12px',
                  opacity: activeTab === 'widgets' ? 1 : 0.6
                }}
              >
                Widgets
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="pl-1 sm:pl-2">
            {activeTab === 'apps' && (
              <>
                {apps.length === 0 ? (
                  <p 
                    className="text-center py-12 text-base opacity-70"
                    style={getTextStyle()}
                  >
                    No apps available
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-4 sm:gap-5 md:gap-6 lg:gap-5">
                    {/* Visible apps first, then available to add - 정렬된 순서로 표시 */}
                    {sortApps([...visibleAppsList, ...appsToAdd]).map((app) => {
                      const isSelected = selectedAppIds.includes(app.id);
                      const isAvailable = isAvailableToAdd(app.id);
                      
                      return (
                        <ModalAppItem
                          key={app.id} 
                          app={app}
                          isSelected={isSelected}
                          isAvailable={isAvailable}
                          isSelectionMode={isSelectionMode}
                          isDarkMode={isDarkMode}
                          onSelectApp={handleSelectApp}
                          onAddApp={onAddApp}
                          onClose={onClose}
                          renderAddButton={renderAddButton}
                          isSelectedForAdd={isSelectedForAdd}
                          isSelectedForDelete={isSelectedForDelete}
                          isContentVisible={panelElements.content}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === 'widgets' && (
              <>
                {widgets.length === 0 ? (
                  <p 
                    className="text-center py-12 text-base opacity-70"
                    style={getTextStyle()}
                  >
                    No widgets available
                  </p>
                ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl-grid-cols-4 gap-x-2 sm:gap-x-3 md:gap-x-4 lg:gap-x-6 gap-y-10 sm:gap-y-8 md:gap-y-8 lg:gap-y-8">
                    {/* Visible widgets first, then available to add */}
                    {[...visibleWidgetsList, ...widgetsToAdd].map((widget) => {
                      const isSelected = selectedAppIds.includes(widget.id);
                      const isAvailable = isAvailableToAdd(widget.id);
                      
                      return (
                        <ModalWidgetItem
                          key={widget.id} 
                          widget={widget}
                          isSelected={isSelected}
                          isAvailable={isAvailable}
                          isSelectionMode={isSelectionMode}
                          isDarkMode={isDarkMode}
                          onSelectApp={handleSelectApp}
                          onAddApp={onAddApp}
                          onClose={onClose}
                          renderAddButton={renderAddButton}
                          renderWidgetContent={renderWidgetContent}
                          isSelectedForAdd={isSelectedForAdd}
                          isSelectedForDelete={isSelectedForDelete}
                          user={user}
                          isContentVisible={panelElements.content}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom Action Bar - Always show when in selection mode */}
        {isSelectionMode && (
          <div className="fixed bottom-0 left-0 right-0 p-3 flex flex-col text-[var(--foreground)] z-10000 pointer-events-none">
            <div className="flex items-center justify-around px-2 pointer-events-auto gap-3">
              {/* Add Button - Always visible, disabled when no items to add */}
                <button
                  onClick={handleAddSelected}
                disabled={selectedToAdd.length === 0}
                  className="flex items-center gap-2 px-4 py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
                  style={getGlassStyle()}
                  title="Add selected"
                >
                  <Plus size={20} className="text-white" style={{ color: 'white' }} />
                <span className="text-sm font-medium" style={getTextStyle()}>
                  Add{selectedToAdd.length > 0 ? ` (${selectedToAdd.length})` : ''}
                </span>
                </button>

              {/* Delete Button - Always visible, disabled when no items to delete or onRemoveApp not available */}
              {onRemoveApp && (
                <button
                  onClick={handleRemoveSelected}
                  disabled={selectedToRemove.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
                  style={getGlassStyle()}
                  title="Delete selected"
                >
                  <Trash2 size={20} className="text-white" style={{ color: 'white' }} />
                  <span className="text-sm font-medium" style={getTextStyle()}>
                    Delete{selectedToRemove.length > 0 ? ` (${selectedToRemove.length})` : ''}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Handle portal usage in SSR environment (same pattern as AccountDialog)
  if (typeof window === 'object') {
    const portalRoot = document.getElementById('portal-root');
    if (portalRoot) {
      return createPortal(modalContent, portalRoot);
    }
  }

  // Fallback for SSR or if portal-root is not found
  return modalContent;
}




