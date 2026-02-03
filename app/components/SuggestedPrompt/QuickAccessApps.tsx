import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAdaptiveGlassStyleBlur, getIconClassName as getIconClassNameUtil, getTextStyle as getTextStyleUtil } from '@/app/lib/adaptiveGlassStyle';
import { AppSelectionModal } from './AppSelectionModal';
import { useLastSeenUpdate } from '@/app/hooks/useLastSeenUpdate';
import { createClient } from '@/utils/supabase/client';
import { FeatureUpdate } from '@/app/types/FeatureUpdate';
import { WIDGET_COMPONENTS } from './widgets';
import { ALL_APPS } from './apps/appRegistry';
import { VALID_APP_IDS, DEFAULT_QUICK_ACCESS_APPS_DESKTOP, DEFAULT_QUICK_ACCESS_APPS_MOBILE, DEFAULT_QUICK_ACCESS_APPS_TABLET, StoredApp as StoredAppType } from '@/lib/quick-access-apps';
import { OnboardingRenderer } from '@/app/components/Onboarding/OnboardingRenderer';
import { SettingsPanel } from '@/app/components/SettingsPanel';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// (icons for apps are provided by registry)

type DeviceType = 'mobile' | 'tablet' | 'desktop';

const DEVICE_STORAGE_KEY_PREFIX = 'quickAccessApps';
const DEVICE_CACHE_KEY_PREFIX = 'quickAccessAppsCache';
// Legacy keys: device-agnostic (no _mobile/_tablet/_desktop). Do NOT use as migration source
// to avoid writing one device's data into another device's column (cross-device contamination).
const LEGACY_STORAGE_KEY = 'quickAccessApps';
const LEGACY_CACHE_KEY = 'quickAccessAppsCache';

const buildDeviceStorageKey = (prefix: string, deviceType: DeviceType) => `${prefix}_${deviceType}`;

// iPad 감지 (iPad 또는 iPadOS on MacIntel)
const isIPad = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Returns current viewport/environment type, not a stable device ID. Used to key storage and API per device type.
// Exported for HomeScreen to prefetch quick-access-apps by device before first paint.
export const getEnvironmentDeviceType = (): DeviceType => {
  if (typeof window === 'undefined') return 'desktop';

  const minDim = Math.min(window.innerWidth, window.innerHeight);
  const isSmallScreen = minDim <= 600;

  // iPad 감지 (터치 + 큰 화면)
  if (isIPad() && minDim > 600) {
    return 'tablet';
  }

  // 작은 화면 (iPhone 등)
  if (isSmallScreen) {
    return 'mobile';
  }

  // 중간 크기 화면의 터치 디바이스 (Android 폰 등)
  const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const hasMultipleTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;

  if (minDim <= 900 && (isCoarsePointer || hasMultipleTouchPoints)) {
    return 'mobile';
  }

  // 터치 태블릿 (Android 태블릿 등)
  if (minDim <= 1024 && (isCoarsePointer || hasMultipleTouchPoints)) {
    return 'tablet';
  }

  return 'desktop';
};

interface App {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  path: string;
  isCustomIcon?: boolean; // Custom SVG icons (smaller size)
  isWidget?: boolean; // Marks this as a widget
  slotIndex?: number; // 위젯 또는 모바일 앱의 슬롯 위치 (디바이스별 상태로 관리)
  dockIndex?: number; // 모바일 도크(4칸) 위치
  size?: { width: number; height: number }; // 위젯 크기 (디바이스별 상태로 관리)
}

interface QuickAccessAppsProps {
  isDarkMode: boolean;
  user?: { id?: string };
  onPromptClick?: (prompt: string) => void;
  verticalOffset?: number; // 상하 여백 값 (px)
  /** Preloaded apps from parent (e.g. HomeScreen) to avoid layout shift. When set, first paint uses this. */
  initialApps?: StoredAppType[] | null;
}

interface VisionWidgetOverlayProps {
  widget: App;
  onClose: () => void;
  renderWidgetContent: (widget: App, hasBackgroundImage: boolean, isFullscreen?: boolean) => React.ReactNode;
}

function VisionWidgetOverlay({
  widget,
  onClose,
  renderWidgetContent,
}: VisionWidgetOverlayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  // VisionWidgetOverlay is always on home view which has background image
  const hasBackgroundImage = true;
  const safeAreaTop = 'env(safe-area-inset-top, 0px)';
  const safeAreaBottom = 'env(safe-area-inset-bottom, 0px)';

  const widgetShellStyle = useMemo<CSSProperties>(() => {
    const glassStyle = getAdaptiveGlassStyleBlur();
    const boxShadow = glassStyle.boxShadow;
    return {
      ...glassStyle,
      boxShadow,
      border: 'none',
      height: '100%',
      overflow: 'visible',
      boxSizing: 'border-box',
    };
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="fixed inset-0 z-200"
      role="dialog"
      aria-modal="true"
      aria-label={`${widget.label} immersive widget`}
    >
      <button
        aria-label="Close widget"
        className="absolute z-215 rounded-full p-3 sm:p-2 transition-all duration-200 hover:scale-105 active:scale-95"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          ...getAdaptiveGlassStyleBlur(),
          color: 'rgba(255, 255, 255)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          top: 'max(12px, calc(env(safe-area-inset-top, 0px) + 12px))',
          right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
        }}
      >
        <X className="w-5 h-5" />
      </button>
      <div
        className={`absolute inset-0 backdrop-blur-2xl transition-opacity duration-500 ease-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className="relative z-210 flex items-stretch justify-center p-0 overflow-hidden"
        style={{
          minHeight: '100dvh',
          height: '100dvh',
        }}
        onClick={onClose}
      >
        <div
          className={`relative transition-all duration-500 ease-out ${
            isVisible
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-[0.96] translate-y-4'
          }`}
          style={{
            perspective: '2000px',
            width: '100%',
            maxWidth: '100%',
            height: '100dvh',
            maxHeight: '100dvh',
            minHeight: '100dvh',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative mx-auto w-full h-full">
            <div
              className="w-full h-full widget-content-wrapper rounded-none overflow-visible"
              style={{
                ...widgetShellStyle,
                height: '100dvh',
                minHeight: '100dvh',
                maxHeight: '100dvh',
                paddingTop: safeAreaTop,
                paddingBottom: safeAreaBottom,
              }}
            >
              <div
                ref={cardRef}
                className="w-full h-full overflow-hidden"
                style={{
                  width: '100%',
                  height: '100%',
                  overflowY: 'auto',
                  paddingBottom: safeAreaBottom,
                  paddingTop: safeAreaTop,
                }}
              >
                {renderWidgetContent(widget, hasBackgroundImage, true)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Empty Slot Component - 드롭 가능한 빈 슬롯
interface EmptySlotProps {
  slotId: string;
  isEditMode: boolean;
  handleContextMenu: (e: React.MouseEvent) => void;
  isAppSlot?: boolean; // 앱 슬롯인지 위젯 슬롯인지 구분
  cellSize?: number; // 위젯 슬롯의 경우 정사각형 셀 크기
}

function EmptySlot({ slotId, isEditMode, handleContextMenu, isAppSlot = false, cellSize }: EmptySlotProps) {
  const { setNodeRef, isOver } = useDroppable({ 
    id: slotId,
    disabled: !isEditMode,
  });

  // 디바이스별 높이 계산 - tablet도 mobile과 동일한 iOS 스타일 UI 사용
  const deviceType = getEnvironmentDeviceType();
  const isMobileOrTablet = deviceType !== 'desktop';
  
  // 도커 슬롯인지 확인 (dock-slot-으로 시작)
  const isDockSlot = slotId.startsWith('dock-slot-');
  
  // 도커 슬롯: 아이콘만 (64px 고정)
  // 일반 앱 슬롯: 아이콘(64px) + 마진(8px) + 텍스트(약 14px) = 약 86px
  // 위젯 슬롯 높이: 모바일/태블릿은 cellSize 사용, 데스크탑은 예전 로직 (180)
  const dockSlotHeight = 64; // 도커는 아이콘만 (제목 없음)
  const appSlotHeight = 86; // 앱 아이템과 동일한 높이 (h-16 아이콘 + mt-2 + 텍스트)
  const widgetSlotHeight = isAppSlot 
    ? appSlotHeight 
    : (isMobileOrTablet 
      ? (cellSize || 86) // 모바일/태블릿: 정사각형 셀 크기 사용
      : 180); // 데스크탑: 예전 로직 (180px)
  
  const slotHeight = isDockSlot ? dockSlotHeight : (isAppSlot ? appSlotHeight : widgetSlotHeight);

  return (
    <div
      ref={setNodeRef}
      style={{
        height: `${slotHeight}px`,
        minHeight: `${slotHeight}px`,
        maxHeight: `${slotHeight}px`
      }}
      className={`relative w-full ${isOver ? 'quick-access-drag-over' : ''}`}
      onContextMenu={isEditMode ? handleContextMenu : undefined}
    >
      {isEditMode && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`border-2 border-dashed border-white/15 rounded-2xl transition-all ${
              isAppSlot ? 'w-[68px] h-[68px]' : 'w-full h-full'
            }`}
          />
        </div>
      )}
    </div>
  );
}

// Sortable Widget Item Component
interface SortableWidgetItemProps {
  widget: App;
  slotId: string;
  isEditMode: boolean;
  isDarkMode: boolean;
  isRemoving: boolean;
  onDeleteWidget: (widgetId: string) => void;
  handleContextMenu: (e: React.MouseEvent) => void;
  handleLongPressStart: (widgetId?: string, position?: { x: number; y: number }) => void;
  handleLongPressEnd: () => void;
  renderWidgetContent: (widget: App, hasBackgroundImage: boolean) => React.ReactNode;
  widgetSize: { width: number; height: number };
  widgetGridColumns: number;
  onResizeStart?: (widgetId: string, direction: 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se', startPosition: { x: number; y: number }, startSize: { width: number; height: number }) => void;
  onResizeMove?: (currentPosition: { x: number; y: number }) => void;
  onResizeEnd?: () => void;
  isResizing?: boolean;
  hasResizeMovement?: boolean;
  resizeStyles?: { 
    width?: number; // 가로 방향 리사이징 시에만 적용
    height?: number; // 세로 방향 리사이징 시에만 적용
    transform: string; 
    justifySelf?: string; // CSS Grid 정렬 속성
    alignSelf?: string;   // CSS Grid 정렬 속성
  };
  justEnteredEditModeFromWidget?: () => boolean;
  isTouchDevice: boolean;
  onWidgetActivate?: (widget: App, originRect?: DOMRect) => void;
}

function SortableWidgetItem({
  widget,
  slotId,
  isEditMode,
  isDarkMode,
  isRemoving,
  onDeleteWidget,
  handleContextMenu,
  handleLongPressStart,
  handleLongPressEnd,
  renderWidgetContent,
  widgetSize,
  widgetGridColumns,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  isResizing = false,
  hasResizeMovement = false,
  resizeStyles,
  justEnteredEditModeFromWidget,
  isTouchDevice,
  onWidgetActivate,
}: SortableWidgetItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: widget.id, 
        disabled: !isEditMode || isResizing, // 리사이즈 중에는 드래그 비활성화
    data: { slotId } // 슬롯 정보 전달
  });

  // SortableWidgetItem is always on home view which has background image
  const hasBackgroundImage = true;
  const widgetRef = useRef<HTMLDivElement>(null);
  // 터치 탭 감지: DnD TouchSensor가 합성 click을 막는 문제 회피 (모바일에서 한 번 탭으로 위젯 확대)
  const widgetTapTouchStart = useRef<{ time: number; x: number; y: number } | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // 드래그 중일 때 완전히 숨김 (다른 위젯에 영향 없도록)
    opacity: isDragging ? 0 : 1,
  };

  // 편집 모드가 아닐 때만 long press 이벤트 핸들러 적용
  // 위젯 ID를 포함한 래퍼 함수 생성 (Safari touchEnd -> click 방지용)
  // 버튼/링크 등 인터랙티브 요소 위에서는 롱 프레스 시작 안 함 → 합성 click이 버튼에 전달되도록
  const longPressHandlers = !isEditMode ? {
    ...(isTouchDevice ? {
      onTouchStart: (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('button, a, input, textarea, select, [role="button"]')) return;
        handleLongPressStart(widget.id, { x: e.touches[0].clientX, y: e.touches[0].clientY });
      },
      onTouchEnd: () => handleLongPressEnd(),
    } : {}),
    // 데스크탑에서는 onMouseDown, onMouseUp, onMouseLeave 제거
    // 터치 디바이스에서만 마우스 이벤트 허용 (하이브리드 디바이스 대응)
    ...(isTouchDevice ? {
      onMouseDown: (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, a, input, textarea, select, [role="button"]')) return;
        handleLongPressStart(widget.id, { x: e.clientX, y: e.clientY });
      },
      onMouseUp: () => handleLongPressEnd(),
      onMouseLeave: () => handleLongPressEnd(),
    } : {}),
  } : {};

  // 그리드 span 설정
  // 모바일/태블릿: 최소 4x2 보장, 데스크탑: 예전 로직 (1x1 허용)
  const deviceType = getEnvironmentDeviceType();
  const isMobileOrTablet = deviceType !== 'desktop';
  const minColumnSpan = isMobileOrTablet ? 4 : 1;
  const minRowSpan = isMobileOrTablet ? 2 : 1;
  const gridColumnSpan = Math.max(minColumnSpan, Math.round(widgetSize.width));
  const gridRowSpan = Math.max(minRowSpan, Math.round(widgetSize.height));

  return (
    <motion.div 
      ref={setNodeRef}
      data-widget-container="true"
      layout={!isResizing} // 리사이즈 중에는 layout 애니메이션 비활성화
      transition={{
        type: 'spring',
        stiffness: 350,
        damping: 30,
        mass: 0.8,
      }}
      style={{
        ...style,
        // 순수 그리드 기반 크기 (CSS Grid가 자동 계산)
        gridColumn: `span ${gridColumnSpan}`,
        gridRow: `span ${gridRowSpan}`,
        // 리사이즈 중에만 픽셀 크기 적용
        width: resizeStyles?.width !== undefined ? `${resizeStyles.width}px` : undefined,
        height: resizeStyles?.height !== undefined ? `${resizeStyles.height}px` : undefined,
        // [핵심] CSS Grid Alignment를 이용한 역방향 확장 구현
        // 리사이즈 중에는 stretch 대신 end/start로 고정점을 명확히 함
        justifySelf: resizeStyles?.justifySelf || 'stretch',
        alignSelf: resizeStyles?.alignSelf || 'stretch',
        // 리사이즈 중에는 dnd-kit transform만 유지 (translate 계산 로직 제거)
        transform: style.transform,
        overflow: 'visible',
        zIndex: isResizing ? 100 : (isDragging ? 50 : 'auto'),
        ...((widget as any)._hasCollision ? {
          boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.8)',
          borderRadius: '12px',
        } : {}),
      }}
      className={`relative ${isEditMode ? 'widget-container' : ''} ${isDragging ? 'z-50 pointer-events-none' : ''} ${isRemoving ? 'quick-access-app-removing' : ''} ${isResizing ? 'resizing' : ''}`}
      onContextMenu={handleContextMenu}
      {...(isResizing ? {} : longPressHandlers)}
    >
      {/* Drag Handle - 편집 모드에서만 활성화 */}
      {isEditMode && (
        <div 
          {...listeners}
          {...attributes}
          className="absolute top-2 left-2 z-100 cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>
        </div>
      )}
      
      {/* Delete button */}
      {isEditMode && (
        <button
          onClick={(e) => { 
            e.stopPropagation();
            onDeleteWidget(widget.id);
          }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-600 transition-colors quick-access-delete-btn z-150 cursor-pointer"
          style={{ pointerEvents: 'auto' }}
        >
          <X className="w-3 h-3" />
        </button>
      )}
      
      {/* Resize Handle - 편집 모드에서만 활성화 */}
      {isEditMode && onResizeStart && (
        <>
          {/* 오른쪽 아래 모서리 손잡이 (대각선 리사이즈) */}
          <div
            onMouseDown={(e) => {
                  e.stopPropagation();
              e.preventDefault();
              if (onResizeStart) {
                onResizeStart(
                  widget.id,
                  'se',
                  { x: e.clientX, y: e.clientY },
                  widgetSize
                );
              }
            }}
            onTouchStart={(e) => {
                  e.stopPropagation();
              e.preventDefault();
              const touch = e.touches[0];
              if (onResizeStart && touch) {
                onResizeStart(
                  widget.id,
                  'se',
                  { x: touch.clientX, y: touch.clientY },
                  widgetSize
                );
              }
                }}
            className="absolute bottom-0 right-0 w-6 h-6 z-100 cursor-nwse-resize touch-none"
            style={{ 
              pointerEvents: 'auto',
              background: 'transparent',
              borderBottom: '6px solid rgba(255, 255, 255, 0.6)',
              borderRight: '6px solid rgba(255, 255, 255, 0.6)',
              borderRadius: '0 0 12px 0',
            }}
            title="Resize widget"
          />
          {/* 오른쪽 가장자리 손잡이 (가로 리사이즈) */}
          <div
            onMouseDown={(e) => {
                  e.stopPropagation();
              e.preventDefault();
              if (onResizeStart) {
                onResizeStart(
                  widget.id,
                  'e',
                  { x: e.clientX, y: e.clientY },
                  widgetSize
                );
              }
            }}
            onTouchStart={(e) => {
                    e.stopPropagation();
              e.preventDefault();
              const touch = e.touches[0];
              if (onResizeStart && touch) {
                onResizeStart(
                  widget.id,
                  'e',
                  { x: touch.clientX, y: touch.clientY },
                  widgetSize
                );
              }
                  }}
            className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-8 z-100 cursor-ew-resize touch-none"
            style={{ 
              pointerEvents: 'auto',
              background: 'rgba(255, 255, 255, 0.6)',
              borderRadius: '2px 0 0 2px',
            }}
            title="Resize width"
          />
          {/* 아래 가장자리 손잡이 (세로 리사이즈) */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onResizeStart) {
                onResizeStart(
                  widget.id,
                  's',
                  { x: e.clientX, y: e.clientY },
                  widgetSize
                );
              }
            }}
            onTouchStart={(e) => {
                  e.stopPropagation();
              e.preventDefault();
              const touch = e.touches[0];
              if (onResizeStart && touch) {
                onResizeStart(
                  widget.id,
                  's',
                  { x: touch.clientX, y: touch.clientY },
                  widgetSize
                );
              }
                }}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-2 z-100 cursor-ns-resize touch-none"
            style={{ 
              pointerEvents: 'auto',
              background: 'rgba(255, 255, 255, 0.6)',
              borderRadius: '2px 2px 0 0',
            }}
            title="Resize height"
          />
          {/* 왼쪽 가장자리 손잡이 (가로 리사이즈) */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onResizeStart) {
                onResizeStart(
                  widget.id,
                  'w',
                  { x: e.clientX, y: e.clientY },
                  widgetSize
                );
              }
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const touch = e.touches[0];
              if (onResizeStart && touch) {
                onResizeStart(
                  widget.id,
                  'w',
                  { x: touch.clientX, y: touch.clientY },
                  widgetSize
                );
              }
            }}
            className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-8 z-100 cursor-ew-resize touch-none"
            style={{ 
              pointerEvents: 'auto',
              background: 'rgba(255, 255, 255, 0.6)',
              borderRadius: '0 2px 2px 0',
            }}
            title="Resize width left"
          />
          {/* 위 가장자리 손잡이 (세로 리사이즈) */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onResizeStart) {
                onResizeStart(
                  widget.id,
                  'n',
                  { x: e.clientX, y: e.clientY },
                  widgetSize
                );
              }
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const touch = e.touches[0];
              if (onResizeStart && touch) {
                onResizeStart(
                  widget.id,
                  'n',
                  { x: touch.clientX, y: touch.clientY },
                  widgetSize
                );
              }
            }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-2 z-100 cursor-ns-resize touch-none"
            style={{ 
              pointerEvents: 'auto',
              background: 'rgba(255, 255, 255, 0.6)',
              borderRadius: '0 0 2px 2px',
            }}
            title="Resize height up"
          />
          {/* 왼쪽 위 모서리 손잡이 (대각선 리사이즈) */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onResizeStart) {
                onResizeStart(
                  widget.id,
                  'nw',
                  { x: e.clientX, y: e.clientY },
                  widgetSize
                );
              }
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const touch = e.touches[0];
              if (onResizeStart && touch) {
                onResizeStart(
                  widget.id,
                  'nw',
                  { x: touch.clientX, y: touch.clientY },
                  widgetSize
                );
              }
            }}
            className="absolute top-0 left-0 w-6 h-6 z-100 cursor-nwse-resize touch-none"
            style={{ 
              pointerEvents: 'auto',
              background: 'transparent',
              borderTop: '6px solid rgba(255, 255, 255, 0.6)',
              borderLeft: '6px solid rgba(255, 255, 255, 0.6)',
              borderRadius: '12px 0 0 0',
            }}
            title="Resize widget"
          />
          {/* 왼쪽 아래 모서리 손잡이 (대각선 리사이즈) */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onResizeStart) {
                onResizeStart(
                  widget.id,
                  'sw',
                  { x: e.clientX, y: e.clientY },
                  widgetSize
                );
              }
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const touch = e.touches[0];
              if (onResizeStart && touch) {
                onResizeStart(
                  widget.id,
                  'sw',
                  { x: touch.clientX, y: touch.clientY },
                  widgetSize
                );
              }
            }}
            className="absolute bottom-0 left-0 w-6 h-6 z-100 cursor-nesw-resize touch-none"
            style={{ 
              pointerEvents: 'auto',
              background: 'transparent',
              borderBottom: '6px solid rgba(255, 255, 255, 0.6)',
              borderLeft: '6px solid rgba(255, 255, 255, 0.6)',
              borderRadius: '0 0 0 12px',
            }}
            title="Resize widget"
          />
          {/* 오른쪽 위 모서리 손잡이 (대각선 리사이즈) */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onResizeStart) {
                onResizeStart(
                  widget.id,
                  'ne',
                  { x: e.clientX, y: e.clientY },
                  widgetSize
                );
              }
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const touch = e.touches[0];
              if (onResizeStart && touch) {
                onResizeStart(
                  widget.id,
                  'ne',
                  { x: touch.clientX, y: touch.clientY },
                  widgetSize
                );
              }
            }}
            className="absolute top-0 right-0 w-6 h-6 z-100 cursor-nesw-resize touch-none"
            style={{ 
              pointerEvents: 'auto',
              background: 'transparent',
              borderTop: '6px solid rgba(255, 255, 255, 0.6)',
              borderRight: '6px solid rgba(255, 255, 255, 0.6)',
              borderRadius: '0 12px 0 0',
            }}
            title="Resize widget"
          />
        </>
      )}
      
      {/* Widget Content */}
      <div 
        className="w-full h-full widget-content-wrapper rounded-[24px] overflow-visible"
        style={{
          height: '100%',
          boxSizing: 'border-box',
          ...(() => {
            const glassStyle = getAdaptiveGlassStyleBlur() as ReturnType<
              typeof getAdaptiveGlassStyleBlur
            > & { overflow?: string };
            const { overflow: _glassOverflow, ...safeGlassStyle } = glassStyle;
            // boxShadow에서 inset 부분 제거 (상단 선 제거)
            const boxShadow = glassStyle.boxShadow;
            const boxShadowWithoutInset = boxShadow 
              // ? boxShadow.replace(/,\s*inset\s+[^,]+/gi, '').replace(/inset\s+[^,]+,\s*/gi, '')
              // : undefined;
            return {
              ...safeGlassStyle,
              boxShadow: boxShadowWithoutInset,
              border: 'none', // border는 위젯 컴포넌트 자체에 적용되므로 중복 방지
              overflow: 'visible', // 그림자가 잘리지 않도록
              // 위젯에 특별하게 배경색 적용
              // backgroundColor: 'rgba(255, 255, 255, 0.3)',
              // backgroundColor: isBackgroundDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.3)',
              // 더 강력한 블러 효과 적용
              // backdropFilter: 'blur(20px)',
              // WebkitBackdropFilter: 'blur(20px)',
            };
          })(),
        }}
        {...(isTouchDevice && !isEditMode && onWidgetActivate ? {
          onTouchStart: (e: React.TouchEvent) => {
            if (e.touches.length > 0) {
              widgetTapTouchStart.current = {
                time: Date.now(),
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
              };
            }
          },
          onTouchEnd: (e: React.TouchEvent) => {
            const t = widgetTapTouchStart.current;
            widgetTapTouchStart.current = null;
            if (!t || !onWidgetActivate || isEditMode || isDragging || isResizing) return;
            const duration = Date.now() - t.time;
            const touch = e.changedTouches?.[0];
            const moved = touch
              ? Math.abs(touch.clientX - t.x) > 10 || Math.abs(touch.clientY - t.y) > 10
              : false;
            if (duration >= 250 || moved) return;
            const el = touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null;
            if (el?.closest('button, a, input, textarea, select, [role="button"]')) return;
            e.preventDefault(); // 합성 click 방지 (한 번만 확대되도록)
            const originRect = widgetRef.current?.getBoundingClientRect();
            onWidgetActivate(widget, originRect ?? undefined);
          },
        } : {})}
        onClick={(e) => {
          if (isEditMode) {
            // 편집 모드: 클릭한 요소가 인터랙티브한지 확인
            const target = e.target as HTMLElement;
            const isInteractive = target.closest('button, a, input, textarea, select, [role="button"]');
            
            if (!isInteractive) {
              // 위젯 long press로 방금 편집 모드에 진입한 경우 Safari의 자동 click 이벤트 무시
              if (justEnteredEditModeFromWidget && justEnteredEditModeFromWidget()) {
                e.stopPropagation();
                return;
              }
              // 빈 공간 클릭 → 이벤트 전파 → 편집 모드 종료
              return;
            }
            // 인터랙티브 요소 클릭 → 전파 차단 (실수 방지)
            e.stopPropagation();
          } else {
            // 일반 모드: 위젯 기능 정상 작동
            // 클릭한 요소가 인터랙티브한지 확인 (버튼, 링크 등)
            const target = e.target as HTMLElement;
            const isInteractive = target.closest('button, a, input, textarea, select, [role="button"]');
            
            // 인터랙티브 요소를 클릭한 경우 위젯 확대 방지
            if (isInteractive) {
            e.stopPropagation();
              return;
            }
            
            // 빈 공간 클릭 시에만 위젯 확대
            e.stopPropagation();
            if (!isDragging && !isResizing && onWidgetActivate) {
              const originRect = widgetRef.current?.getBoundingClientRect();
              onWidgetActivate(widget, originRect ?? undefined);
            }
          }
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
        {/* Widget label (same style as apps) */}
        <div
          className="absolute inset-x-0 -bottom-6 text-center pointer-events-none"
          style={{ color: 'rgba(255, 255, 255)', textShadow: 'none' }}
        >
          <span className="text-xs sm:text-xs font-bold inline-block px-2">
            {widget.label}
          </span>
        </div>
    </motion.div>
  );
}

// Sortable App Item Component
interface SortableAppItemProps {
  app: App & { gradient?: string; iconColor?: string; isFullAppIcon?: boolean };
  isEditMode: boolean;
  isDarkMode: boolean;
  isRemoving: boolean;
  shouldShowBadge: boolean;
  newUpdatesCount: number;
  onAppClick: (app: App) => void;
  onDeleteApp: (appId: string) => void;
  handleLongPressStart: (widgetId?: string, position?: { x: number; y: number }) => void;
  handleLongPressEnd: () => void;
  getButtonStyle: (hasBackgroundImage: boolean) => React.CSSProperties;
  getTextStyle: (hasBackgroundImage: boolean) => React.CSSProperties;
  getIconClassName: (hasBackgroundImage: boolean) => string;
  onRefReady?: (appId: string, element: HTMLDivElement | null) => void;
  isTouchDevice: boolean;
  isDock?: boolean;
  deviceType?: DeviceType;
}

function SortableAppItem({
  app,
  isEditMode,
  isDarkMode,
  isRemoving,
  shouldShowBadge,
  newUpdatesCount,
  onAppClick,
  onDeleteApp,
  handleLongPressStart,
  handleLongPressEnd,
  getButtonStyle,
  getTextStyle,
  getIconClassName,
  onRefReady,
  isTouchDevice,
  isDock = false,
  deviceType = 'desktop',
}: SortableAppItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id, disabled: !isEditMode });

  // SortableAppItem is always on home view which has background image
  const hasBackgroundImage = true;
  const iconBoxRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const appTapTouchStart = useRef<{ time: number; x: number; y: number } | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = app.icon;
  const isAddButton = app.id === 'add-app';

  // 편집 모드가 아닐 때만 long press 이벤트 핸들러 적용 (앱 아이콘/버튼 위에서도 롱프레스 허용)
  // 데스크탑에서는 마우스 이벤트 제거 (우클릭만 허용)
  const longPressHandlers = !isEditMode ? {
    ...(isTouchDevice ? {
      onTouchStart: (e: React.TouchEvent) => {
        if (e.touches.length > 0) {
          appTapTouchStart.current = {
            time: Date.now(),
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
        }
        handleLongPressStart(undefined, { x: e.touches[0].clientX, y: e.touches[0].clientY });
      },
      onTouchEnd: (e: React.TouchEvent) => {
        handleLongPressEnd();
        if (isTouchDevice && !isEditMode) {
          const t = appTapTouchStart.current;
          appTapTouchStart.current = null;
          if (t) {
            const duration = Date.now() - t.time;
            const touch = e.changedTouches?.[0];
            const moved = touch
              ? Math.abs(touch.clientX - t.x) > 10 || Math.abs(touch.clientY - t.y) > 10
              : false;
            if (duration < 250 && !moved) {
              onAppClick(app);
              e.preventDefault();
            }
          }
        }
      },
    } : {}),
    // 터치 디바이스에서만 마우스 이벤트 허용 (하이브리드 디바이스 대응)
    ...(isTouchDevice ? {
      onMouseDown: (e: React.MouseEvent) => {
        handleLongPressStart(undefined, { x: e.clientX, y: e.clientY });
      },
      onMouseUp: handleLongPressEnd,
      onMouseLeave: handleLongPressEnd,
    } : {}),
  } : {};

  const customButtonStyle = useMemo(() => {
    const base = getButtonStyle(hasBackgroundImage);
    
    if (app.isFullAppIcon) {
      return {
        ...base,
        background: 'transparent', // The SVG has its own semi-transparent background
        border: 'none',
        padding: 0,
        position: 'relative' as const,
        overflow: 'hidden' as const,
      };
    }

    // 도구 선택창(FileSelectionPopover)과 동일: getAdaptiveGlassStyleBlur() 유지 + gradient만 덮어씀, boxShadow는 글라스 inset 유지
    return {
      ...base,
      background: app.gradient || (base as React.CSSProperties).backgroundColor,
      border: 'none',
      position: 'relative' as const,
      overflow: 'hidden' as const,
    };
  }, [app.gradient, app.isFullAppIcon, getButtonStyle, hasBackgroundImage]);

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        if (onRefReady) {
          onRefReady(app.id, el);
        }
      }}
      style={{
        ...style,
        ...(isDock ? {
          height: '64px',
          minHeight: '64px',
          maxHeight: '64px',
        } : {})
      }}
      className={`flex flex-col items-center relative group ${isRemoving ? 'quick-access-app-removing' : ''} ${isDragging ? 'z-50' : ''}`}
      {...(isEditMode ? listeners : {})}
      {...(isEditMode ? attributes : {})}
      {...longPressHandlers}
    >
      <div className="relative">
        {/* Desktop Tooltip - 호버 시 표시 (데스크탑 감성) */}
        {!isEditMode && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-30 hidden lg:block shadow-xl">
            <span className="text-[10px] font-bold text-white leading-none flex items-center h-4">{app.label}</span>
            {/* Tooltip Arrow */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black rotate-45 border-r border-b border-white/10" />
          </div>
        )}

        <button
          ref={iconBoxRef}
          onClick={(e) => {
            e.stopPropagation();
            if (!isEditMode) {
              onAppClick(app);
            }
          }}
          className={`w-16 h-16 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-md ${
            isEditMode ? 'app-icon' : ''
          }`}
          style={customButtonStyle}
          aria-label={isAddButton ? 'Launchpad' : app.label}
        >
          {/* Glass Inner Gloss - 도구 선택창과 동일: 상단 좌→우 하이라이트 */}
          <div className="absolute inset-0 rounded-2xl bg-linear-to-tr from-white/25 to-transparent opacity-50 pointer-events-none z-20" />
          <div className="absolute inset-0 rounded-2xl bg-linear-to-b from-black/5 to-transparent pointer-events-none z-20" />
          
          <div 
            className={`${app.isFullAppIcon ? 'w-full h-full rounded-2xl overflow-hidden' : 'flex items-center justify-center'} relative z-10`}
            style={{}}
          >
            <Icon
              className={app.isFullAppIcon ? 'w-full h-full' : `${
                app.isCustomIcon ? 'w-7 h-7 sm:w-7 sm:h-7 *:stroke-[2.5]' : 'w-9 h-9 sm:w-9 sm:h-9 *:stroke-[2.5]'
              }`}
              style={{ 
                color: !app.isFullAppIcon ? (app.iconColor || 'white') : undefined
              }}
            />
          </div>
        </button>

        {/* Notification badge for What's New app */}
        {shouldShowBadge && (
          <span className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center transition-all duration-300 ease-out">
            <span className="text-white text-[10px] font-bold leading-none">
              {newUpdatesCount > 10 ? '10+' : newUpdatesCount}
            </span>
          </span>
        )}

        {/* Delete button - positioned outside the main button */}
        {isEditMode && !isAddButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteApp(app.id);
            }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-600 transition-colors quick-access-delete-btn z-150 cursor-pointer"
            style={{ pointerEvents: 'auto' }}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {!isDock && (
        <span
          ref={textRef}
          className={`text-xs sm:text-xs font-bold mt-1 transition-colors duration-300 text-center relative 
            lg:opacity-0 lg:group-hover:opacity-0 pointer-events-none lg:pointer-events-none`}
          style={{
            ...getTextStyle(hasBackgroundImage),
            zIndex: 10, // 버튼의 boxShadow 위에 표시되도록
          }}
        >
          {app.label}
        </span>
      )}
    </div>
  );
}


// Helper function to fix negative size values
const fixNegativeSize = (size: any): any => {
  if (!size || typeof size !== 'object') return size;
  
  // Legacy multi-device structure
  if ('mobile' in size || 'tablet' in size || 'desktop' in size) {
    const fixedLegacySize = { ...size };
    Object.keys(fixedLegacySize).forEach((device: string) => {
      const deviceSize = fixedLegacySize[device as DeviceType];
      if (deviceSize && typeof deviceSize === 'object') {
        if (deviceSize.width !== undefined && deviceSize.width < 1) {
          deviceSize.width = 1;
        }
        if (deviceSize.height !== undefined && deviceSize.height < 1) {
          deviceSize.height = 1;
        }
      }
    });
    return fixedLegacySize;
  }

  const fixedSize = { ...size };
  if (fixedSize.width !== undefined && fixedSize.width < 1) {
    fixedSize.width = 1;
  }
  if (fixedSize.height !== undefined && fixedSize.height < 1) {
    fixedSize.height = 1;
  }
  return fixedSize;
};

// Helper function to get initial skeleton count from localStorage
const getInitialSkeletonCount = (): number => {
  if (typeof window === 'undefined') return 3; // SSR fallback

  const deviceType = getEnvironmentDeviceType();
  const cacheKey = buildDeviceStorageKey(DEVICE_CACHE_KEY_PREFIX, deviceType);
  const storageKey = buildDeviceStorageKey(DEVICE_STORAGE_KEY_PREFIX, deviceType);
  
  try {
    // Check for logged-in user cache first (device-specific, fallback to legacy)
    const cached = localStorage.getItem(cacheKey) ?? localStorage.getItem(LEGACY_CACHE_KEY);
    if (cached) {
      const apps = JSON.parse(cached);
      return apps.length;
    }
    
    // Fallback to regular localStorage
    const stored = localStorage.getItem(storageKey) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (stored) {
      const apps = JSON.parse(stored);
      return apps.length;
    }
  } catch (error) {
    console.error('Failed to read skeleton count from localStorage:', error);
  }
  
  return 3; // Default fallback
};

const normalizeSlotIndex = (slotIndex: any, deviceType: DeviceType): number | undefined => {
  if (typeof slotIndex === 'number') {
    return slotIndex;
  }
  if (slotIndex && typeof slotIndex === 'object') {
    const deviceSlot = slotIndex[deviceType];
    if (typeof deviceSlot === 'number') {
      return deviceSlot;
    }
  }
  return undefined;
};

// 도크 인덱스(0~3) 정규화 - 모바일/태블릿 전용 (iOS 스타일 UI)
const normalizeDockIndex = (dockIndex: any): number | undefined => {
  if (typeof dockIndex === 'number') {
    return dockIndex;
  }
  if (dockIndex && typeof dockIndex === 'object') {
    // 태블릿도 모바일과 동일한 도크 인덱스 사용 (iOS 스타일)
    const dockValue = dockIndex['tablet'] ?? dockIndex['mobile'] ?? dockIndex['dock'];
    if (typeof dockValue === 'number') return dockValue;
  }
  return undefined;
};

const normalizeWidgetSize = (size: any, deviceType: DeviceType): { width: number; height: number } | undefined => {
  if (!size) {
    return undefined;
  }

  if (typeof size.width === 'number' && typeof size.height === 'number') {
    return fixNegativeSize(size);
  }

  const deviceSize = size?.[deviceType];
  if (deviceSize && typeof deviceSize === 'object') {
    return fixNegativeSize(deviceSize);
  }

  return undefined;
};

export function QuickAccessApps({ isDarkMode, user, onPromptClick, verticalOffset = 0, initialApps: initialAppsProp = null }: QuickAccessAppsProps) {
  const router = useRouter();

  // When parent passes initialApps, we apply them in useLayoutEffect before paint to prevent layout shift.
  const initialAppsProcessedRef = useRef(false);

  // QuickAccessApps is always on home view which has background image
  const hasBackgroundImage = true;

  // State management
  const [isEditMode, setIsEditMode] = useState(false);
  const [visibleApps, setVisibleApps] = useState<App[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [removingAppId, setRemovingAppId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!(initialAppsProp != null && Array.isArray(initialAppsProp)));
  const [migrationCompleted, setMigrationCompleted] = useState(false);

  // DnD Kit sensors - iOS/모바일 환경에서도 작동하도록 설정
  const sensors = useSensors(
    // 데스크톱용 포인터 센서
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이동 후 드래그 시작
      },
    }),
    // 모바일/터치 디바이스용 터치 센서
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms 누르고 있으면 드래그 시작 (iOS 스타일)
        tolerance: 5, // 5px 이내 움직임은 허용
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Touch swipe state for widget pagination
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [skeletonCount] = useState(getInitialSkeletonCount);

  // 반응형 위젯 그리드 설정
  const [widgetGridConfig, setWidgetGridConfig] = useState({
    columns: 2, // 한 행에 보이는 위젯 열 개수
    rows: 2,    // 한 페이지에 보이는 위젯 행 개수
    widgetsPerPage: 4, // 한 페이지 총 위젯 개수
    cellSize: 86, // 정사각형 셀 크기 (기본값)
    labelHeight: 12, // 라벨 높이 (기본값)
  });
  const [widgetPage, setWidgetPage] = useState(0);
  
  // iOS 스타일 자동 페이지 전환을 위한 상태
  const [edgeZone, setEdgeZone] = useState<'left' | 'right' | null>(null);
  const [autoPageChangeTimer, setAutoPageChangeTimer] = useState<NodeJS.Timeout | null>(null);
  const [continuousPageTimer, setContinuousPageTimer] = useState<NodeJS.Timeout | null>(null);
  const [currentPointerX, setCurrentPointerX] = useState<number | null>(null);
  const pointerListenersRef = useRef<(() => void) | null>(null);
  
  // Widget resize state
  const [resizingWidgetId, setResizingWidgetId] = useState<string | null>(null);
  const [resizeStartSize, setResizeStartSize] = useState<{ width: number; height: number } | null>(null);
  const [resizeStartPosition, setResizeStartPosition] = useState<{ x: number; y: number } | null>(null);
  const [resizeDirection, setResizeDirection] = useState<'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | null>(null);
  const [resizeStartSlotIndex, setResizeStartSlotIndex] = useState<number | null>(null);
  // Continuous resize preview state (pixel-based, not snapped to grid)
  const [resizePreview, setResizePreview] = useState<{
    pixelWidth: number;
    pixelHeight: number;
  } | null>(null);
  // Track if mouse/touch has actually moved during resize (prevents initial jump)
  const [hasResizeMovement, setHasResizeMovement] = useState(false);
  
  // 헬퍼 함수: 리사이즈 방향에 따른 CSS 정렬 값 반환 (비활성 축은 'stretch' 유지)
  const getResizeAlignment = useCallback((direction: string | null) => {
    if (!direction) return { justifySelf: undefined, alignSelf: undefined };
    
    return {
      // 가로축: 'w'면 우측고정(end), 'e'면 좌측고정(start), 둘 다 아니면(상하 이동 중) stretch(꽉 채움)
      justifySelf: direction.includes('w') ? 'end' : (direction.includes('e') ? 'start' : 'stretch'),
      // 세로축: 'n'이면 하단고정(end), 's'면 상단고정(start), 둘 다 아니면(좌우 이동 중) stretch(꽉 채움)
      alignSelf: direction.includes('n') ? 'end' : (direction.includes('s') ? 'start' : 'stretch'),
    };
  }, []);
  
  // Widget drag state - 원래 크기 저장 (드래그 중 1x1 미리보기용)
  const [draggedWidgetOriginalSize, setDraggedWidgetOriginalSize] = useState<{ width: number; height: number } | null>(null);
  const [fullscreenWidgetId, setFullscreenWidgetId] = useState<string | null>(null);
  const fullscreenWidget = useMemo(() => {
    if (!fullscreenWidgetId) return null;
    const found = visibleApps.find((app) => app.id === fullscreenWidgetId);
    if (found) return found;
    // Opened from Trending app: widget may not be on home. Build from registry.
    if (fullscreenWidgetId === 'glass-trends-widget') {
      const meta = ALL_APPS.find((a) => a.id === 'glass-trends-widget');
      if (meta) {
        return {
          id: meta.id,
          label: meta.label,
          icon: meta.icon,
          path: meta.path,
          isWidget: true,
        } as App;
      }
    }
    return null;
  }, [fullscreenWidgetId, visibleApps]);
  const closeFullscreenWidget = useCallback(() => {
    setFullscreenWidgetId(null);
  }, []);
  const handleVisionWidgetActivate = useCallback(
    (widget: App) => {
      if (!widget.isWidget) return;
      if (isEditMode || resizingWidgetId === widget.id || activeWidgetId === widget.id) {
        return;
      }
      if (justFinishedDrag.current || justFinishedResize.current) {
        return;
      }
      setFullscreenWidgetId(widget.id);
    },
    [activeWidgetId, isEditMode, resizingWidgetId]
  );

  useEffect(() => {
    if (!fullscreenWidgetId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeFullscreenWidget();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeFullscreenWidget, fullscreenWidgetId]);

  useEffect(() => {
    if (!fullscreenWidgetId) return;
    if (typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreenWidgetId]);

  useEffect(() => {
    if (!fullscreenWidgetId) return;
    const exists = visibleApps.some((app) => app.id === fullscreenWidgetId);
    // Keep modal open when opened from Trending app (glass-trends-widget has fallback from ALL_APPS)
    if (!exists && fullscreenWidgetId !== 'glass-trends-widget') {
      setFullscreenWidgetId(null);
    }
  }, [fullscreenWidgetId, visibleApps]);

  // 화면 크기에 따른 위젯 그리드 최적화 계산 (앱 그리드와 동일)
  useEffect(() => {
    const calculateOptimalWidgetGrid = () => {
      if (typeof window === 'undefined') return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // 앱 그리드 기준 설정 (앱과 완전히 동일)
      // 모바일: 4열 그리드, gap-1 (4px)
      // 데스크탑: 앱 아이콘 크기 기준 (64px 아이콘 + 텍스트 = 약 86px)
      const APP_ICON_SIZE = 64; // 앱 아이콘 크기
      const APP_TEXT_HEIGHT = 22; // 앱 텍스트 높이 (약 14px + 마진)
      const APP_CELL_HEIGHT = APP_ICON_SIZE + APP_TEXT_HEIGHT; // 앱 셀 높이 (약 86px)
      const APP_CELL_WIDTH_MOBILE = '1fr'; // 모바일: 그리드 자동 계산
      const horizontalPadding = 96; // 좌우 패딩 (화살표 공간 포함)
      
      // 헤더 높이 상수 정의
      const HEADER_HEIGHT_MOBILE = 56; // h-14 = 56px
      const HEADER_HEIGHT_DESKTOP = 32; // h-8 = 32px
      const HEADER_MARGIN = 0;
      const HEADER_BUTTONS_OFFSET_MOBILE = 24;
      const BOTTOM_BAR_HEIGHT_MOBILE = 0;
      const MOBILE_HEIGHT_TOLERANCE = 24;
      
      // 디바이스 타입 감지 - getEnvironmentDeviceType 사용
      const deviceType = getEnvironmentDeviceType();
      
      // 모바일 (iPhone 등 작은 화면) - 4열 그리드
      if (deviceType === 'mobile') {
        const mobileGap = 28; // gap-7 (28px) - 그리드 간격 추가 확대 (24 -> 28)
        const labelHeight = 12; // 앱/위젯 제목 높이 (공간 최적화 반영)
        const availableWidth = width - 32; // 모바일 좌우 패딩 축소 (48 -> 32)
        
        // 앱과 동일: 4열 고정
        const cols = 4;
        
        // 기본 정사각형 셀 크기 계산 (가로 기준)
        const baseCellWidth = (availableWidth - (cols - 1) * mobileGap) / cols;
        
        // 화면 높이에 맞는 동적 행 수 계산 (하단 앱 영역 보장)
        const headerHeight = 0; // 헤더는 별도 레이어이므로 높이 계산에서 제외
        
        // 하단 앱 영역 높이 계산 (도크 아이콘 + 텍스트 + 간격)
        // 앱 아이콘(64) + 텍스트(22) + 여백(약 14) = 약 100px
        const bottomAppAreaMaxHeight = 110; 
        const chatInputHeight = 0; // 채팅 인풋창 최소 높이
        const margins = verticalOffset; // 부모에서 전달된 상하 여백 반영 (pt-4 등)
        const widgetAppGap = 4; // 위젯 그리드와 앱 영역 사이 간격 최소화 (8 -> 4)
        
        // 사용 가능한 높이 계산 (안전 마진 포함)
        const availableHeight = height - headerHeight - bottomAppAreaMaxHeight - chatInputHeight - margins - widgetAppGap;
        
        // 각 행의 실제 높이 = 셀 크기 + 라벨 높이
        const rowTotalHeight = baseCellWidth + labelHeight;
        
        // 가로 기준 셀 크기로 가능한 행 수 추정 (라벨 높이 포함)
        const maxRowsByBase = Math.max(1, Math.floor((availableHeight + mobileGap) / (rowTotalHeight + mobileGap)));
        // 최소 4행, 최대 10행까지 확장 허용
        const rows = Math.max(4, Math.min(10, maxRowsByBase));
        
        // 세로 높이에 맞춰 셀 크기 축소 (도크/입력창 가림 방지)
        // 라벨 높이를 제외한 순수 셀 영역만 계산
        const heightForCells = Math.max(60, availableHeight - (rows - 1) * mobileGap - rows * labelHeight);
        const cellSize = Math.min(baseCellWidth, heightForCells / rows);
        
        const widgetsPerPage = cols * rows;
        
        setWidgetGridConfig({
          columns: cols,
          rows,
          widgetsPerPage,
          cellSize, // 정사각형 셀 크기 저장 (라벨 높이 미포함)
          labelHeight, // 라벨 높이 저장
        });
      } else if (deviceType === 'tablet') {
        // 태블릿 (iPad 등) - iOS 스타일 UI + 6-8열 그리드
        const tabletGap = 16; // 태블릿은 약간 더 넓은 간격
        const labelHeight = 14; // 앱/위젯 제목 높이
        const availableWidth = width - 48; // 태블릿 좌우 패딩
        
        // iPad 화면 너비에 따라 6-8열 동적 계산
        const cols = width >= 1024 ? 8 : 6;
        
        // 기본 정사각형 셀 크기 계산 (가로 기준)
        const baseCellWidth = (availableWidth - (cols - 1) * tabletGap) / cols;
        
        // 화면 높이에 맞는 동적 행 수 계산 (하단 도크 영역 보장)
        const headerHeight = 0; // 헤더는 별도 레이어이므로 높이 계산에서 제외
        
        // 하단 도크 영역 높이 계산 (도크 아이콘 + 텍스트 + 간격)
        const bottomAppAreaMaxHeight = 120; // 태블릿 도크 영역
        const margins = verticalOffset; // 부모에서 전달된 상하 여백 반영
        const widgetAppGap = 8; // 위젯 그리드와 도크 사이 간격
        
        // 사용 가능한 높이 계산 (안전 마진 포함)
        const availableHeight = height - headerHeight - bottomAppAreaMaxHeight - margins - widgetAppGap;
        
        // 각 행의 실제 높이 = 셀 크기 + 라벨 높이
        const rowTotalHeight = baseCellWidth + labelHeight;
        
        // 가로 기준 셀 크기로 가능한 행 수 추정 (라벨 높이 포함)
        const maxRowsByBase = Math.max(1, Math.floor((availableHeight + tabletGap) / (rowTotalHeight + tabletGap)));
        // 최소 4행, 최대 8행까지 확장 허용
        const rows = Math.max(4, Math.min(8, maxRowsByBase));
        
        // 세로 높이에 맞춰 셀 크기 축소 (도크 가림 방지)
        const heightForCells = Math.max(60, availableHeight - (rows - 1) * tabletGap - rows * labelHeight);
        const cellSize = Math.min(baseCellWidth, heightForCells / rows);
        
        const widgetsPerPage = cols * rows;
        
        setWidgetGridConfig({
          columns: cols,
          rows,
          widgetsPerPage,
          cellSize, // 정사각형 셀 크기 저장 (라벨 높이 미포함)
          labelHeight, // 라벨 높이 저장
        });
      } else {
        const availableWidth = width - horizontalPadding;
        
        // 예전 로직: minWidgetWidth, minWidgetHeight, gap 기반
        const minWidgetWidth = 260;
        const minWidgetHeight = 180;
        const desktopGap = width >= 1024 ? 28 : 16;
        
        const chatInputHeight = 200;
        const bottomMargin = 20;
        const headerHeightWithMargin = HEADER_HEIGHT_DESKTOP + HEADER_MARGIN;
        const availableHeight = height - headerHeightWithMargin - chatInputHeight - bottomMargin;
        
        const maxCols = Math.floor((availableWidth + desktopGap) / (minWidgetWidth + desktopGap));
        let cols = Math.max(2, maxCols);
        if (width < 1536) {
          cols = Math.min(cols, 3);
        } else {
          cols = Math.min(cols, 4);
        }
        
        const maxRows = Math.floor((availableHeight + desktopGap) / (minWidgetHeight + desktopGap));
        const rows = Math.max(2, Math.min(4, maxRows));
        
        setWidgetGridConfig({
          columns: cols,
          rows: rows,
          widgetsPerPage: cols * rows,
          cellSize: 86, // 기본값 (모바일에서만 사용)
          labelHeight: 0, // 데스크탑에서는 라벨이 위젯 내부에 포함됨
        });
      }
    };
    
    calculateOptimalWidgetGrid();
    window.addEventListener('resize', calculateOptimalWidgetGrid);
    return () => window.removeEventListener('resize', calculateOptimalWidgetGrid);
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (autoPageChangeTimer) {
        clearTimeout(autoPageChangeTimer);
      }
      if (continuousPageTimer) {
        clearInterval(continuousPageTimer);
      }
    };
  }, [autoPageChangeTimer, continuousPageTimer]);

  // Handle click on empty space to exit edit mode
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (!isEditMode) return;
    
    // 리사이즈/드래그 작업 중이거나 완료 직후인 경우 편집 모드 종료 방지
    if (resizingWidgetId || activeWidgetId || activeAppId || justFinishedResize.current || justFinishedDrag.current) {
      return;
    }
    
    const target = e.target as HTMLElement;
    // 클릭이 버튼/링크 등 인터랙티브 요소 위에서 발생한 경우 편집 모드 유지 (버튼 동작 보장)
    if (target.closest('button, a, input, textarea, select, [role="button"]')) return;
    
    // 위젯 컨테이너에서 발생한 클릭이고, 방금 위젯 long press로 편집 모드에 진입한 경우 무시
    const isWidgetContainer = target.closest('[data-widget-container]');
    if (isWidgetContainer && justEnteredEditModeFromWidget.current) {
      // Safari의 touchEnd -> click 자동 이벤트 무시
      return;
    }
    
    setIsEditMode(false);
  }, [isEditMode, resizingWidgetId, activeWidgetId, activeAppId]);

  // Touch handling for widget carousel
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    // 리사이즈 중이거나 드래그 중일 때는 페이지 전환 무시
    if (resizingWidgetId || activeWidgetId || activeAppId) return;
    
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // 리사이즈 중이거나 드래그 중일 때는 페이지 전환 무시
    if (resizingWidgetId || activeWidgetId || activeAppId) return;
    
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    // 리사이즈 중이거나 드래그 중일 때는 페이지 전환 무시
    if (resizingWidgetId || activeWidgetId || activeAppId) return;
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    const gridItemsForSwipe = visibleApps.filter(app => app.isWidget || app.dockIndex === undefined);

    // Calculate total pages based on maximum slotIndex (디바이스별)
    // 위젯이 확대되었을 때 차지하는 모든 슬롯 중 최대값 고려
    const deviceType = getDeviceType();
    let maxSlotIndex = -1;
    gridItemsForSwipe.forEach(item => {
      const slotIndex = item.slotIndex;
      if (slotIndex !== undefined) {
        const occupied = getWidgetOccupiedSlots(item, deviceType, widgetGridConfig);
        if (occupied.length > 0) {
          const maxOccupied = Math.max(...occupied);
          maxSlotIndex = Math.max(maxSlotIndex, maxOccupied);
        } else {
          maxSlotIndex = Math.max(maxSlotIndex, slotIndex);
        }
      }
    });

    const totalPages = maxSlotIndex >= 0 
      ? Math.floor(maxSlotIndex / widgetGridConfig.widgetsPerPage) + 1 
      : 0;
    
    if (totalPages > 0) {
      if (isLeftSwipe) {
        setWidgetPage(prev => (prev + 1) % totalPages);
      }
      if (isRightSwipe) {
        setWidgetPage(prev => (prev - 1 + totalPages) % totalPages);
      }
    }
  };
  
  // Notification state for What's New badge
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const [newUpdatesCount, setNewUpdatesCount] = useState(0);
  const [updates, setUpdates] = useState<FeatureUpdate[]>([]);
  const [isUpdatesLoading, setIsUpdatesLoading] = useState(true);
  const [hasEverBeenOpened, setHasEverBeenOpened] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [badgeReady, setBadgeReady] = useState(false);
  const { lastSeenUpdateId, lastSeenTimestamp, updateLastSeen, isLoaded } = useLastSeenUpdate();
  const supabase = createClient();
  
  // Onboarding tooltip refs - centralized component manages this internally
  const onboardingTooltipTargetsRef = useRef<Map<string, HTMLElement>>(new Map());
  
  // Long press detection
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressDelay = 900;
  const LONG_PRESS_MOVE_THRESHOLD = 15;
  const longPressStartPosition = useRef<{ x: number; y: number } | null>(null);
  const longPressMoveCleanup = useRef<(() => void) | null>(null);
  
  // Widget long press tracking (for Safari touchEnd -> click prevention)
  const justEnteredEditModeFromWidget = useRef(false);
  const longPressWidgetId = useRef<string | null>(null);
  
  // Prevent edit mode cancellation immediately after resize/drag operations
  const justFinishedResize = useRef(false);
  const justFinishedDrag = useRef(false);
  
  // Callback to handle ref ready for onboarding tooltips
  const handleOnboardingRefReady = useCallback((appId: string, element: HTMLDivElement | null) => {
    if (element) {
      onboardingTooltipTargetsRef.current.set(appId, element);
    }
  }, []);

  // Check if user has ever opened the What's New panel before
  useEffect(() => {
    try {
      const hasOpened = localStorage.getItem('hasOpenedWhatsNew');
      setHasEverBeenOpened(hasOpened === 'true');
    } catch (error) {
      console.error('Error reading hasOpenedWhatsNew from localStorage:', error);
    }
  }, []);

  // Fetch updates from Supabase
  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        const { data, error } = await supabase
          .from('feature_updates')
          .select('id, created_at')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching updates:', error);
          return;
        }

        const formattedUpdates: FeatureUpdate[] = data.map(update => ({
          id: update.id,
          title: '', // Not needed for count
          description: '', // Not needed for count
          date: '', // Not needed for count
          timestamp: new Date(update.created_at).getTime(),
          images: [],
        }));
        
        setUpdates(formattedUpdates);
      } catch (error) {
        console.error('Error in fetchUpdates:', error);
      } finally {
        setIsUpdatesLoading(false);
      }
    };

    fetchUpdates();
  }, [supabase]);
  
  // Check if there are updates the user hasn't seen
  useEffect(() => {
    // 모든 데이터가 로드될 때까지 기다림
    if (!isLoaded || isUpdatesLoading) return;

    const checkForNewUpdates = () => {
      console.log('QuickAccessApps: Checking for new updates', {
        isLoaded,
        isUpdatesLoading,
        updatesLength: updates.length,
        lastSeenUpdateId,
        lastSeenTimestamp,
      });

      // 업데이트가 없는 경우
      if (updates.length === 0) {
        console.log('QuickAccessApps: No updates available');
        setNewUpdatesCount(0);
        setHasNewUpdates(false);
        setShowBadge(false);
        return;
      }

      // localStorage에서 익명 사용자의 마지막 확인 시간을 가져옴
      let anonymousLastSeen = 0;
      try {
        const stored = localStorage.getItem('lastSeenUpdateTimestamp');
        if (stored) {
          anonymousLastSeen = parseInt(stored, 10);
        }
      } catch (error) {
        console.error('Error reading localStorage:', error);
      }

      // 로그인된 사용자와 익명 사용자 모두 고려
      const effectiveLastSeenTimestamp = Math.max(lastSeenTimestamp, anonymousLastSeen);
      
      console.log('QuickAccessApps: Effective timestamps', {
        lastSeenTimestamp,
        anonymousLastSeen,
        effectiveLastSeenTimestamp
      });
      
      if (!lastSeenUpdateId && effectiveLastSeenTimestamp === 0 && !hasEverBeenOpened) {
        // 첫 방문자 - 모든 업데이트를 새 것으로 표시하지 않음 (사용자 경험 개선)
        console.log('QuickAccessApps: First time visitor - no notifications');
        setNewUpdatesCount(0);
        setHasNewUpdates(false);
        setShowBadge(false);
      } else {
        const lastSeenUpdate = updates.find(update => update.id === lastSeenUpdateId);
        
        if (!lastSeenUpdate) {
          const newUpdates = updates.filter(update => update.timestamp > effectiveLastSeenTimestamp);
          console.log('QuickAccessApps: New updates found by timestamp', {
            newUpdatesCount: newUpdates.length,
            totalUpdates: updates.length
          });
          setNewUpdatesCount(newUpdates.length);
          const hasUpdates = newUpdates.length > 0;
          setHasNewUpdates(hasUpdates);
          setShowBadge(hasUpdates);
        } else {
          const newUpdates = updates.filter(
            update => update.timestamp > lastSeenUpdate.timestamp
          );
          console.log('QuickAccessApps: New updates found by update ID', {
            newUpdatesCount: newUpdates.length,
            totalUpdates: updates.length
          });
          setNewUpdatesCount(newUpdates.length);
          const hasUpdates = newUpdates.length > 0;
          setHasNewUpdates(hasUpdates);
          setShowBadge(hasUpdates);
        }
      }
      
      // 배지 준비 상태를 약간 지연시켜 깜빡임 방지
      setTimeout(() => {
        setBadgeReady(true);
      }, 100);
      
      console.log('QuickAccessApps: Initialization complete');
    };

    checkForNewUpdates();
  }, [lastSeenUpdateId, lastSeenTimestamp, isLoaded, updates, isUpdatesLoading, hasEverBeenOpened]);

  // Listen for whatsNewViewed events from other components
  useEffect(() => {
    const handleWhatsNewViewed = (event: CustomEvent) => {
      const { updateId, timestamp } = event.detail;
      
      // Update local state to reflect that updates have been viewed
      setHasNewUpdates(false);
      setNewUpdatesCount(0);
      setShowBadge(false);
      
      console.log('QuickAccessApps: Received whatsNewViewed event', { updateId, timestamp });
    };

    window.addEventListener('whatsNewViewed', handleWhatsNewViewed as EventListener);
    
    return () => {
      window.removeEventListener('whatsNewViewed', handleWhatsNewViewed as EventListener);
    };
  }, []);

  // Available apps configuration
  const allAvailableApps: App[] = [...ALL_APPS];

  // Device type for storage/API: viewport-based (getEnvironmentDeviceType), not a stable device ID.
  const getDeviceType = (): DeviceType => {
    return getEnvironmentDeviceType();
  };

  // 터치 디바이스 감지 (데스크탑에서 마우스 long press 비활성화용)
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    const checkTouchDevice = () => {
      if (typeof window === 'undefined') {
        setIsTouchDevice(false);
        return;
      }
      // 터치 이벤트 지원 여부 또는 포인터 타입이 coarse(터치)인지 확인
      const hasTouch = 'ontouchstart' in window || 
                       (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
                       window.matchMedia('(pointer: coarse)').matches;
      setIsTouchDevice(hasTouch);
    };
    
    checkTouchDevice();
    // 미디어 쿼리 변경 감지
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const handleChange = () => checkTouchDevice();
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // 위젯의 기본 크기 가져오기
  // 모바일/태블릿: 항상 4x2 고정 (저장값 무시, 리사이즈 없음). 데스크탑: 예전 로직 (1x1 허용)
  const getWidgetSize = useCallback((widget: App): { width: number; height: number } => {
    const deviceType = getDeviceType();
    const isMobileOrTablet = deviceType !== 'desktop';
    if (isMobileOrTablet) {
      return { width: 4, height: 2 };
    }
    const size = widget.size;
    if (size) {
      return { width: size.width, height: size.height };
    }
    return { width: 1, height: 1 };
  }, []);

  // 모바일 그리드 재배치 유틸 (앱/위젯 혼합, 좌→우, 상→하, 페이지 순)
  const packMobileGridItems = useCallback((items: App[], config = widgetGridConfig): App[] => {
    const { columns, rows, widgetsPerPage } = config;
    // 안정된 정렬: slotIndex 오름차순, 없으면 뒤로, 동일하면 원래 순서
    const sorted = items.map((item, idx) => ({ item, idx })).sort((a, b) => {
      const sa = typeof a.item.slotIndex === 'number' ? a.item.slotIndex! : Number.MAX_SAFE_INTEGER;
      const sb = typeof b.item.slotIndex === 'number' ? b.item.slotIndex! : Number.MAX_SAFE_INTEGER;
      if (sa === sb) return a.idx - b.idx;
      return sa - sb;
    });

    const used = new Set<number>();
    const placed: App[] = [];
    const maxIter = 20000; // 안전 제한

    const findFirstFit = (startSlot: number, size: { width: number; height: number }) => {
      for (let slot = Math.max(0, startSlot); slot < maxIter; slot++) {
        const pageStart = Math.floor(slot / widgetsPerPage) * widgetsPerPage;
        const localIdx = slot - pageStart;
        const localRow = Math.floor(localIdx / columns);
        const localCol = localIdx % columns;
        if (localRow + size.height > rows || localCol + size.width > columns) continue;

        const occupied: number[] = [];
        for (let r = 0; r < size.height; r++) {
          for (let c = 0; c < size.width; c++) {
            occupied.push(pageStart + (localRow + r) * columns + (localCol + c));
          }
        }
        const fits = occupied.every(s => !used.has(s));
        if (fits) return { slot, occupied };
      }
      return null;
    };

    let cursor = 0;
    sorted.forEach(({ item }) => {
      const size = item.isWidget ? getWidgetSize(item) : { width: 1, height: 1 };
      const start = typeof item.slotIndex === 'number' ? item.slotIndex : cursor;
      const fit = findFirstFit(start, size) || findFirstFit(0, size);
      if (fit) {
        fit.occupied.forEach(s => used.add(s));
        placed.push({ ...item, slotIndex: fit.slot });
        cursor = fit.slot;
      } else {
        placed.push(item);
      }
    });

    return placed;
  }, [getWidgetSize, widgetGridConfig]);

  // 모바일/태블릿 화면에서 위젯 크기를 그리드 경계에 맞게 조정
  const adjustWidgetSizeForGrid = useCallback((
    widget: App,
    deviceType: DeviceType,
    widgetGridConfig: { columns: number; rows: number; widgetsPerPage: number }
  ): App => {
    // 모바일/태블릿에서만 조정 (데스크탑은 그대로)
    if (deviceType === 'desktop') {
      return widget;
    }

    const currentSize = getWidgetSize(widget);
    const { columns, rows } = widgetGridConfig;

    // 위젯 크기가 그리드 경계를 초과하는지 확인
    const needsAdjustment = currentSize.width > columns || currentSize.height > rows;

    if (!needsAdjustment) {
      return widget;
    }

    // 크기를 그리드 경계에 맞게 조정 (모바일/태블릿: 최소 4x2 유지)
    const adjustedWidth = Math.max(4, Math.min(currentSize.width, columns));
    const adjustedHeight = Math.max(2, Math.min(currentSize.height, rows));

    // 크기가 변경된 경우에만 위젯 업데이트
    if (adjustedWidth !== currentSize.width || adjustedHeight !== currentSize.height) {
      return {
        ...widget,
        size: {
          width: adjustedWidth,
          height: adjustedHeight,
        },
      };
    }

    return widget;
  }, [getWidgetSize]);

  // 위젯이 차지하는 모든 슬롯 인덱스 배열 반환 (전역 좌표)
  const getWidgetOccupiedSlots = useCallback((
    widget: App,
    deviceType: DeviceType,
    widgetGridConfig: { columns: number; rows: number; widgetsPerPage: number }
  ): number[] => {
    const slotIndex = widget.slotIndex;
    if (slotIndex === undefined) return [];
    
    const size = widget.isWidget ? getWidgetSize(widget) : { width: 1, height: 1 };
    const { columns, rows, widgetsPerPage } = widgetGridConfig;
    const occupiedSlots: number[] = [];
    
    // 전역 slotIndex를 페이지별 로컬 좌표로 변환
    const currentPage = Math.floor(slotIndex / widgetsPerPage);
    const pageStart = currentPage * widgetsPerPage;
    const localSlotIndex = slotIndex - pageStart;
    
    // 로컬 좌표 기준으로 행/열 계산
    const localStartRow = Math.floor(localSlotIndex / columns);
    const localStartCol = localSlotIndex % columns;
    
    // 위젯이 차지하는 모든 슬롯 계산 (로컬 좌표 기준)
    for (let row = 0; row < size.height; row++) {
      for (let col = 0; col < size.width; col++) {
        const localCurrentRow = localStartRow + row;
        const localCurrentCol = localStartCol + col;
        
        // 페이지 내 경계 체크 (로컬 좌표 기준)
        if (localCurrentRow < rows && localCurrentCol < columns) {
          // 로컬 좌표를 전역 좌표로 변환
          const localSlotIdx = localCurrentRow * columns + localCurrentCol;
          const globalSlotIdx = pageStart + localSlotIdx;
          occupiedSlots.push(globalSlotIdx);
        }
      }
    }
    
    return occupiedSlots;
  }, [getWidgetSize]);

  // 위젯이 페이지 경계를 넘지 않는지 확인하는 함수
  const isWidgetWithinPageBoundaries = useCallback((
    widget: App,
    deviceType: DeviceType,
    widgetGridConfig: { columns: number; rows: number; widgetsPerPage: number }
  ): boolean => {
    const occupiedSlots = getWidgetOccupiedSlots(widget, deviceType, widgetGridConfig);
    if (occupiedSlots.length === 0) return true;
    
    const { widgetsPerPage } = widgetGridConfig;
    const firstSlot = occupiedSlots[0];
    const lastSlot = occupiedSlots[occupiedSlots.length - 1];
    const firstPage = Math.floor(firstSlot / widgetsPerPage);
    const lastPage = Math.floor(lastSlot / widgetsPerPage);
    
    // 모든 슬롯이 같은 페이지에 있는지 확인
    return firstPage === lastPage;
  }, [getWidgetOccupiedSlots]);

  // 위젯을 다음 페이지의 빈 슬롯에 배치하는 함수 (연쇄적 밀어내기 지원)
  const moveWidgetToNextPage = useCallback((
    widget: App,
    currentPage: number,
    deviceType: DeviceType,
    widgetGridConfig: { columns: number; rows: number; widgetsPerPage: number },
    allWidgets: App[],
    cascadedMoves: Array<{ widget: App; newSlotIndex: number; newPage: number }> = []
  ): { slotIndex: number; page: number; cascadedMoves: Array<{ widget: App; newSlotIndex: number; newPage: number }> } | null => {
    const { columns, rows, widgetsPerPage } = widgetGridConfig;
    const widgetSize = getWidgetSize(widget);
    const isMobileOrTablet = deviceType !== 'desktop';
    const defaultWidgetSize = isMobileOrTablet ? { width: 4, height: 2 } : { width: 1, height: 1 };
    const minSize = isMobileOrTablet ? 2 : 1;
    const size = widgetSize.width >= minSize && widgetSize.height >= minSize ? widgetSize : defaultWidgetSize;
    
    // 다음 페이지부터 시작하여 빈 슬롯 찾기
    let searchPage = currentPage + 1;
    const maxPages = 10; // 최대 10페이지까지 검색
    
    while (searchPage < maxPages) {
      const pageStart = searchPage * widgetsPerPage;
      const pageEnd = pageStart + widgetsPerPage;
      
      // 현재 페이지의 모든 위젯이 차지하는 슬롯 계산 (이미 이동된 위젯 제외)
      const usedSlots = new Set<number>();
      allWidgets.forEach(w => {
        if (w.slotIndex !== undefined && w.id !== widget.id) {
          // 이미 연쇄 이동으로 처리된 위젯은 제외
          const isAlreadyMoved = cascadedMoves.some(m => m.widget.id === w.id);
          if (isAlreadyMoved) {
            // 이미 이동된 위젯의 새 위치 사용
            const moveInfo = cascadedMoves.find(m => m.widget.id === w.id);
            if (moveInfo) {
              const occupiedSlots = getWidgetOccupiedSlots(
                { ...w, slotIndex: moveInfo.newSlotIndex },
                deviceType,
                widgetGridConfig
              );
              occupiedSlots.forEach(slot => {
                if (slot >= pageStart && slot < pageEnd) {
                  usedSlots.add(slot);
                }
              });
            }
          } else {
            // 아직 이동되지 않은 위젯의 현재 위치 사용
            const occupiedSlots = getWidgetOccupiedSlots(w, deviceType, widgetGridConfig);
            occupiedSlots.forEach(slot => {
              if (slot >= pageStart && slot < pageEnd) {
                usedSlots.add(slot);
              }
            });
          }
        }
      });
      
      // 현재 페이지에서 빈 슬롯 찾기
      let newSlotIndex = pageStart + (deviceType === 'desktop' ? 1 : 0);
      const pageEndLocal = pageEnd;
      let foundSlot = false;
      
      while (newSlotIndex < pageEndLocal) {
        const localSlotIndex = newSlotIndex - pageStart;
        const localRow = Math.floor(localSlotIndex / columns);
        const localCol = localSlotIndex % columns;
        
        // 현재 페이지의 행 수를 초과하지 않는지 확인
        if (localRow + size.height > rows) {
          break; // 현재 페이지에 공간이 없음
        }
        
        // 위젯이 차지할 모든 슬롯 계산
        const widgetOccupiedSlots: number[] = [];
        for (let row = 0; row < size.height; row++) {
          for (let col = 0; col < size.width; col++) {
            const slotRow = localRow + row;
            const slotCol = localCol + col;
            if (slotRow < rows && slotCol < columns) {
              const globalSlotIndex = pageStart + (slotRow * columns + slotCol);
              widgetOccupiedSlots.push(globalSlotIndex);
            }
          }
        }
        
        // 모든 슬롯이 비어있는지 확인
        const isAvailable = widgetOccupiedSlots.every(slot => !usedSlots.has(slot));
        
        if (isAvailable) {
          foundSlot = true;
          break;
        }
        
        newSlotIndex++;
      }
      
      // 빈 슬롯을 찾았으면 배치
      if (foundSlot) {
        return { slotIndex: newSlotIndex, page: searchPage, cascadedMoves };
      }
      
      // 빈 슬롯이 없으면 다음 페이지의 최하단 위젯을 먼저 밀어내기 (연쇄적)
      const widgetsInTargetPage: App[] = [];
      allWidgets.forEach(w => {
        if (w.slotIndex !== undefined && w.id !== widget.id) {
          const occupiedSlots = getWidgetOccupiedSlots(w, deviceType, widgetGridConfig);
          const isInTargetPage = occupiedSlots.some(slot => slot >= pageStart && slot < pageEnd);
          // 이미 연쇄 이동으로 처리된 위젯은 제외
          const isAlreadyMoved = cascadedMoves.some(m => m.widget.id === w.id);
          if (isInTargetPage && !isAlreadyMoved) {
            widgetsInTargetPage.push(w);
          }
        }
      });
      
      if (widgetsInTargetPage.length > 0) {
        // 최하단 위젯 찾기 (아래쪽부터)
        const bottomWidget = widgetsInTargetPage.sort((a, b) => {
          const slotA = a.slotIndex ?? 0;
          const slotB = b.slotIndex ?? 0;
          const sizeA = getWidgetSize(a);
          const sizeB = getWidgetSize(b);
          
          const localSlotA = slotA - pageStart;
          const localSlotB = slotB - pageStart;
          const rowA = Math.floor(localSlotA / columns);
          const rowB = Math.floor(localSlotB / columns);
          const bottomRowA = rowA + sizeA.height - 1;
          const bottomRowB = rowB + sizeB.height - 1;
          
          if (bottomRowA === bottomRowB) {
            return slotB - slotA; // 큰 slotIndex부터
          }
          
          return bottomRowB - bottomRowA; // 아래쪽부터
        })[0];
        
        // 최하단 위젯을 먼저 다음 페이지로 이동 (재귀적)
        const bottomWidgetPage = Math.floor((bottomWidget.slotIndex ?? 0) / widgetsPerPage);
        const cascadedResult = moveWidgetToNextPage(
          bottomWidget,
          bottomWidgetPage,
          deviceType,
          widgetGridConfig,
          allWidgets,
          cascadedMoves
        );
        
        if (cascadedResult) {
          // 연쇄 이동 결과에 추가 (중복 제거)
          const newCascadedMoves: Array<{ widget: App; newSlotIndex: number; newPage: number }> = [...cascadedMoves];
          
          // bottomWidget 추가 (중복 체크)
          if (!newCascadedMoves.some(m => m.widget.id === bottomWidget.id)) {
            newCascadedMoves.push({
              widget: bottomWidget,
              newSlotIndex: cascadedResult.slotIndex,
              newPage: cascadedResult.page
            });
          }
          
          // 재귀 결과의 cascadedMoves 추가 (중복 체크)
          cascadedResult.cascadedMoves.forEach(move => {
            if (!newCascadedMoves.some(m => m.widget.id === move.widget.id)) {
              newCascadedMoves.push(move);
            }
          });
          
          // 다시 빈 슬롯 찾기 (이제 최하단 위젯이 이동했으므로)
          const updatedUsedSlots = new Set<number>();
          allWidgets.forEach(w => {
            if (w.isWidget && w.slotIndex !== undefined && w.id !== widget.id) {
              const isAlreadyMoved = newCascadedMoves.some(m => m.widget.id === w.id);
              if (isAlreadyMoved) {
                const moveInfo = newCascadedMoves.find(m => m.widget.id === w.id);
                if (moveInfo) {
                  const occupiedSlots = getWidgetOccupiedSlots(
                    { ...w, slotIndex: moveInfo.newSlotIndex },
                    deviceType,
                    widgetGridConfig
                  );
                  occupiedSlots.forEach(slot => {
                    if (slot >= pageStart && slot < pageEnd) {
                      updatedUsedSlots.add(slot);
                    }
                  });
                }
              } else {
                const occupiedSlots = getWidgetOccupiedSlots(w, deviceType, widgetGridConfig);
                occupiedSlots.forEach(slot => {
                  if (slot >= pageStart && slot < pageEnd) {
                    updatedUsedSlots.add(slot);
                  }
                });
              }
            }
          });
          
          // 다시 빈 슬롯 찾기
          let retrySlotIndex = pageStart + (deviceType === 'desktop' ? 1 : 0);
          while (retrySlotIndex < pageEndLocal) {
            const localSlotIndex = retrySlotIndex - pageStart;
            const localRow = Math.floor(localSlotIndex / columns);
            const localCol = localSlotIndex % columns;
            
            if (localRow + size.height > rows) {
              break;
            }
            
            const widgetOccupiedSlots: number[] = [];
            for (let row = 0; row < size.height; row++) {
              for (let col = 0; col < size.width; col++) {
                const slotRow = localRow + row;
                const slotCol = localCol + col;
                if (slotRow < rows && slotCol < columns) {
                  const globalSlotIndex = pageStart + (slotRow * columns + slotCol);
                  widgetOccupiedSlots.push(globalSlotIndex);
                }
              }
            }
            
            const isAvailable = widgetOccupiedSlots.every(slot => !updatedUsedSlots.has(slot));
            
            if (isAvailable) {
              return { slotIndex: retrySlotIndex, page: searchPage, cascadedMoves: newCascadedMoves };
            }
            
            retrySlotIndex++;
          }
        }
      }
      
      // 현재 페이지에 공간이 없으면 다음 페이지로
      searchPage++;
    }
    
    return null; // 빈 슬롯을 찾지 못함
  }, [getWidgetSize, getWidgetOccupiedSlots]);

  // 위젯이 특정 방향으로 확장 가능한지 체크
  const canExpandWidget = useCallback((
    widget: App,
    direction: 'right' | 'down' | 'left' | 'up',
    deviceType: DeviceType,
    allWidgets: App[]
  ): boolean => {
    const slotIndex = widget.slotIndex;
    if (slotIndex === undefined) return false;
    
    const currentSize = getWidgetSize(widget);
    const { columns, rows } = widgetGridConfig;
    
    // 모든 위젯이 차지하는 슬롯 계산 (현재 위젯 제외)
    const allOccupiedSlots = new Set<number>();
    allWidgets.forEach(w => {
      if (w.id !== widget.id && w.isWidget && w.slotIndex !== undefined) {
        const occupied = getWidgetOccupiedSlots(w, deviceType, widgetGridConfig);
        occupied.forEach(slot => allOccupiedSlots.add(slot));
      }
    });
    
    // 현재 위젯의 위치 정보
    const startRow = Math.floor(slotIndex / columns);
    const startCol = slotIndex % columns;
    
    // 확장하려는 슬롯들 체크
    let slotsToCheck: number[] = [];
    
    if (direction === 'right') {
      // 오른쪽으로 확장: 같은 행의 오른쪽 열들
      const newCol = startCol + currentSize.width;
      if (newCol >= columns) return false; // 그리드 경계 체크
      for (let row = 0; row < currentSize.height; row++) {
        slotsToCheck.push((startRow + row) * columns + newCol);
      }
    } else if (direction === 'down') {
      // 아래로 확장: 같은 열의 아래 행들
      const newRow = startRow + currentSize.height;
      if (newRow >= rows) return false; // 그리드 경계 체크
      for (let col = 0; col < currentSize.width; col++) {
        slotsToCheck.push(newRow * columns + (startCol + col));
      }
    } else if (direction === 'left') {
      // 왼쪽으로 확장: 같은 행의 왼쪽 열
      const newCol = startCol - 1;
      if (newCol < 0) return false; // 그리드 경계 체크
      // slotIndex를 왼쪽으로 이동해야 함
      return false; // 좌상단 기준 유지하기 위해 왼쪽 확장은 불가 (구현 복잡도)
    } else if (direction === 'up') {
      // 위로 확장: 같은 열의 위 행
      const newRow = startRow - 1;
      if (newRow < 0) return false; // 그리드 경계 체크
      
      // 위로 확장하려면 slotIndex를 위로 이동해야 함
      // 새로운 slotIndex = (startRow - 1) * columns + startCol
      const newSlotIndex = newRow * columns + startCol;
      
      // 새로운 위치에서 위젯이 차지할 슬롯들 계산 (높이 +1)
      for (let row = 0; row <= currentSize.height; row++) {
        const checkRow = newRow + row;
        if (checkRow >= rows) return false; // 그리드 경계 체크
        for (let col = 0; col < currentSize.width; col++) {
          const checkCol = startCol + col;
          if (checkCol >= columns) return false; // 그리드 경계 체크
          const checkSlot = checkRow * columns + checkCol;
          slotsToCheck.push(checkSlot);
        }
      }
      
      // 새로운 slotIndex가 다른 위젯과 겹치지 않는지 확인
      // (현재 위젯의 원래 슬롯은 제외)
      const currentOccupied = getWidgetOccupiedSlots(widget, deviceType, widgetGridConfig);
      return slotsToCheck.every(slot => {
        // 현재 위젯이 차지하는 슬롯은 제외
        if (currentOccupied.includes(slot)) return true;
        // 다른 위젯이 차지하는지 확인
        return !allOccupiedSlots.has(slot);
      });
    }
    
    // 체크할 슬롯들이 모두 비어있는지 확인
    return slotsToCheck.every(slot => !allOccupiedSlots.has(slot));
  }, [getWidgetSize, getWidgetOccupiedSlots, widgetGridConfig]);

  // 위젯이 있는 마지막 페이지 계산 (디바이스별)
  const getLastPageWithWidget = useCallback((
    deviceType: DeviceType,
    widgetsList: App[]
  ): number => {
    let maxPage = -1;
    widgetsList.forEach(widget => {
      const slotIndex = widget.slotIndex;
      if (slotIndex !== undefined) {
        const occupied = getWidgetOccupiedSlots(widget, deviceType, widgetGridConfig);
        if (occupied.length > 0) {
          const maxOccupied = Math.max(...occupied);
          const page = Math.floor(maxOccupied / widgetGridConfig.widgetsPerPage);
          maxPage = Math.max(maxPage, page);
        } else {
          const page = Math.floor(slotIndex / widgetGridConfig.widgetsPerPage);
          maxPage = Math.max(maxPage, page);
        }
      }
    });
    return maxPage >= 0 ? maxPage : 0;
  }, [getWidgetOccupiedSlots, widgetGridConfig]);

  // 위젯/앱 slotIndex & dockIndex 자동 할당 (모바일/태블릿: 도크 우선, 그리드 통합)
  const assignSlotIndexes = useCallback((apps: App[]): App[] => {
    const deviceType = getDeviceType();
    // 데스크톱은 기존 로직 유지
    if (deviceType === 'desktop') {
      let widgetIndex = 1; // 데스크톱은 1부터
      return apps.map(app => {
      if (app.isWidget) {
          if (typeof app.slotIndex === 'number') return app;
        const assignedIndex = widgetIndex++;
          return { ...app, slotIndex: assignedIndex };
        }
          return app;
      });
    }

    // 모바일/태블릿: 도크(4칸) + 그리드 통합 (iOS 스타일 UI)
    const maxDock = 4;
    const dockUsed = new Set<number>();
    const result: App[] = [];

    const widgets = apps.filter(app => app.isWidget);
    const nonWidgets = apps.filter(app => !app.isWidget);

    // 1) 도크 우선 배치
    nonWidgets.forEach(app => {
      if (typeof app.dockIndex === 'number' && app.dockIndex >= 0 && app.dockIndex < maxDock && !dockUsed.has(app.dockIndex)) {
        dockUsed.add(app.dockIndex);
        result.push({ ...app, dockIndex: app.dockIndex, slotIndex: undefined });
      }
    });
    nonWidgets.forEach(app => {
      if (result.some(a => a.id === app.id)) return;
      // 이미 그리드에 둔 앱(slotIndex 있음)은 도크에 넣지 않음 (도크→그리드 이동 유지)
      if (typeof app.slotIndex === 'number') {
        result.push({ ...app, dockIndex: undefined });
        return;
      }
      if (dockUsed.size < maxDock) {
        // 남는 도크 슬롯에 채움
        const freeDock = [0,1,2,3].find(idx => !dockUsed.has(idx));
        if (freeDock !== undefined) {
          dockUsed.add(freeDock);
          result.push({ ...app, dockIndex: freeDock, slotIndex: undefined });
          return;
        }
      }
      // 도크에 못 들어가면 그리드로
      result.push({ ...app, dockIndex: undefined });
    });

    // 2) 그리드 아이템 구성 (위젯 + 도크에 못 들어간 앱)
    const gridItems: App[] = [
      ...widgets,
      ...result.filter(app => !app.isWidget && app.dockIndex === undefined),
    ].map(app => {
      if (!app.isWidget) {
        // 앱은 1x1 고정
        return { ...app, size: { width: 1, height: 1 } };
      }
      return app;
    });
    
    const columns = widgetGridConfig.columns;
    const rows = widgetGridConfig.rows;
    const maxSlots = columns * rows;

    const usedSlots = new Set<number>();
    // 이미 slotIndex가 있는 것 먼저 차지
    gridItems.forEach(app => {
      if (typeof app.slotIndex === 'number') {
        const occupied = getWidgetOccupiedSlots(app, deviceType, widgetGridConfig);
        occupied.forEach(s => usedSlots.add(s));
      }
    });

    const occupyFirstFit = (app: App): App => {
      if (typeof app.slotIndex === 'number') return app;
      const size = app.isWidget ? getWidgetSize(app) : { width: 1, height: 1 };
      for (let slot = 0; slot < maxSlots; slot++) {
        // calculate occupied for this slot
        const testApp = { ...app, slotIndex: slot };
        const occupied = getWidgetOccupiedSlots(testApp, deviceType, widgetGridConfig);
        // ensure all within page bounds
        const fits = occupied.length === size.width * size.height && occupied.every(s => !usedSlots.has(s));
        if (fits) {
          occupied.forEach(s => usedSlots.add(s));
          return { ...app, slotIndex: slot };
        }
      }
      return app;
    };

    const assignedGrid = gridItems.map(occupyFirstFit);

    // 3) 결과 병합: 도크 결과 + 그리드 결과를 ID 기준으로 덮어쓰기
    const merged = apps.map(app => {
      const gridMatch = assignedGrid.find(a => a.id === app.id);
      const dockMatch = result.find(a => a.id === app.id && a.dockIndex !== undefined);
      if (gridMatch) return { ...app, ...gridMatch, dockIndex: gridMatch.dockIndex };
      if (dockMatch) return { ...app, ...dockMatch };
      return app;
    });

    return merged;
  }, [getWidgetSize, getWidgetOccupiedSlots, widgetGridConfig]);

  // 중복 slotIndex/dockIndex 수정 (모바일: 도크 + 그리드 통합)
  const fixDuplicateSlotIndexes = useCallback((apps: App[]): App[] => {
    const deviceType = getDeviceType();

    // 데스크톱은 기존 로직 유지
    if (deviceType === 'desktop') {
      return apps;
    }

    // 1) 크기 조정 + 앱 1x1 강제
    const adjustedApps = apps.map(app => {
      if (app.isWidget) {
        return adjustWidgetSizeForGrid(app, deviceType, widgetGridConfig);
      }
      return { ...app, size: { width: 1, height: 1 } };
    });

    // 2) 도크 중복 정리 (0~3만, 초과는 그리드로)
    const maxDock = 4;
    const dockUsed = new Set<number>();
    const normalizedApps = adjustedApps.map(app => {
      if (app.isWidget) return app;
      const dock = typeof app.dockIndex === 'number' ? app.dockIndex : undefined;
      if (dock !== undefined && dock >= 0 && dock < maxDock && !dockUsed.has(dock)) {
        dockUsed.add(dock);
        return { ...app, dockIndex: dock, slotIndex: undefined };
      }
      return { ...app, dockIndex: undefined };
    });

    // 3) 그리드 재배치 (위젯 + 도크 밖 앱) - 충돌 없는 첫 슬롯 탐색
    const gridItems = normalizedApps
      .filter(app => app.isWidget || (!app.isWidget && app.dockIndex === undefined))
      // 기존 slotIndex가 있는 것부터 우선 배치
      .sort((a, b) => {
        const ai = typeof a.slotIndex === 'number' ? a.slotIndex : Number.MAX_SAFE_INTEGER;
        const bi = typeof b.slotIndex === 'number' ? b.slotIndex : Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });

    const columns = widgetGridConfig.columns;
    const rows = widgetGridConfig.rows;
    const maxSlots = columns * rows;
    const usedSlots = new Set<number>();

    const occupy = (app: App): App => {
      const size = app.isWidget ? getWidgetSize(app) : { width: 1, height: 1 };
      const trySlot = (slot: number): number | null => {
        const testApp = { ...app, slotIndex: slot };
        const occupied = getWidgetOccupiedSlots(testApp, deviceType, widgetGridConfig);
        const fits = occupied.length === size.width * size.height && occupied.every(s => !usedSlots.has(s));
        return fits ? slot : null;
      };

      if (typeof app.slotIndex === 'number') {
        const found = trySlot(app.slotIndex);
        if (found !== null) {
          getWidgetOccupiedSlots({ ...app, slotIndex: found }, deviceType, widgetGridConfig).forEach(s => usedSlots.add(s));
          return { ...app, slotIndex: found };
        }
      }

      for (let slot = 0; slot < maxSlots; slot++) {
        const found = trySlot(slot);
        if (found !== null) {
          getWidgetOccupiedSlots({ ...app, slotIndex: found }, deviceType, widgetGridConfig).forEach(s => usedSlots.add(s));
          return { ...app, slotIndex: found };
        }
      }
      return { ...app, slotIndex: app.slotIndex };
    };

    const reassignedGrid = gridItems.map(occupy);

    // 4) 결과 병합: 도크 포함 전체 리스트
    const finalApps = normalizedApps.map(app => {
      if (app.isWidget || app.dockIndex === undefined) {
        const reassigned = reassignedGrid.find(a => a.id === app.id);
        return reassigned ? reassigned : app;
          }
          return app;
        });
    
    return finalApps;
  }, [getWidgetSize, getWidgetOccupiedSlots, widgetGridConfig, adjustWidgetSizeForGrid]);

  // Save apps to API or localStorage - 위젯 위치 정보 포함 (디바이스별)
  const saveAppsToAPI = useCallback(async (apps: App[]) => {
    const deviceType = getDeviceType();
    const storageKey = buildDeviceStorageKey(DEVICE_STORAGE_KEY_PREFIX, deviceType);
    // 위젯은 slotIndex와 size 포함, 모바일 일반 앱은 slotIndex 포함
    const appsData = apps.map(app => {
      // 🔧 FIX: slotIndex가 0일 때도 저장되도록 !== undefined 사용
      if (app.isWidget && app.slotIndex !== undefined) {
        // 음수 크기 값 필터링
        const fixedSize = app.size ? fixNegativeSize(app.size) : undefined;
        return { 
          id: app.id, 
          slotIndex: app.slotIndex,
          ...(app.dockIndex !== undefined ? { dockIndex: app.dockIndex } : {}),
          ...(fixedSize ? { size: fixedSize } : {})
        };
      }
      // 모바일/태블릿에서 일반 앱 slotIndex·dockIndex 저장
      if (!app.isWidget && (deviceType === 'mobile' || deviceType === 'tablet') && app.slotIndex !== undefined) {
        return { 
          id: app.id,
          slotIndex: app.slotIndex,
          ...(app.dockIndex !== undefined ? { dockIndex: app.dockIndex } : {})
        };
      }
      // 도크에만 있는 앱 (모바일/태블릿)
      if (!app.isWidget && (deviceType === 'mobile' || deviceType === 'tablet') && app.dockIndex !== undefined) {
        return {
          id: app.id,
          dockIndex: app.dockIndex
        };
      }
      return { id: app.id };
    });

    if (user?.id) {
      try {
        const response = await fetch(`/api/quick-access-apps?deviceType=${deviceType}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apps: appsData })
        });
        
        if (!response.ok) {
          throw new Error('Failed to save to API');
        }
      } catch (error) {
        console.error('Failed to save apps to API:', error);
        throw error;
      }
    } else {
      // Anonymous user: save to localStorage
      try {
        localStorage.setItem(storageKey, JSON.stringify(appsData));
        // Clean up legacy key to avoid conflicts
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
        throw error;
      }
    }
  }, [user?.id]);

  // Apply initialApps before first paint to prevent layout shift (parent prefetched quick-access-apps).
  useLayoutEffect(() => {
    if (
      initialAppsProp == null ||
      !Array.isArray(initialAppsProp) ||
      initialAppsProcessedRef.current
    ) {
      return;
    }
    initialAppsProcessedRef.current = true;
    const deviceType = getDeviceType();
    const rawItems = initialAppsProp as (string | { id: string; slotIndex?: any; size?: any; dockIndex?: any })[];
    const apps = rawItems
      .map((item) => {
        const id = typeof item === 'string' ? item : item.id;
        if (!VALID_APP_IDS.includes(id)) return null;
        const slotIndex = typeof item === 'object' ? item.slotIndex : undefined;
        const dockIndex = typeof item === 'object' ? item.dockIndex : undefined;
        const size = typeof item === 'object' ? item.size : undefined;
        const app = allAvailableApps.find((a) => a.id === id);
        if (!app) return null;
        const appWithData: App = { ...app };
        const normalizedSlotIndex = normalizeSlotIndex(slotIndex, deviceType);
        if (normalizedSlotIndex !== undefined) appWithData.slotIndex = normalizedSlotIndex;
        const normalizedDockIndex = normalizeDockIndex(dockIndex);
        if (normalizedDockIndex !== undefined) appWithData.dockIndex = normalizedDockIndex;
        const normalizedSize = normalizeWidgetSize(size, deviceType);
        if (normalizedSize) appWithData.size = normalizedSize;
        return appWithData;
      })
      .filter(Boolean) as App[];
    const hasAddApp = apps.some((a) => a.id === 'add-app');
    const finalApps = hasAddApp ? apps : [allAvailableApps.find((a) => a.id === 'add-app')!, ...apps];
    const adjustedFinalApps = finalApps.map((app) => {
      if (app.isWidget) {
        return adjustWidgetSizeForGrid(app, deviceType, widgetGridConfig);
      }
      return app;
    });
    const appsWithSlots = assignSlotIndexes(adjustedFinalApps);
    setVisibleApps(fixDuplicateSlotIndexes(appsWithSlots));
    setIsLoading(false);
  }, [
    initialAppsProp,
    assignSlotIndexes,
    fixDuplicateSlotIndexes,
    adjustWidgetSizeForGrid,
    widgetGridConfig,
  ]);

  // Load visible apps from API or localStorage (skipped when initialApps was applied; still runs for migration)
  useEffect(() => {
    const loadVisibleApps = async () => {
      if (!(initialAppsProp != null && Array.isArray(initialAppsProp))) {
        setIsLoading(true);
      }
      const deviceType = getDeviceType();
      const storageKey = buildDeviceStorageKey(DEVICE_STORAGE_KEY_PREFIX, deviceType);
      const cacheKey = buildDeviceStorageKey(DEVICE_CACHE_KEY_PREFIX, deviceType);
      
      try {
        if (user?.id) {
          // Logged-in user: fetch from API
          const response = await fetch(`/api/quick-access-apps?deviceType=${deviceType}`);
          const data = await response.json();
          
          if (data.apps) {
            const apps = data.apps
              .map((item: string | { id: string; slotIndex?: any; size?: any; dockIndex?: any }) => {
                // 문자열이면 구버전 데이터, 객체면 신버전 데이터
                const id = typeof item === 'string' ? item : item.id;
                // VALID_APP_IDS에 없는 앱/위젯은 제외
                if (!VALID_APP_IDS.includes(id)) {
                  return null;
                }
                const slotIndex = typeof item === 'object' ? item.slotIndex : undefined;
                const dockIndex = typeof item === 'object' ? item.dockIndex : undefined;
                const size = typeof item === 'object' ? item.size : undefined;
                const app = allAvailableApps.find(a => a.id === id);
                
                if (app) {
                  const appWithData: App = { ...app };
                  
                  const normalizedSlotIndex = normalizeSlotIndex(slotIndex, deviceType);
                  if (normalizedSlotIndex !== undefined) {
                    appWithData.slotIndex = normalizedSlotIndex;
                  }
                  const normalizedDockIndex = normalizeDockIndex(dockIndex);
                  if (normalizedDockIndex !== undefined) {
                    appWithData.dockIndex = normalizedDockIndex;
                  }
                  
                  const normalizedSize = normalizeWidgetSize(size, deviceType);
                  if (normalizedSize) {
                    appWithData.size = normalizedSize;
                  }
                  
                  return appWithData;
                }
                return app;
              })
              .filter(Boolean) as App[];
            
            // add-app이 없으면 맨 앞에 추가
            const hasAddApp = apps.some(app => app.id === 'add-app');
            const finalApps = hasAddApp ? apps : [allAvailableApps.find(a => a.id === 'add-app')!, ...apps];
            
            // 작은 모바일 화면에서 위젯 크기를 그리드 경계에 맞게 조정 (조기 개입)
            const adjustedFinalApps = finalApps.map(app => {
              if (app.isWidget) {
                return adjustWidgetSizeForGrid(app, deviceType, widgetGridConfig);
              }
              return app;
            });
            
            const appsWithSlots = assignSlotIndexes(adjustedFinalApps);
            setVisibleApps(fixDuplicateSlotIndexes(appsWithSlots));
            
            // Cache the app IDs for next visit skeleton count
            try {
              localStorage.setItem(cacheKey, JSON.stringify(data.apps));
              localStorage.removeItem(LEGACY_CACHE_KEY);
            } catch (error) {
              console.warn('Failed to cache app IDs:', error);
            }
            
            // Migrate from localStorage ONLY if user doesn't have database settings yet.
            // Use only device-specific storageKey—never LEGACY_STORAGE_KEY—so we don't
            // write another device's data into the current device column (cross-device contamination).
            if (!migrationCompleted && data.source === 'default') {
              const localStored = localStorage.getItem(storageKey);
              if (localStored) {
                try {
                  let localAppIds = JSON.parse(localStored);
                  
                  // VALID_APP_IDS에 없는 앱/위젯 필터링
                  localAppIds = localAppIds.filter((item: string | { id: string }) => {
                    const id = typeof item === 'string' ? item : item.id;
                    return VALID_APP_IDS.includes(id);
                  });
                  
                  // 마이그레이션 시 add-app이 없으면 추가
                  const hasAddApp = localAppIds.some((item: string | { id: string }) => {
                    const id = typeof item === 'string' ? item : item.id;
                    return id === 'add-app';
                  });
                  
                  if (!hasAddApp) {
                    localAppIds = [{ id: 'add-app' }, ...localAppIds];
                  }
                  
                  // Migrate localStorage to database for this device only
                  await saveAppsToAPI(localAppIds);
                  localStorage.removeItem(storageKey);
                } catch (e) {
                  console.warn('Failed to migrate localStorage data:', e);
                }
              }
              setMigrationCompleted(true);
            }
          } else {
            // Fallback: use device-specific defaults from lib
            const defaultAppsData = deviceType === 'mobile' 
              ? DEFAULT_QUICK_ACCESS_APPS_MOBILE 
              : deviceType === 'tablet' 
                ? DEFAULT_QUICK_ACCESS_APPS_TABLET 
                : DEFAULT_QUICK_ACCESS_APPS_DESKTOP;
            const defaultApps = defaultAppsData
              .map((item: StoredAppType) => {
                const id = typeof item === 'string' ? item : item.id;
                return allAvailableApps.find(a => a.id === id);
              })
              .filter(Boolean) as App[];
            
            // Apply slotIndex and size from defaults
            const appsWithDefaults = defaultApps.map(app => {
              const defaultItem = defaultAppsData.find((item: StoredAppType) => {
                const itemId = typeof item === 'string' ? item : item.id;
                return itemId === app.id;
              });
              
              if (defaultItem && typeof defaultItem === 'object') {
                const appWithData: App = { ...app };
                if (defaultItem.slotIndex !== undefined) {
                  appWithData.slotIndex = normalizeSlotIndex(defaultItem.slotIndex, deviceType);
                }
                if (defaultItem.size) {
                  const normalizedSize = normalizeWidgetSize(defaultItem.size, deviceType);
                  if (normalizedSize) {
                    appWithData.size = normalizedSize;
                  }
                }
                return appWithData;
              }
              return app;
            });
            
            // 작은 모바일 화면에서 위젯 크기를 그리드 경계에 맞게 조정
            const adjustedApps = appsWithDefaults.map(app => {
              if (app.isWidget) {
                return adjustWidgetSizeForGrid(app, deviceType, widgetGridConfig);
              }
              return app;
            });
            
            const appsWithSlots = assignSlotIndexes(adjustedApps);
            setVisibleApps(fixDuplicateSlotIndexes(appsWithSlots));
            
            // Cache default apps for next visit
            try {
              localStorage.setItem(cacheKey, JSON.stringify(defaultAppsData));
              localStorage.removeItem(LEGACY_CACHE_KEY);
            } catch (error) {
              console.warn('Failed to cache default apps:', error);
            }
          }
        } else {
          // Anonymous user: fetch from API to get default apps with widgets
          try {
            const response = await fetch(`/api/quick-access-apps?deviceType=${deviceType}`);
            const data = await response.json();
            
            if (data.apps) {
              const apps = data.apps
                .map((item: string | { id: string; slotIndex?: any; size?: any; dockIndex?: any }) => {
                  // 문자열이면 구버전 데이터, 객체면 신버전 데이터
                  const id = typeof item === 'string' ? item : item.id;
                  // VALID_APP_IDS에 없는 앱/위젯은 제외
                  if (!VALID_APP_IDS.includes(id)) {
                    return null;
                  }
                  const slotIndex = typeof item === 'object' ? item.slotIndex : undefined;
                const dockIndex = typeof item === 'object' ? item.dockIndex : undefined;
                  const size = typeof item === 'object' ? item.size : undefined;
                  const app = allAvailableApps.find(a => a.id === id);
                  
                  if (app) {
                    const appWithData: App = { ...app };
                    
                    const normalizedSlotIndex = normalizeSlotIndex(slotIndex, deviceType);
                    if (normalizedSlotIndex !== undefined) {
                      appWithData.slotIndex = normalizedSlotIndex;
                    }
                  const normalizedDockIndex = normalizeDockIndex(dockIndex);
                  if (normalizedDockIndex !== undefined) {
                    appWithData.dockIndex = normalizedDockIndex;
                    }
                    
                    const normalizedSize = normalizeWidgetSize(size, deviceType);
                    if (normalizedSize) {
                      appWithData.size = normalizedSize;
                    }
                    
                    return appWithData;
                  }
                  return app;
                })
                .filter(Boolean) as App[];
              
              // add-app이 없으면 맨 앞에 추가
              const hasAddApp = apps.some(app => app.id === 'add-app');
              const finalApps = hasAddApp ? apps : [allAvailableApps.find(a => a.id === 'add-app')!, ...apps];
              
              // 작은 모바일 화면에서 위젯 크기를 그리드 경계에 맞게 조정
              const adjustedFinalApps = finalApps.map(app => {
                if (app.isWidget) {
                  return adjustWidgetSizeForGrid(app, deviceType, widgetGridConfig);
                }
                return app;
              });
              
              const appsWithSlots = assignSlotIndexes(adjustedFinalApps);
              setVisibleApps(fixDuplicateSlotIndexes(appsWithSlots));
              
              // Cache the app data for next visit
              try {
                localStorage.setItem(cacheKey, JSON.stringify(data.apps));
                localStorage.setItem(storageKey, JSON.stringify(data.apps));
                localStorage.removeItem(LEGACY_CACHE_KEY);
                localStorage.removeItem(LEGACY_STORAGE_KEY);
              } catch (error) {
                console.warn('Failed to cache app IDs:', error);
              }
            } else {
              // Fallback: use localStorage if API fails
              const stored = localStorage.getItem(storageKey) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
              if (stored) {
                const storedData = JSON.parse(stored);
                const apps = storedData
                .map((item: string | { id: string; slotIndex?: any; size?: any; dockIndex?: any }) => {
                    const id = typeof item === 'string' ? item : item.id;
                    if (!VALID_APP_IDS.includes(id)) {
                      return null;
                    }
                    const slotIndex = typeof item === 'object' ? item.slotIndex : undefined;
                    const dockIndex = typeof item === 'object' ? item.dockIndex : undefined;
                    const size = typeof item === 'object' ? item.size : undefined;
                    const app = allAvailableApps.find(a => a.id === id);
                    
                    if (app) {
                      const appWithData: App = { ...app };
                      
                      const normalizedSlotIndex = normalizeSlotIndex(slotIndex, deviceType);
                      if (normalizedSlotIndex !== undefined) {
                        appWithData.slotIndex = normalizedSlotIndex;
                      }
                      const normalizedDockIndex = normalizeDockIndex(dockIndex);
                      if (normalizedDockIndex !== undefined) {
                        appWithData.dockIndex = normalizedDockIndex;
                      }
                      
                      const normalizedSize = normalizeWidgetSize(size, deviceType);
                      if (normalizedSize) {
                        appWithData.size = normalizedSize;
                      }
                      
                      return appWithData;
                    }
                    return app;
                  })
                  .filter(Boolean) as App[];
                const appsWithSlots = assignSlotIndexes(apps);
                setVisibleApps(fixDuplicateSlotIndexes(appsWithSlots));
              } else {
                // Final fallback: use device-specific defaults from lib
                const defaultAppsData = deviceType === 'mobile' ? DEFAULT_QUICK_ACCESS_APPS_MOBILE : DEFAULT_QUICK_ACCESS_APPS_DESKTOP;
                const defaultApps = defaultAppsData
                  .map((item: StoredAppType) => {
                    const id = typeof item === 'string' ? item : item.id;
                    return allAvailableApps.find(a => a.id === id);
                  })
                  .filter(Boolean) as App[];
                
                // Apply slotIndex and size from defaults
                const appsWithDefaults = defaultApps.map(app => {
                  const defaultItem = defaultAppsData.find((item: StoredAppType) => {
                    const itemId = typeof item === 'string' ? item : item.id;
                    return itemId === app.id;
                  });
                  
                  if (defaultItem && typeof defaultItem === 'object') {
                    const appWithData: App = { ...app };
                    if (defaultItem.slotIndex !== undefined) {
                      appWithData.slotIndex = normalizeSlotIndex(defaultItem.slotIndex, deviceType);
                    }
                    if (defaultItem.size) {
                      const normalizedSize = normalizeWidgetSize(defaultItem.size, deviceType);
                      if (normalizedSize) {
                        appWithData.size = normalizedSize;
                      }
                    }
                    return appWithData;
                  }
                  return app;
                });
                
                // 작은 모바일 화면에서 위젯 크기를 그리드 경계에 맞게 조정
                const adjustedApps = appsWithDefaults.map(app => {
                  if (app.isWidget) {
                    return adjustWidgetSizeForGrid(app, deviceType, widgetGridConfig);
                  }
                  return app;
                });
                
                const appsWithSlots = assignSlotIndexes(adjustedApps);
                setVisibleApps(fixDuplicateSlotIndexes(appsWithSlots));
                
                // Cache default apps
                try {
                  localStorage.setItem(storageKey, JSON.stringify(defaultAppsData));
                  localStorage.setItem(cacheKey, JSON.stringify(defaultAppsData));
                  localStorage.removeItem(LEGACY_STORAGE_KEY);
                  localStorage.removeItem(LEGACY_CACHE_KEY);
                } catch (error) {
                  console.warn('Failed to cache default apps:', error);
                }
              }
            }
          } catch (apiError) {
            console.error('Failed to fetch default apps from API:', apiError);
            // Fallback to localStorage
            const stored = localStorage.getItem(storageKey) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
            if (stored) {
              const storedData = JSON.parse(stored);
              const apps = storedData
                .map((item: string | { id: string; slotIndex?: any; size?: any; dockIndex?: any }) => {
                  const id = typeof item === 'string' ? item : item.id;
                  if (!VALID_APP_IDS.includes(id)) {
                    return null;
                  }
                  const slotIndex = typeof item === 'object' ? item.slotIndex : undefined;
                    const dockIndex = typeof item === 'object' ? item.dockIndex : undefined;
                  const size = typeof item === 'object' ? item.size : undefined;
                  const app = allAvailableApps.find(a => a.id === id);
                  
                  if (app) {
                    const appWithData: App = { ...app };
                    
                    const normalizedSlotIndex = normalizeSlotIndex(slotIndex, deviceType);
                    if (normalizedSlotIndex !== undefined) {
                      appWithData.slotIndex = normalizedSlotIndex;
                    }
                      const normalizedDockIndex = normalizeDockIndex(dockIndex);
                      if (normalizedDockIndex !== undefined) {
                        appWithData.dockIndex = normalizedDockIndex;
                    }
                    
                    const normalizedSize = normalizeWidgetSize(size, deviceType);
                    if (normalizedSize) {
                      appWithData.size = normalizedSize;
                    }
                    
                    return appWithData;
                  }
                  return app;
                })
                .filter(Boolean) as App[];
              const appsWithSlots = assignSlotIndexes(apps);
              setVisibleApps(fixDuplicateSlotIndexes(appsWithSlots));
            } else {
              // Final fallback: use device-specific defaults from lib
              const defaultAppsData = deviceType === 'mobile' ? DEFAULT_QUICK_ACCESS_APPS_MOBILE : DEFAULT_QUICK_ACCESS_APPS_DESKTOP;
              const defaultApps = defaultAppsData
                .map((item: StoredAppType) => {
                  const id = typeof item === 'string' ? item : item.id;
                  return allAvailableApps.find(a => a.id === id);
                })
                .filter(Boolean) as App[];
              
              // Apply slotIndex and size from defaults
              const appsWithDefaults = defaultApps.map(app => {
                const defaultItem = defaultAppsData.find((item: StoredAppType) => {
                  const itemId = typeof item === 'string' ? item : item.id;
                  return itemId === app.id;
                });
                
                if (defaultItem && typeof defaultItem === 'object') {
                  const appWithData: App = { ...app };
                  if (defaultItem.slotIndex !== undefined) {
                    appWithData.slotIndex = normalizeSlotIndex(defaultItem.slotIndex, deviceType);
                  }
                  if (defaultItem.size) {
                    const normalizedSize = normalizeWidgetSize(defaultItem.size, deviceType);
                    if (normalizedSize) {
                      appWithData.size = normalizedSize;
                    }
                  }
                  return appWithData;
                }
                return app;
              });
              
              // 작은 모바일 화면에서 위젯 크기를 그리드 경계에 맞게 조정
              const adjustedApps = appsWithDefaults.map(app => {
                if (app.isWidget) {
                  return adjustWidgetSizeForGrid(app, deviceType, widgetGridConfig);
                }
                return app;
              });
              
              const appsWithSlots = assignSlotIndexes(adjustedApps);
              setVisibleApps(fixDuplicateSlotIndexes(appsWithSlots));
            }
          }
        }
      } catch (error) {
        console.error('Failed to load quick access apps:', error);
        // Final fallback: use device-specific defaults from lib
        const deviceType = getDeviceType();
        const defaultAppsData = deviceType === 'mobile' ? DEFAULT_QUICK_ACCESS_APPS_MOBILE : DEFAULT_QUICK_ACCESS_APPS_DESKTOP;
        const defaultApps = defaultAppsData
          .map((item: StoredAppType) => {
            const id = typeof item === 'string' ? item : item.id;
            return allAvailableApps.find(a => a.id === id);
          })
          .filter(Boolean) as App[];
        
        // Apply slotIndex and size from defaults
        const appsWithDefaults = defaultApps.map(app => {
          const defaultItem = defaultAppsData.find((item: StoredAppType) => {
            const itemId = typeof item === 'string' ? item : item.id;
            return itemId === app.id;
          });
          
          if (defaultItem && typeof defaultItem === 'object') {
            const appWithData: App = { ...app };
            if (defaultItem.slotIndex !== undefined) {
              appWithData.slotIndex = normalizeSlotIndex(defaultItem.slotIndex, deviceType);
            }
            if (defaultItem.size) {
              const normalizedSize = normalizeWidgetSize(defaultItem.size, deviceType);
              if (normalizedSize) {
                appWithData.size = normalizedSize;
              }
            }
            return appWithData;
          }
          return app;
        });
        
        // 작은 모바일 화면에서 위젯 크기를 그리드 경계에 맞게 조정
        const adjustedApps = appsWithDefaults.map(app => {
          if (app.isWidget) {
            return adjustWidgetSizeForGrid(app, deviceType, widgetGridConfig);
          }
          return app;
        });
        
        const appsWithSlots = assignSlotIndexes(adjustedApps);
        setVisibleApps(fixDuplicateSlotIndexes(appsWithSlots));
      } finally {
        setIsLoading(false);
      }
    };

    loadVisibleApps();
  }, [user?.id, migrationCompleted, saveAppsToAPI, assignSlotIndexes, fixDuplicateSlotIndexes, adjustWidgetSizeForGrid, widgetGridConfig, initialAppsProp]);

  // Save to API/localStorage whenever visibleApps changes
  useEffect(() => {
    if (visibleApps.length > 0 && !isLoading) {
      saveAppsToAPI(visibleApps).catch(error => {
        console.error('Failed to save apps:', error);
      });
    }
  }, [visibleApps, user?.id, isLoading, saveAppsToAPI]);

  // Event handlers
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isEditMode) {
      setIsEditMode(true);
    }
  };

  const handleLongPressStart = (widgetId?: string, position?: { x: number; y: number }) => {
    // 위젯인 경우 위젯 ID 저장
    if (widgetId) {
      longPressWidgetId.current = widgetId;
    }
    if (position) {
      longPressStartPosition.current = position;
    }
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    if (longPressMoveCleanup.current) {
      longPressMoveCleanup.current();
      longPressMoveCleanup.current = null;
    }
    if (position) {
      const checkMove = (current: { x: number; y: number }) => {
        const start = longPressStartPosition.current;
        if (!start) return;
        const dx = current.x - start.x;
        const dy = current.y - start.y;
        if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_THRESHOLD) {
          handleLongPressEnd();
        }
      };
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches[0]) {
          checkMove({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        }
      };
      const onMouseMove = (e: MouseEvent) => {
        checkMove({ x: e.clientX, y: e.clientY });
      };
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('mousemove', onMouseMove);
      longPressMoveCleanup.current = () => {
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('mousemove', onMouseMove);
        longPressStartPosition.current = null;
        longPressMoveCleanup.current = null;
      };
    }
    longPressTimer.current = setTimeout(() => {
      if (!isEditMode) {
        setIsEditMode(true);
        // 위젯 long press로 편집 모드 진입한 경우 플래그 설정
        if (widgetId) {
          justEnteredEditModeFromWidget.current = true;
          // 500ms 후 플래그 해제 (Safari의 자동 click 이벤트 시간 고려)
          setTimeout(() => {
            justEnteredEditModeFromWidget.current = false;
          }, 500);
        }
      }
    }, longPressDelay);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (longPressMoveCleanup.current) {
      longPressMoveCleanup.current();
      longPressMoveCleanup.current = null;
    }
    longPressStartPosition.current = null;
    // 위젯 long press 종료 시 위젯 ID 초기화 (타이머가 완료되지 않은 경우)
    longPressWidgetId.current = null;
  };

  const handleAppClick = (app: App) => {
    if (isEditMode) return;
    
    // Handle Add app click - open modal
    if (app.id === 'add-app') {
      setShowAddModal(true);
      return;
    }
    
    // Handle Settings app click - open settings panel
    if (app.id === 'settings') {
      setIsSettingsPanelOpen(true);
      return;
    }
    
    // Handle What's New app click - clear notification badge
    if (app.id === 'whats-new') {
      // 사용자가 패널을 열었다는 것을 기록
      try {
        localStorage.setItem('hasOpenedWhatsNew', 'true');
        setHasEverBeenOpened(true);
      } catch (error) {
        console.error('Error saving hasOpenedWhatsNew to localStorage:', error);
      }
      
      if (updates.length > 0) {
        const newestUpdate = updates[0];
        updateLastSeen(newestUpdate.id, newestUpdate.timestamp);
        
        setHasNewUpdates(false);
        setNewUpdatesCount(0);
        setShowBadge(false);
        
        // Dispatch event to notify other components about the update
        window.dispatchEvent(new CustomEvent('whatsNewViewed', {
          detail: { updateId: newestUpdate.id, timestamp: newestUpdate.timestamp }
        }));
      }
    }

    // Handle Trending app click - open same expanded widget modal as widget tap
    if (app.id === 'trending') {
      setFullscreenWidgetId('glass-trends-widget');
      return;
    }
    
    router.push(app.path);
  };

  const handleDeleteApp = (appId: string) => {
    if (appId === 'add-app') return; // Prevent deletion of Add button
    setRemovingAppId(appId);
    setTimeout(() => {
      setVisibleApps(prev => prev.filter(app => app.id !== appId));
      setRemovingAppId(null);
    }, 0);
  };

  const handleRemoveMultipleApps = (appIds: string[]) => {
    const validIds = appIds.filter(id => id !== 'add-app');
    if (validIds.length === 0) return;
    
    setRemovingAppId(validIds[0]);
    setTimeout(() => {
      setVisibleApps(prev => prev.filter(app => !validIds.includes(app.id)));
      setRemovingAppId(null);
    }, 0);
  };

  const handleAddMultipleApps = (appIds: string[]) => {
    if (appIds.length === 0) return;
    
    // 모든 앱을 찾고, 이미 추가된 앱은 제외
    const appsToAdd = appIds
      .map(appId => allAvailableApps.find(a => a.id === appId))
      .filter((app): app is typeof app & { id: string } => app !== undefined);
    
    if (appsToAdd.length === 0) return;
    
    // 위젯과 일반 앱 분리 (중복 제거)
    const widgetsToAdd = appsToAdd.filter(app => app.isWidget && !visibleApps.find(a => a.id === app.id));
    const regularAppsToAdd = appsToAdd.filter(app => !app.isWidget && !visibleApps.find(a => a.id === app.id));
    
    // 현재 상태를 기준으로 한 번에 추가
    setVisibleApps(prev => {
      const newApps: typeof appsToAdd = [];
      
      // 일반 앱 추가
      newApps.push(...regularAppsToAdd);
      
      // 위젯 추가 (슬롯 계산)
      if (widgetsToAdd.length > 0) {
        const deviceType = getDeviceType();
        const existingWidgets = prev.filter(a => a.isWidget);
      const usedWidgetsById = new Set(existingWidgets.map(w => w.id));
      const dedupedWidgets = widgetsToAdd.filter(w => !usedWidgetsById.has(w.id));
        const { columns, rows, widgetsPerPage } = widgetGridConfig;
        const defaultWidgetSize = deviceType === 'mobile' ? { width: 4, height: 2 } : { width: 1, height: 1 };
        
        // 기존 위젯들이 차지하는 모든 슬롯 계산 (크기 고려)
        const usedSlots = new Set<number>();
        existingWidgets.forEach(widget => {
          if (widget.slotIndex !== undefined) {
            const occupiedSlots = getWidgetOccupiedSlots(widget, deviceType, widgetGridConfig);
            occupiedSlots.forEach(slot => usedSlots.add(slot));
          }
        });
        
      dedupedWidgets.forEach(widget => {
          // 현재 페이지(0페이지)부터 시작하여 빈 슬롯 찾기
          let foundSlot = false;
          let newSlotIndex = deviceType === 'desktop' ? 1 : 0;
          let currentPage = 0;
          
          // 한 페이지당 최대 widgetsPerPage까지만 검색
          while (!foundSlot && newSlotIndex < widgetsPerPage * 10) {
            // 현재 페이지 범위 확인
            const pageStart = currentPage * widgetsPerPage;
            const pageEnd = pageStart + widgetsPerPage;
            
            if (newSlotIndex >= pageEnd) {
              currentPage++;
              newSlotIndex = currentPage * widgetsPerPage + (deviceType === 'desktop' ? 1 : 0);
              continue;
            }
            
            // 위젯이 차지할 슬롯 계산
            const localSlotIndex = newSlotIndex - pageStart;
            const localRow = Math.floor(localSlotIndex / columns);
            const localCol = localSlotIndex % columns;
            
            // 현재 페이지의 행 수를 초과하지 않는지 확인
            if (localRow + defaultWidgetSize.height > rows) {
              currentPage++;
              newSlotIndex = currentPage * widgetsPerPage + (deviceType === 'desktop' ? 1 : 0);
              continue;
            }
            
            // 위젯이 차지할 모든 슬롯 계산
            const widgetOccupiedSlots: number[] = [];
            for (let row = 0; row < defaultWidgetSize.height; row++) {
              for (let col = 0; col < defaultWidgetSize.width; col++) {
                const slotRow = localRow + row;
                const slotCol = localCol + col;
                if (slotRow < rows && slotCol < columns) {
                  const globalSlotIndex = pageStart + (slotRow * columns + slotCol);
                  widgetOccupiedSlots.push(globalSlotIndex);
                }
              }
            }
            
            // 모든 슬롯이 비어있는지 확인
            const isAvailable = widgetOccupiedSlots.every(slot => !usedSlots.has(slot));
            
            if (isAvailable) {
              foundSlot = true;
              // 사용된 슬롯으로 표시
              widgetOccupiedSlots.forEach(slot => usedSlots.add(slot));
              break;
            }
            
            newSlotIndex++;
          }
          
          if (foundSlot) {
          newApps.push({
            ...widget,
              slotIndex: newSlotIndex,
              size: defaultWidgetSize
          });
          }
        });
      }
      
      return [...prev, ...newApps];
    });
  };

  const handleAddApp = (appId: string) => {
    const app = allAvailableApps.find(a => a.id === appId);
    if (app && !visibleApps.find(a => a.id === appId)) {
      const deviceType = getDeviceType();
      
      // 위젯이면 빈 슬롯 찾아서 할당 (디바이스별)
      if (app.isWidget) {
        if (deviceType === 'mobile') {
          const defaultWidgetSize = { width: 4, height: 2 };
          const newWidget: App = { ...app, size: defaultWidgetSize, dockIndex: undefined, slotIndex: widgetPage * widgetGridConfig.widgetsPerPage };
          const dockApps = visibleApps.filter(a => !a.isWidget && typeof a.dockIndex === 'number');
          const gridItems = visibleApps.filter(a => a.isWidget || a.dockIndex === undefined);
          const packed = packMobileGridItems([newWidget, ...gridItems]);
          setVisibleApps([...dockApps, ...packed]);
          return;
        }
        const existingWidgets = visibleApps.filter(a => a.isWidget);
        const gridApps = visibleApps.filter(a => !a.isWidget && a.dockIndex === undefined && typeof a.slotIndex === 'number');
        const { columns, rows, widgetsPerPage } = widgetGridConfig;
        const defaultWidgetSize = { width: 1, height: 1 };
        const startPage = widgetPage;
        const firstSlot = startPage * widgetsPerPage + (deviceType === 'desktop' ? 1 : 0);

        // 현재 모든 슬롯 점유 상태(위젯 + 그리드 앱) 수집 후 첫 빈 슬롯 탐색
        const occupiedSlotsAll = new Set<number>();
        [...existingWidgets, ...gridApps].forEach(item => {
          if (item.slotIndex !== undefined) {
            getWidgetOccupiedSlots(item, deviceType, widgetGridConfig).forEach(s => occupiedSlotsAll.add(s));
          }
        });

        let newSlotIndex = firstSlot;
        const safetyLimit = Math.max(occupiedSlotsAll.size + widgetsPerPage * 3, widgetsPerPage * 3);
        let steps = 0;
        while (occupiedSlotsAll.has(newSlotIndex) && steps < safetyLimit) {
          newSlotIndex += 1;
          steps += 1;
        }

        // 선택된 슬롯 기준으로 페이지/범위 재계산
        const targetPage = Math.floor(newSlotIndex / widgetsPerPage);
        const pageStart = targetPage * widgetsPerPage;
        const pageEnd = pageStart + widgetsPerPage;

        // 선택된 페이지의 위젯/앱 점유 슬롯 재수집
        const usedSlotsCurrentPage = new Set<number>();
        const widgetsInCurrentPage: App[] = [];
        existingWidgets.forEach(widget => {
          if (widget.slotIndex !== undefined) {
            const occupiedSlots = getWidgetOccupiedSlots(widget, deviceType, widgetGridConfig);
            const isInTargetPage = occupiedSlots.some(slot => slot >= pageStart && slot < pageEnd);
            if (isInTargetPage) {
              widgetsInCurrentPage.push(widget);
              occupiedSlots.forEach(slot => {
                if (slot >= pageStart && slot < pageEnd) {
                  usedSlotsCurrentPage.add(slot);
                }
              });
            }
          }
        });
        gridApps.forEach(app => {
          const occupiedSlots = getWidgetOccupiedSlots(app, deviceType, widgetGridConfig);
          occupiedSlots.forEach(slot => {
            if (slot >= pageStart && slot < pageEnd) {
              usedSlotsCurrentPage.add(slot);
            }
          });
        });
        
        // 새 위젯이 차지할 슬롯 계산
        const localSlotIndex = newSlotIndex - pageStart;
        const localRow = Math.floor(localSlotIndex / columns);
        const localCol = localSlotIndex % columns;
        
        // 새 위젯이 차지할 모든 슬롯 계산
        const newWidgetOccupiedSlots: number[] = [];
        for (let row = 0; row < defaultWidgetSize.height; row++) {
          for (let col = 0; col < defaultWidgetSize.width; col++) {
            const slotRow = localRow + row;
            const slotCol = localCol + col;
            if (slotRow < rows && slotCol < columns) {
              const globalSlotIndex = pageStart + (slotRow * columns + slotCol);
              newWidgetOccupiedSlots.push(globalSlotIndex);
            }
          }
        }
        
        // 새 위젯과 겹치는 위젯들 찾기 (현재 페이지 내)
        const overlappingWidgets: App[] = [];
        widgetsInCurrentPage.forEach(widget => {
          const widgetOccupiedSlots = getWidgetOccupiedSlots(widget, deviceType, widgetGridConfig);
          const widgetSlotsInCurrentPage = widgetOccupiedSlots.filter(slot => slot >= pageStart && slot < pageEnd);
          const hasOverlap = newWidgetOccupiedSlots.some(slot => widgetSlotsInCurrentPage.includes(slot));
          if (hasOverlap) {
            overlappingWidgets.push(widget);
          }
        });
        
        // 겹치는 위젯들을 아래로 밀기 (slotIndex 순으로 정렬: 위에서 아래로)
        const sortedOverlappingWidgets = [...overlappingWidgets].sort((a, b) => {
          const slotA = a.slotIndex ?? 0;
          const slotB = b.slotIndex ?? 0;
          return slotA - slotB; // 위에서 아래로
        });
        
        // 1단계: 같은 페이지 내에서 재배치 시도 (크기 유지)
        if (sortedOverlappingWidgets.length > 0 && !newWidgetOccupiedSlots.some(slot => slot >= pageEnd)) {
          // 새 위젯이 차지할 슬롯을 제외한 사용된 슬롯 계산
          const availableSlots = new Set(usedSlotsCurrentPage);
          newWidgetOccupiedSlots.forEach(slot => {
            if (slot >= pageStart && slot < pageEnd) {
              availableSlots.delete(slot);
            }
          });
          
          // 겹치는 위젯들을 같은 페이지 내에서 아래로 밀어서 재배치 시도 (크기 유지)
          const widgetsToReposition: Array<{ widget: App; newSlotIndex: number }> = [];
          const repositionedSlots = new Set(availableSlots);
          
          for (const widget of sortedOverlappingWidgets) {
            const widgetSize = getWidgetSize(widget); // 원래 크기 유지
            const widgetOccupiedSlots = getWidgetOccupiedSlots(widget, deviceType, widgetGridConfig);
            const widgetSlotsInCurrentPage = widgetOccupiedSlots.filter(slot => slot >= pageStart && slot < pageEnd);
            
            // 기존 위치에서 제거
            widgetSlotsInCurrentPage.forEach(slot => repositionedSlots.delete(slot));
            
            // 같은 페이지 내에서 아래쪽으로 빈 슬롯 찾기 (크기 유지하면서)
            let foundNewPosition = false;
            let testSlotIndex = pageStart + (deviceType === 'desktop' ? 1 : 0);
            
            while (testSlotIndex < pageEnd) {
              const localSlotIndex = testSlotIndex - pageStart;
              const localRow = Math.floor(localSlotIndex / columns);
              const localCol = localSlotIndex % columns;
              
              // 현재 페이지의 행 수를 초과하지 않는지 확인 (크기 유지)
              if (localRow + widgetSize.height > rows) {
                break; // 현재 페이지에 공간이 없음
              }
              
              // 위젯이 차지할 모든 슬롯 계산 (크기 유지, 페이지 경계 체크)
              const testOccupiedSlots: number[] = [];
              for (let row = 0; row < widgetSize.height; row++) {
                for (let col = 0; col < widgetSize.width; col++) {
                  const slotRow = localRow + row;
                  const slotCol = localCol + col;
                  // 그리드 범위와 페이지 범위 모두 체크
                  if (slotRow < rows && slotCol < columns) {
                    const globalSlotIndex = pageStart + (slotRow * columns + slotCol);
                    // 페이지 범위 내에 있는 슬롯만 추가
                    if (globalSlotIndex >= pageStart && globalSlotIndex < pageEnd) {
                      testOccupiedSlots.push(globalSlotIndex);
                    }
                  }
                }
              }
              
              // 위젯이 페이지 경계를 넘지 않는지 확인 (모든 슬롯이 페이지 내에 있어야 함)
              const expectedSlots = widgetSize.width * widgetSize.height;
              const slotsInPage = testOccupiedSlots.filter(slot => slot >= pageStart && slot < pageEnd).length;
              const isWithinPage = slotsInPage === expectedSlots;
              
              if (!isWithinPage) {
                // 페이지 경계를 넘으면 이 위치는 사용 불가
                testSlotIndex++;
                continue;
              }
              
              // 모든 슬롯이 비어있는지 확인 (새 위젯이 차지할 슬롯 제외, 크기 유지)
              const isAvailable = testOccupiedSlots.every(slot => {
                // 새 위젯이 차지할 슬롯은 무시
                if (newWidgetOccupiedSlots.includes(slot)) return false;
                // 페이지 범위 확인
                if (slot < pageStart || slot >= pageEnd) return false;
                return !repositionedSlots.has(slot);
              });
              
              if (isAvailable) {
                // 재배치된 위젯이 페이지 경계 내에 있는지 최종 확인
                const testWidget: App = {
                  ...widget,
                  slotIndex: testSlotIndex
                };
                
                if (isWidgetWithinPageBoundaries(testWidget, deviceType, widgetGridConfig)) {
                  foundNewPosition = true;
                  widgetsToReposition.push({
                    widget,
                    newSlotIndex: testSlotIndex
                  });
                  // 재배치된 슬롯으로 표시
                  testOccupiedSlots.forEach(slot => {
                    if (slot >= pageStart && slot < pageEnd) {
                      repositionedSlots.add(slot);
                    }
                  });
                  break;
                }
              }
              
              testSlotIndex++;
            }
            
            // 같은 페이지 내에서 재배치할 수 없으면 원래 위치로 복구하고 중단
            if (!foundNewPosition) {
              widgetSlotsInCurrentPage.forEach(slot => {
                if (slot >= pageStart && slot < pageEnd) {
                  repositionedSlots.add(slot);
                }
              });
              break; // 하나라도 재배치 실패하면 같은 페이지 내 재배치 불가능
            }
          }
          
          // 같은 페이지 내에서 모든 위젯을 재배치할 수 있는지 확인
          const allRepositioned = widgetsToReposition.length === sortedOverlappingWidgets.length;
          
          if (allRepositioned) {
            // 재배치된 모든 위젯이 페이지 경계 내에 있는지 최종 확인
            const allWithinBounds = widgetsToReposition.every(repositionInfo => {
              const testWidget: App = {
                ...repositionInfo.widget,
                slotIndex: repositionInfo.newSlotIndex
              };
              return isWidgetWithinPageBoundaries(testWidget, deviceType, widgetGridConfig);
            });
            
            if (allWithinBounds) {
              // 같은 페이지 내에서 재배치 가능 (크기 유지, 페이지 크기 유지)
              setVisibleApps(prev => {
                const updated = prev.map(app => {
                  const repositionInfo = widgetsToReposition.find(r => r.widget.id === app.id);
                  if (repositionInfo) {
                    return {
          ...app, 
                      slotIndex: repositionInfo.newSlotIndex
                      // size는 그대로 유지 (변경하지 않음)
                    };
                  }
                  return app;
                });
                
                // 새 위젯 추가 (항상 첫 번째 슬롯)
                return [...updated, {
                  ...app,
                  slotIndex: newSlotIndex,
                  size: defaultWidgetSize
                }];
              });
              return;
            }
            // 하나라도 페이지 경계를 넘으면 재배치 실패, 다음 단계로
          }
        }
        
        // 2단계: 같은 페이지 내 재배치 불가능하면 다음 페이지로 이동 (iOS 스타일: 최하단부터, 크기 유지)
        if (sortedOverlappingWidgets.length > 0 || newWidgetOccupiedSlots.some(slot => slot >= pageEnd)) {
          // 모든 위젯을 최하단 위치 기준으로 정렬 (아래쪽부터, 즉 큰 slotIndex부터)
          const allWidgetsInPage = [...widgetsInCurrentPage].sort((a, b) => {
            const slotA = a.slotIndex ?? 0;
            const slotB = b.slotIndex ?? 0;
            const sizeA = getWidgetSize(a);
            const sizeB = getWidgetSize(b);
            
            // 위젯의 최하단 행 계산
            const localSlotA = slotA - pageStart;
            const localSlotB = slotB - pageStart;
            const rowA = Math.floor(localSlotA / columns);
            const rowB = Math.floor(localSlotB / columns);
            const bottomRowA = rowA + sizeA.height - 1;
            const bottomRowB = rowB + sizeB.height - 1;
            
            // 최하단 행이 같으면 오른쪽부터 (큰 slotIndex)
            if (bottomRowA === bottomRowB) {
              return slotB - slotA; // 큰 slotIndex부터
            }
            
            // 최하단 행이 다르면 아래쪽부터
            return bottomRowB - bottomRowA; // 아래쪽부터
          });
          
          // 최하단 위젯부터 다음 페이지로 이동시키면서 공간 확보 시도 (iOS처럼)
          const widgetsToMove: Array<{ widget: App; newSlotIndex: number; newPage: number }> = [];
          let movedSlots = new Set(usedSlotsCurrentPage);
          
          // 새 위젯이 차지할 슬롯을 제거하여 공간 확보
          newWidgetOccupiedSlots.forEach(slot => {
            if (slot >= pageStart && slot < pageEnd) {
              movedSlots.delete(slot);
            }
          });
          
          // 최하단부터 위젯을 이동시키면서 새 위젯이 들어갈 공간이 생기는지 확인
          for (const widget of allWidgetsInPage) {
            const widgetOccupiedSlots = getWidgetOccupiedSlots(widget, deviceType, widgetGridConfig);
            const widgetSlotsInCurrentPage = widgetOccupiedSlots.filter(slot => slot >= pageStart && slot < pageEnd);
            
            // 이 위젯을 제거하면 공간이 생기는지 확인
            widgetSlotsInCurrentPage.forEach(slot => movedSlots.delete(slot));
            
            // 새 위젯이 들어갈 공간이 있는지 확인
            const canFit = newWidgetOccupiedSlots.every(slot => {
              if (slot < pageStart || slot >= pageEnd) return true; // 페이지 범위 밖은 무시
              return !movedSlots.has(slot);
            });
            
            if (canFit) {
              // 이 위젯을 다음 페이지로 이동 (연쇄적 밀어내기 포함)
              const widgetCurrentPage = Math.floor((widget.slotIndex ?? 0) / widgetsPerPage);
              const moveResult = moveWidgetToNextPage(widget, widgetCurrentPage, deviceType, widgetGridConfig, existingWidgets);
              
              if (moveResult) {
                // 연쇄 이동 결과 모두 추가
                moveResult.cascadedMoves.forEach(cascadedMove => {
                  // 중복 제거
                  if (!widgetsToMove.some(m => m.widget.id === cascadedMove.widget.id)) {
                    widgetsToMove.push(cascadedMove);
                  }
                });
                
                // 현재 위젯도 추가
                widgetsToMove.push({
                  widget,
                  newSlotIndex: moveResult.slotIndex,
                  newPage: moveResult.page
                });
              } else {
                // 다음 페이지로 이동 실패하면 다시 추가
                widgetSlotsInCurrentPage.forEach(slot => movedSlots.add(slot));
              }
            } else {
              // 이 위젯을 제거해도 공간이 생기지 않으면 다시 추가하고 계속
              widgetSlotsInCurrentPage.forEach(slot => movedSlots.add(slot));
            }
          }
          
          // 위젯 이동 및 새 위젯 추가
          if (widgetsToMove.length > 0) {
            setVisibleApps(prev => {
              const updated = prev.map(app => {
                const moveInfo = widgetsToMove.find(m => m.widget.id === app.id);
                if (moveInfo) {
                  return {
                    ...app,
                    slotIndex: moveInfo.newSlotIndex
                  };
                }
                return app;
              });
              
              // 새 위젯 추가 (항상 첫 번째 슬롯)
              return [...updated, {
                ...app,
                slotIndex: newSlotIndex,
                size: defaultWidgetSize
              }];
            });
            return;
          }
        }
        
        // 현재 페이지에 공간이 있으면 그냥 추가 (항상 첫 번째 슬롯)
        // 위젯 이동이 실패했거나 공간이 있는 경우
        setVisibleApps(prev => [...prev, { 
          ...app, 
          slotIndex: newSlotIndex,
          size: defaultWidgetSize
        }]);
      } else if (deviceType === 'mobile') {
        // 모바일: 앱을 1x1로 보고 그리드에 통합, 안정된 좌→우 상→하 밀어내기
        const newApp: App = { ...app, slotIndex: widgetPage * widgetGridConfig.widgetsPerPage, dockIndex: undefined, size: { width: 1, height: 1 }, isWidget: false };
        const dockApps = visibleApps.filter(a => !a.isWidget && typeof a.dockIndex === 'number');
        const gridItems = visibleApps.filter(a => a.isWidget || a.dockIndex === undefined);
        const packed = packMobileGridItems([newApp, ...gridItems]);
        setVisibleApps([...dockApps, ...packed]);
      } else {
        // 데스크탑에서는 기존 로직 유지
        setVisibleApps(prev => [...prev, app]);
      }
    }
  };

  // 위젯 크기를 고려한 커스텀 충돌 감지 함수
  const widgetCollisionDetection = useCallback((args: any) => {
    const { active, droppableRects, pointerCoordinates } = args;
    
    if (!pointerCoordinates) {
      return closestCenter(args);
    }

    // 드래그 중인 위젯 찾기
    const draggedWidget = visibleApps.find(app => app.id === active.id && app.isWidget);
    if (!draggedWidget) {
      // 위젯이 아니면 closestCenter 사용
      return closestCenter(args);
    }

    const deviceType = getDeviceType();
    const widgetSize = getWidgetSize(draggedWidget);
    
    // 위젯의 중심점을 기준으로 가장 가까운 드롭 타겟 찾기
    // 위젯이 여러 슬롯을 차지하는 경우, 상단 슬롯을 우선적으로 고려
    const collisions: Array<{ id: any; distance: number }> = [];
    
    droppableRects.forEach((rect: any, id: any) => {
      if (!rect) return;
      
      // 드롭 타겟의 중심점 계산
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // 포인터 위치와 드롭 타겟 중심점 사이의 거리 계산
      const distance = Math.sqrt(
        Math.pow(pointerCoordinates.x - centerX, 2) + 
        Math.pow(pointerCoordinates.y - centerY, 2)
      );
      
      collisions.push({ id, distance });
    });

    // 가장 가까운 드롭 타겟 반환
    if (collisions.length === 0) return [];
    
    collisions.sort((a, b) => a.distance - b.distance);
    const closest = collisions[0];
    
    return [{
      id: closest.id,
    }];
  }, [visibleApps, getWidgetSize]);

  // 위젯 리사이즈 시작 핸들러 (드래그 기반) — 모바일/태블릿에서는 리사이즈 비활성화
  const handleResizeStart = useCallback((
    widgetId: string,
    direction: 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se',
    startPosition: { x: number; y: number },
    startSize: { width: number; height: number }
  ) => {
    if (getDeviceType() !== 'desktop') return;
    // 리사이즈 시작 시 활성 위젯 드래그 상태 해제 (TouchSensor 충돌 방지)
    if (activeWidgetId === widgetId) {
      setActiveWidgetId(null);
    }
    
    // 페이지 전환 관련 상태 초기화 (터치 이벤트 충돌 방지)
    setTouchStart(null);
    setTouchEnd(null);
    
    // 시작 시점의 slotIndex 저장
    const widget = visibleApps.find(app => app.id === widgetId);
    if (!widget || !widget.isWidget) return;
    
    const deviceType = getDeviceType();
    const startSlotIndex = widget.slotIndex;
    
    // 실제 저장된 위젯 크기 가져오기 (startSize prop이 아닌 실제 저장된 값 사용)
    const actualWidgetSize = getWidgetSize(widget);
    const currentSlotIndex = startSlotIndex ?? widget.slotIndex ?? 0;
    
    // resizePreview를 먼저 설정하여 isResizing이 true가 되기 전에 값이 준비되도록 함
    // 앱 그리드 기준으로 계산 (앱과 동일)
    const deviceTypeForPreview = getDeviceType();
    const APP_CELL_HEIGHT = 86; // 앱 셀 높이 (64px 아이콘 + 22px 텍스트)
    const gapSizeForPreview = deviceTypeForPreview === 'mobile' 
      ? 4  // gap-1 (앱과 동일)
      : (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 32 : 16); // gap-8 또는 gap-4
    const horizontalPaddingForPreview = deviceTypeForPreview === 'mobile' ? 32 : 96;
    const availableWidthForPreview = typeof window !== 'undefined' ? window.innerWidth - horizontalPaddingForPreview : 800;
    const cellWidthForPreview = (availableWidthForPreview - (widgetGridConfig.columns - 1) * gapSizeForPreview) / widgetGridConfig.columns;
    const cellHeightForPreview = APP_CELL_HEIGHT;
    
    const startPixelWidth = actualWidgetSize.width * cellWidthForPreview + (actualWidgetSize.width - 1) * gapSizeForPreview;
    const startPixelHeight = actualWidgetSize.height * cellHeightForPreview + (actualWidgetSize.height - 1) * gapSizeForPreview;
    
    setResizePreview({
      pixelWidth: startPixelWidth,
      pixelHeight: startPixelHeight,
    });
    
    // 이동 추적 상태 초기화
    setHasResizeMovement(false);
    
    // 그 다음 리사이즈 상태 설정 (resizePreview가 먼저 설정되어야 함)
    setResizingWidgetId(widgetId);
    setResizeStartSize(actualWidgetSize); // 실제 저장된 크기 사용
    setResizeStartPosition(startPosition);
    setResizeDirection(direction);
    setResizeStartSlotIndex(startSlotIndex ?? null);
  }, [activeWidgetId, visibleApps, getWidgetSize]);

  // 위젯 리사이즈 이동 핸들러 - 순수 픽셀 크기(W/H)만 계산 (Translate 로직 제거)
  const handleResizeMove = useCallback((currentPosition: { x: number; y: number }) => {
    if (!resizingWidgetId || !resizeStartSize || !resizeStartPosition || !resizeDirection) return;

    // 1. 이동 거리(Delta) 계산
    const deltaX = currentPosition.x - resizeStartPosition.x;
    const deltaY = currentPosition.y - resizeStartPosition.y;
    
    const hasMoved = Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1;
    if (hasMoved && !hasResizeMovement) {
      setHasResizeMovement(true);
    }

    // 2. 그리드 치수 정보 가져오기 (앱 그리드 기준)
    const deviceType = getDeviceType();
    const APP_CELL_HEIGHT = 86; // 앱 셀 높이
    const gapSize = deviceType === 'mobile' 
      ? 4  // gap-1 (앱과 동일)
      : (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 32 : 16); // gap-8 또는 gap-4
    
    const horizontalPadding = deviceType === 'mobile' ? 32 : 96;
    const availableWidth = window.innerWidth - horizontalPadding;
    const cellWidth = (availableWidth - (widgetGridConfig.columns - 1) * gapSize) / widgetGridConfig.columns;
    const cellHeight = APP_CELL_HEIGHT;

    // 3. 시작 시점의 픽셀 크기 계산
    const startPixelWidth = resizeStartSize.width * cellWidth + (resizeStartSize.width - 1) * gapSize;
    const startPixelHeight = resizeStartSize.height * cellHeight + (resizeStartSize.height - 1) * gapSize;

    let newWidth = startPixelWidth;
    let newHeight = startPixelHeight;

    // 4. 방향에 따른 단순 크기 계산 (좌표 이동 없음)
    // --- 가로 방향 ---
    if (resizeDirection.includes('w')) {
      // [Left Drag] 마우스를 왼쪽(음수)으로 가면 너비 증가: (기존 - 음수) = 증가
      newWidth = Math.max(cellWidth * 0.5, startPixelWidth - deltaX);
    } else if (resizeDirection.includes('e')) {
      // [Right Drag] 마우스를 오른쪽(양수)으로 가면 너비 증가
      newWidth = Math.max(cellWidth * 0.5, startPixelWidth + deltaX);
    }

    // --- 세로 방향 ---
    if (resizeDirection.includes('n')) {
      // [Top Drag] 마우스를 위(음수)로 가면 높이 증가
      newHeight = Math.max(cellHeight * 0.5, startPixelHeight - deltaY);
    } else if (resizeDirection.includes('s')) {
      // [Bottom Drag] 마우스를 아래(양수)로 가면 높이 증가
      newHeight = Math.max(cellHeight * 0.5, startPixelHeight + deltaY);
    }

    // 5. 상태 업데이트 (translate 값 제거됨)
    setResizePreview({
      pixelWidth: newWidth,
      pixelHeight: newHeight,
    });
  }, [resizingWidgetId, resizeStartSize, resizeStartPosition, resizeDirection, widgetGridConfig, hasResizeMovement]);

  // 위젯 리사이즈 종료 핸들러 - 방향에 따라 시작 위치(Slot Index) 역보정 계산 추가
  const handleResizeEnd = useCallback(() => {
    if (!resizingWidgetId || !resizeStartSize || !resizePreview) {
      // Cleanup
      setResizingWidgetId(null);
      setResizeStartSize(null);
      setResizeStartPosition(null);
      setResizeDirection(null);
      setResizeStartSlotIndex(null);
      setResizePreview(null);
      setHasResizeMovement(false);
      return;
    }

    const deviceType = getDeviceType();
    const widget = visibleApps.find(app => app.id === resizingWidgetId);
    
    if (!widget || !widget.isWidget) {
      setResizingWidgetId(null);
      setResizeStartSize(null);
      setResizeStartPosition(null);
      setResizeDirection(null);
      setResizeStartSlotIndex(null);
      setResizePreview(null);
      setHasResizeMovement(false);
      return;
    }

    // 1. 그리드 설정 가져오기 (앱 그리드 기준)
    const { columns, rows, widgetsPerPage } = widgetGridConfig;
    const APP_CELL_HEIGHT = 86; // 앱 셀 높이
    const gapSize = deviceType === 'mobile' 
      ? 4  // gap-1 (앱과 동일)
      : (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 32 : 16); // gap-8 또는 gap-4
    
    const horizontalPadding = deviceType === 'mobile' ? 32 : 96;
    const availableWidth = window.innerWidth - horizontalPadding;
    const cellWidth = (availableWidth - (columns - 1) * gapSize) / columns;
    const cellHeight = APP_CELL_HEIGHT;

    // 2. 최종 크기(Grid Unit) 계산 (반올림)
    // 모바일: 최소 4x2, 데스크탑: 예전 로직 (1x1 허용)
    const minWidth = deviceType === 'mobile' ? 4 : 1;
    const minHeight = deviceType === 'mobile' ? 2 : 1;
    const snappedWidth = Math.max(minWidth, Math.round((resizePreview.pixelWidth + gapSize) / (cellWidth + gapSize)));
    const snappedHeight = Math.max(minHeight, Math.round((resizePreview.pixelHeight + gapSize) / (cellHeight + gapSize)));

    // 3. 원래 위치 정보
    const startSlotIndex = resizeStartSlotIndex ?? widget.slotIndex ?? 0;
    const currentPage = Math.floor(startSlotIndex / widgetsPerPage);
    const pageStart = currentPage * widgetsPerPage;
    
    const localStartSlotIndex = startSlotIndex - pageStart;
    const localStartRow = Math.floor(localStartSlotIndex / columns);
    const localStartCol = localStartSlotIndex % columns;

    // 4. [핵심] 새로운 시작 위치 계산 (Anchor Point 보정)
    let newLocalCol = localStartCol;
    let newLocalRow = localStartRow;

    // 좌측('w') 리사이징인 경우: 오른쪽 끝을 기준으로 왼쪽 시작점을 재계산
    // 공식: (기존 오른쪽 끝) - (새로운 너비) = (새로운 왼쪽 시작점)
    if (resizeDirection?.includes('w')) {
      const rightEdge = localStartCol + resizeStartSize.width; // 고정된 오른쪽 벽
      newLocalCol = rightEdge - snappedWidth;
    }

    // 상단('n') 리사이징인 경우: 아래쪽 끝을 기준으로 위쪽 시작점을 재계산
    // 공식: (기존 아래쪽 끝) - (새로운 높이) = (새로운 위쪽 시작점)
    if (resizeDirection?.includes('n')) {
      const bottomEdge = localStartRow + resizeStartSize.height; // 고정된 아래쪽 벽
      newLocalRow = bottomEdge - snappedHeight;
    }

    // 5. 경계 체크 및 슬롯 인덱스 변환
    // 0보다 작아지지 않도록 방어 (화면 밖으로 나가는 것 방지)
    newLocalCol = Math.max(0, newLocalCol);
    newLocalRow = Math.max(0, newLocalRow);
    
    // 그리드 최대 크기를 넘지 않도록 크기 재조정 (시작점이 이동했으므로 너비/높이도 검증 필요)
    const finalWidth = Math.min(snappedWidth, columns - newLocalCol);
    const finalHeight = Math.min(snappedHeight, rows - newLocalRow);

    // 페이지 경계 체크: 현재 페이지의 행 수를 초과하면 다음 페이지로 이동
    let finalSlotIndex = pageStart + (newLocalRow * columns + newLocalCol);
    let needsPageMove = false;
    
    if (newLocalRow + finalHeight > rows) {
      // 현재 페이지에 공간이 없으면 다음 페이지로 이동
      needsPageMove = true;
    } else {
      // 현재 페이지 내에서 가능한지 확인
      const testWidget: App = {
        ...widget,
        slotIndex: finalSlotIndex,
        size: { width: finalWidth, height: finalHeight }
      };
      
      if (!isWidgetWithinPageBoundaries(testWidget, deviceType, widgetGridConfig)) {
        needsPageMove = true;
      }
    }
    
    if (deviceType === 'mobile') {
      // 모바일은 전체 그리드 재배치로 캐스케이드 처리
      const updatedWidget: App = {
        ...widget,
        slotIndex: finalSlotIndex,
        size: { width: finalWidth, height: finalHeight }
      };
      const dockApps = visibleApps.filter(a => !a.isWidget && typeof a.dockIndex === 'number');
      const gridItems = visibleApps
        .filter(a => a.isWidget || a.dockIndex === undefined)
        .map(app => app.id === updatedWidget.id ? updatedWidget : app);
      const packed = packMobileGridItems(gridItems);
      setVisibleApps([...dockApps, ...packed]);
      
      // 상태 초기화
      setResizingWidgetId(null);
      setResizeStartSize(null);
      setResizeStartPosition(null);
      setResizeDirection(null);
      setResizeStartSlotIndex(null);
      setResizePreview(null);
      setHasResizeMovement(false);
      justFinishedResize.current = true;
      setTimeout(() => { justFinishedResize.current = false; }, 100);
      return;
    }

    if (needsPageMove) {
      // 다음 페이지로 이동
      const moveResult = moveWidgetToNextPage(
        { ...widget, size: { width: finalWidth, height: finalHeight } },
        currentPage,
        deviceType,
        widgetGridConfig,
        visibleApps.filter(a => a.id !== resizingWidgetId)
      );
      
      if (moveResult) {
        // 다음 페이지로 이동하여 리사이즈 적용 (연쇄 이동 포함)
        setVisibleApps(prev => {
          let updated = prev.map(app => {
            // 연쇄 이동된 위젯들 처리
            const cascadedMove = moveResult.cascadedMoves.find(m => m.widget.id === app.id);
            if (cascadedMove) {
              return {
                ...app,
                slotIndex: cascadedMove.newSlotIndex
              };
            }
            
            // 리사이즈된 위젯 처리
            if (app.id === resizingWidgetId) {
              const updated = {
                ...app,
                slotIndex: moveResult.slotIndex,
                size: {
                  width: finalWidth,
                  height: finalHeight
                }
              };
              delete (updated as any)._hasCollision;
              return updated;
            }
            return app;
          });
          return updated;
        });
        
        // 상태 초기화
        setResizingWidgetId(null);
        setResizeStartSize(null);
        setResizeStartPosition(null);
        setResizeDirection(null);
        setResizeStartSlotIndex(null);
        setResizePreview(null);
        setHasResizeMovement(false);
        
        // 리사이즈 완료 직후 클릭 이벤트 무시
        justFinishedResize.current = true;
        setTimeout(() => {
          justFinishedResize.current = false;
        }, 100);
        return;
      } else {
        // 다음 페이지에도 공간이 없으면 리사이즈 거부
        setVisibleApps(prev => prev.map(app => {
          if (app.id === resizingWidgetId) {
            const updated = { ...app };
            delete (updated as any)._hasCollision;
            return updated;
          }
          return app;
        }));
        
        // 상태 초기화
        setResizingWidgetId(null);
        setResizeStartSize(null);
        setResizeStartPosition(null);
        setResizeDirection(null);
        setResizeStartSlotIndex(null);
        setResizePreview(null);
        setHasResizeMovement(false);
        return;
      }
    }

    // 6. 변경 사항 적용 (충돌 체크 포함)
    // 크기나 위치가 하나라도 변했으면 적용 시도
    const sizeChanged = finalWidth !== resizeStartSize.width || finalHeight !== resizeStartSize.height;
    const positionChanged = finalSlotIndex !== startSlotIndex;

    if (sizeChanged || positionChanged) {
      // 겹침 검사 로직
      const newOccupiedSlots: number[] = [];
      for (let row = 0; row < finalHeight; row++) {
        for (let col = 0; col < finalWidth; col++) {
          const slotRow = newLocalRow + row;
          const slotCol = newLocalCol + col;
          // 페이지 범위를 벗어나지 않는지 확인
          if (slotRow < rows && slotCol < columns) {
            const globalSlotIndex = pageStart + (slotRow * columns + slotCol);
            newOccupiedSlots.push(globalSlotIndex);
          }
        }
      }

      const hasCollision = visibleApps.some(app => {
        if (!app.isWidget || app.id === resizingWidgetId) return false;
        const appSlotIndex = app.slotIndex;
        if (appSlotIndex === undefined) return false;
        
        const appOccupiedSlots = getWidgetOccupiedSlots(app, deviceType, widgetGridConfig);
        return newOccupiedSlots.some(slot => appOccupiedSlots.includes(slot));
      });

      if (!hasCollision) {
      // 최종적으로 페이지 경계를 넘지 않는지 확인
      const testWidget: App = {
        ...widget,
        slotIndex: finalSlotIndex,
        size: { width: finalWidth, height: finalHeight }
      };
      
      if (isWidgetWithinPageBoundaries(testWidget, deviceType, widgetGridConfig)) {
        // [적용] 충돌 없고 페이지 경계 내에 있으면 새 위치와 크기로 업데이트
        setVisibleApps(prev => prev.map(app => {
          if (app.id === resizingWidgetId) {
            const updated = {
              ...app,
              slotIndex: finalSlotIndex,
              size: {
                width: finalWidth,
                height: finalHeight
              }
            };
            delete (updated as any)._hasCollision;
            return updated;
          }
          return app;
        }));
      } else {
        // 페이지 경계를 넘으면 다음 페이지로 이동
        const moveResult = moveWidgetToNextPage(
          { ...widget, size: { width: finalWidth, height: finalHeight } },
          currentPage,
          deviceType,
          widgetGridConfig,
          visibleApps.filter(a => a.id !== resizingWidgetId)
        );
        
        if (moveResult) {
          setVisibleApps(prev => {
            let updated = prev.map(app => {
              // 연쇄 이동된 위젯들 처리
              const cascadedMove = moveResult.cascadedMoves.find(m => m.widget.id === app.id);
              if (cascadedMove) {
                return {
                  ...app,
                  slotIndex: cascadedMove.newSlotIndex
                };
              }
              
              // 리사이즈된 위젯 처리
              if (app.id === resizingWidgetId) {
                const updated = {
                  ...app,
                  slotIndex: moveResult.slotIndex,
                  size: {
                    width: finalWidth,
                    height: finalHeight
                  }
                };
                delete (updated as any)._hasCollision;
                return updated;
              }
              return app;
            });
            return updated;
          });
        } else {
          // 다음 페이지에도 공간이 없으면 원래대로 복구
          setVisibleApps(prev => prev.map(app => {
            if (app.id === resizingWidgetId) {
              const updated = { ...app };
              delete (updated as any)._hasCollision;
              return updated;
            }
            return app;
          }));
        }
      }
      } else {
        // [실패] 충돌 시 원래대로 복구
        setVisibleApps(prev => prev.map(app => {
          if (app.id === resizingWidgetId) {
            const updated = { ...app };
            delete (updated as any)._hasCollision;
            return updated;
          }
          return app;
        }));
      }
    } else {
      // 변경 없음 -> 리셋
      setVisibleApps(prev => prev.map(app => {
        if (app.id === resizingWidgetId) {
          const updated = { ...app };
          delete (updated as any)._hasCollision;
          return updated;
        }
        return app;
      }));
    }

    // 상태 초기화
    setResizingWidgetId(null);
    setResizeStartSize(null);
    setResizeStartPosition(null);
    setResizeDirection(null);
    setResizeStartSlotIndex(null);
    setResizePreview(null);
    setHasResizeMovement(false);
    
    // 리사이즈 완료 직후 클릭 이벤트 무시 (편집 모드 자동 종료 방지)
    justFinishedResize.current = true;
    setTimeout(() => {
      justFinishedResize.current = false;
    }, 100);
  }, [resizingWidgetId, resizeStartSize, resizeStartSlotIndex, resizePreview, visibleApps, widgetGridConfig, getWidgetOccupiedSlots, isWidgetWithinPageBoundaries, moveWidgetToNextPage]);

  // DnD Kit 드래그 핸들러 - 앱용
  const handleAppDragStart = (event: DragStartEvent) => {
    if (!isEditMode) return;
    setActiveAppId(event.active.id as string);
    
    // 모바일에서 햅틱 피드백 제공 (iOS 스타일)
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleAppDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const deviceType = getDeviceType();

    // 모바일에서만 slotIndex 기반 위치 변경
    if (deviceType === 'mobile' && over) {
      const draggedApp = visibleApps.find(app => app.id === active.id && !app.isWidget);
      if (!draggedApp) {
        setActiveAppId(null);
        return;
      }

      // 타겟 슬롯 인덱스 추출
      let targetSlotIndex: number;
      let targetApp: App | undefined;
      let isLocalIndex = false;

      if (typeof over.id === 'string' && over.id.startsWith('slot-')) {
        // 빈 슬롯에 드롭 - 로컬 인덱스 (0~7)
        targetSlotIndex = parseInt(over.id.replace('slot-', ''));
        isLocalIndex = true;
      } else {
        // 다른 앱 위에 드롭 - 해당 앱의 slotIndex 사용
        targetApp = visibleApps.find(app => app.id === over.id && !app.isWidget);
        if (targetApp && targetApp.slotIndex !== undefined) {
          targetSlotIndex = targetApp.slotIndex;
          isLocalIndex = false;
        } else {
          setActiveAppId(null);
          return;
        }
      }

      // 같은 슬롯이면 무시
      const draggedSlotIndex = draggedApp.slotIndex;
      if (draggedSlotIndex === undefined) {
        setActiveAppId(null);
        return;
      }

      if (draggedSlotIndex === targetSlotIndex) {
        setActiveAppId(null);
        return;
      }

      // 다른 앱 위에 드롭한 경우 - 서로 위치 교환
      if (targetApp && !targetApp.isWidget) {
        const updatedApps = visibleApps.map(app => {
          if (app.isWidget) return app;

          if (app.id === draggedApp.id) {
            return {
              ...app,
              slotIndex: targetSlotIndex
            };
          } else if (app.id === targetApp.id) {
            return {
              ...app,
              slotIndex: draggedSlotIndex
            };
          }

          return app;
        });

        setVisibleApps(updatedApps);
        setActiveAppId(null);
        return;
      }

      // 빈 슬롯에 드롭한 경우 - 해당 슬롯으로 이동
      // 다른 앱과 겹치는지 체크 (자기 자신 제외)
      const hasCollision = visibleApps.some(app => {
        if (app.isWidget || app.id === draggedApp.id) return false;
        const appSlotIndex = app.slotIndex;
        return appSlotIndex !== undefined && appSlotIndex === targetSlotIndex;
      });

      // 겹치면 이동 불가
      if (hasCollision) {
        setActiveAppId(null);
        return;
      }

      // 위젯 이동
      const updatedApps = visibleApps.map(app => {
        if (app.isWidget) return app;

        if (app.id === draggedApp.id) {
          return {
            ...app,
            slotIndex: targetSlotIndex
          };
        }

        return app;
      });

      setVisibleApps(updatedApps);
      setActiveAppId(null);
      return;
    }

    // 데스크탑에서는 기존 로직 유지 (배열 순서 기반 재정렬)
    if (over && active.id !== over.id) {
      const nonWidgetApps = visibleApps.filter(app => !app.isWidget);
      const oldIndex = nonWidgetApps.findIndex((app) => app.id === active.id);
      const newIndex = nonWidgetApps.findIndex((app) => app.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedApps = arrayMove(nonWidgetApps, oldIndex, newIndex);
        // 위젯과 일반 앱을 합침 (위젯은 순서 유지)
        const widgets = visibleApps.filter(app => app.isWidget);
        setVisibleApps([...widgets, ...reorderedApps]);
      }
    }

    setActiveAppId(null);
    
    // 앱 드래그 완료 직후 클릭 이벤트 무시 (편집 모드 자동 종료 방지)
    justFinishedDrag.current = true;
    setTimeout(() => {
      justFinishedDrag.current = false;
    }, 100);
  };

  // DnD Kit 드래그 핸들러 - 위젯용
  const handleWidgetDragStart = (event: DragStartEvent) => {
    if (!isEditMode || resizingWidgetId) return; // 리사이즈 중에는 드래그 비활성화
    setActiveWidgetId(event.active.id as string);
    
    // 드래그 시작 시 위젯의 원래 크기 저장 (드래그 중 1x1 미리보기용)
    const draggedWidget = visibleApps.find(app => app.id === event.active.id);
    if (draggedWidget && draggedWidget.isWidget) {
      const deviceType = getDeviceType();
      const originalSize = getWidgetSize(draggedWidget);
      setDraggedWidgetOriginalSize(originalSize);
    }
    
    // 모바일에서 햅틱 피드백 제공 (iOS 스타일)
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    // 포인터 위치 추적 시작
    const handlePointerMove = (e: PointerEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      if (clientX !== undefined) {
        setCurrentPointerX(clientX);
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      setCurrentPointerX(e.clientX);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        setCurrentPointerX(e.touches[0].clientX);
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      
      // 드래그 종료 시 리스너 제거를 위한 저장
      pointerListenersRef.current = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchmove', handleTouchMove);
      };
    }
  };

  // 드래그 이동 핸들러 - 가장자리 감지 및 자동 페이지 전환
  const handleWidgetDragMove = useCallback((event: DragMoveEvent) => {
    if (!isEditMode || (!activeWidgetId && !activeAppId) || typeof window === 'undefined') {
      return;
    }

    // currentPointerX를 사용하여 가장자리 감지
    if (currentPointerX === null) return;
    
    const clientX = currentPointerX;

    const threshold = 50; // 가장자리 감지 영역 (px)
    const windowWidth = window.innerWidth;
    const isLeftEdge = clientX < threshold;
    const isRightEdge = clientX > windowWidth - threshold;

    const widgetsList = visibleApps.filter(app => app.isWidget || app.dockIndex === undefined);
    const deviceType = getDeviceType();

    // 가장자리 감지 - 조건 없이 무조건 페이지 전환
    if (isLeftEdge) {
      setEdgeZone('left');
      // 무조건 이전 페이지로 (0 이상으로만 제한)
      // 타이머가 없으면 첫 전환 타이머 시작
      if (!autoPageChangeTimer) {
        const timer = setTimeout(() => {
          setWidgetPage(prev => Math.max(0, prev - 1));
          // 연속 전환을 위한 타이머
          const continuousTimer = setInterval(() => {
            setWidgetPage(prev => {
              if (prev > 0) {
                return prev - 1;
              }
              clearInterval(continuousTimer);
              setContinuousPageTimer(null);
              return prev;
            });
          }, 800);
          setContinuousPageTimer(continuousTimer);
        }, 300);
        setAutoPageChangeTimer(timer);
      }
    } else if (isRightEdge) {
      setEdgeZone('right');
      // 무조건 다음 페이지로 (제한 없음, 빈 페이지도 생성)
      // 타이머가 없으면 첫 전환 타이머 시작
      if (!autoPageChangeTimer) {
        const timer = setTimeout(() => {
          setWidgetPage(prev => prev + 1);
          // 연속 전환을 위한 타이머 (제한 없이 계속)
          const continuousTimer = setInterval(() => {
            setWidgetPage(prev => prev + 1);
          }, 800);
          setContinuousPageTimer(continuousTimer);
        }, 300);
        setAutoPageChangeTimer(timer);
      }
    } else {
      // 가장자리가 아니면 타이머 정리
      if (autoPageChangeTimer) {
        clearTimeout(autoPageChangeTimer);
        setAutoPageChangeTimer(null);
      }
      if (continuousPageTimer) {
        clearInterval(continuousPageTimer);
        setContinuousPageTimer(null);
      }
      setEdgeZone(null);
    }
  }, [isEditMode, activeWidgetId, widgetPage, visibleApps, widgetGridConfig, autoPageChangeTimer, continuousPageTimer, currentPointerX]);

  const handleWidgetDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const deviceType = getDeviceType();
    
    // 드래그 종료 시 원래 크기 저장 상태 초기화
    setDraggedWidgetOriginalSize(null);
    
    // 가장자리에서 드롭된 경우 처리 (타이머 정리 전에 확인)
    const currentEdgeZone = edgeZone;
    
    // 포인터 추적 리스너 제거
    if (pointerListenersRef.current) {
      pointerListenersRef.current();
      pointerListenersRef.current = null;
    }
    setCurrentPointerX(null);
    
    // 타이머 정리
    if (autoPageChangeTimer) {
      clearTimeout(autoPageChangeTimer);
      setAutoPageChangeTimer(null);
    }
    if (continuousPageTimer) {
      clearInterval(continuousPageTimer);
      setContinuousPageTimer(null);
    }
    setEdgeZone(null);
    
    // 가장자리에서 드롭된 경우 처리
    if (!over && currentEdgeZone) {
      const draggedWidget = visibleApps.find(app => app.id === active.id);
      if (draggedWidget && draggedWidget.isWidget) {
        const pageStart = widgetPage * widgetGridConfig.widgetsPerPage;
        
        let targetSlotIndex: number;
        if (currentEdgeZone === 'left') {
          // 좌측 가장자리: 현재 페이지의 첫 번째 슬롯 (0 이상일 때만)
          if (widgetPage > 0) {
            targetSlotIndex = 0; // 현재 페이지의 첫 번째 슬롯
          } else {
            // 첫 페이지이면 현재 위치 유지
            setActiveWidgetId(null);
            return;
          }
        } else if (currentEdgeZone === 'right') {
          // 우측 가장자리: 현재 페이지의 마지막 슬롯 (무조건, 제한 없음)
          targetSlotIndex = widgetGridConfig.widgetsPerPage - 1; // 현재 페이지의 마지막 슬롯
        } else {
          setActiveWidgetId(null);
          return;
        }
        
        const globalTargetIndex = pageStart + targetSlotIndex;
        const draggedSlotIndex = draggedWidget.slotIndex;
        
        if (draggedSlotIndex !== undefined && draggedSlotIndex !== globalTargetIndex) {
          // 페이지 경계 확인
          const testWidget: App = {
            ...draggedWidget,
            slotIndex: globalTargetIndex
          };
          
          const isWithinBounds = isWidgetWithinPageBoundaries(testWidget, deviceType, widgetGridConfig);
          
          let finalSlotIndex = globalTargetIndex;
          
          if (!isWithinBounds) {
            // 페이지 경계를 넘으면 다음 페이지로 이동
            const currentPage = Math.floor(draggedSlotIndex / widgetGridConfig.widgetsPerPage);
            const moveResult = moveWidgetToNextPage(
              draggedWidget,
              currentPage,
              deviceType,
              widgetGridConfig,
              visibleApps.filter(a => a.id !== draggedWidget.id)
            );
            
            if (moveResult) {
              finalSlotIndex = moveResult.slotIndex;
              
              // 연쇄 이동된 위젯들도 함께 처리
              setVisibleApps(prev => prev.map(app => {
                const cascadedMove = moveResult.cascadedMoves.find(m => m.widget.id === app.id);
                if (cascadedMove) {
                  return {
                    ...app,
                    slotIndex: cascadedMove.newSlotIndex
                  };
                }
                return app;
              }));
            } else {
              // 다음 페이지에도 공간이 없으면 이동 불가
              setActiveWidgetId(null);
              return;
            }
          }
          
          // 위젯 이동
          const updatedApps = visibleApps.map(app => {
            if (app.id === draggedWidget.id && app.isWidget) {
              return {
                ...app,
                slotIndex: finalSlotIndex
              };
            }
            return app;
          });
          setVisibleApps(updatedApps);
        }
      }
      // 드래그 종료 후 터치 이벤트 상태 초기화 (페이지 전환 방지)
      setTouchStart(null);
      setTouchEnd(null);
      setActiveWidgetId(null);
      return;
    }
    
    if (!over) {
      // 드래그 종료 후 터치 이벤트 상태 초기화 (페이지 전환 방지)
      setTouchStart(null);
      setTouchEnd(null);
      setActiveWidgetId(null);
      return;
    }

    // 드래그한 위젯 찾기
    const draggedWidget = visibleApps.find(app => app.id === active.id);
    if (!draggedWidget || !draggedWidget.isWidget) {
      // 드래그 종료 후 터치 이벤트 상태 초기화 (페이지 전환 방지)
      setTouchStart(null);
      setTouchEnd(null);
      setActiveWidgetId(null);
      return;
    }

    // 타겟 슬롯 인덱스 추출
    let targetSlotIndex: number;
    let targetWidget: App | undefined;
    let isLocalIndex = false; // targetSlotIndex가 로컬 인덱스인지 전역 인덱스인지 표시
    
    if (typeof over.id === 'string' && over.id.startsWith('slot-')) {
      // 빈 슬롯에 드롭 - 로컬 인덱스
      targetSlotIndex = parseInt(over.id.replace('slot-', ''));
      isLocalIndex = true;
    } else {
      // 다른 위젯 위에 드롭 - 전역 인덱스
      targetWidget = visibleApps.find(app => app.id === over.id);
      if (targetWidget && targetWidget.isWidget && targetWidget.slotIndex !== undefined) {
        targetSlotIndex = targetWidget.slotIndex;
        isLocalIndex = false; // 전역 인덱스
      } else {
        // 드래그 종료 후 터치 이벤트 상태 초기화 (페이지 전환 방지)
        setTouchStart(null);
        setTouchEnd(null);
        setActiveWidgetId(null);
        return;
      }
    }

    // 현재 페이지 범위 확인
    const pageStart = widgetPage * widgetGridConfig.widgetsPerPage;
    const pageEnd = pageStart + widgetGridConfig.widgetsPerPage;
    // targetSlotIndex가 로컬 인덱스면 전역으로 변환, 전역 인덱스면 그대로 사용
    const globalTargetIndex = isLocalIndex 
      ? pageStart + targetSlotIndex
      : targetSlotIndex;

    // 같은 슬롯이면 무시
    const draggedSlotIndex = draggedWidget.slotIndex;
    if (draggedSlotIndex === undefined) {
      // 드래그 종료 후 터치 이벤트 상태 초기화 (페이지 전환 방지)
      setTouchStart(null);
      setTouchEnd(null);
      setActiveWidgetId(null);
      return;
    }
    
    if (draggedSlotIndex === globalTargetIndex) {
      // 드래그 종료 후 터치 이벤트 상태 초기화 (페이지 전환 방지)
      setTouchStart(null);
      setTouchEnd(null);
      setActiveWidgetId(null);
      return;
    }

    // 다른 위젯 위에 드롭한 경우 - 서로 위치 교환
    if (targetWidget && targetWidget.isWidget) {
      // 위치 교환 후 페이지 경계 확인
      const testDraggedWidget: App = {
        ...draggedWidget,
        slotIndex: globalTargetIndex
      };
      const testTargetWidget: App = {
        ...targetWidget,
        slotIndex: draggedSlotIndex
      };
      
      // 두 위젯 모두 페이지 경계 내에 있는지 확인
      const draggedWithinBounds = isWidgetWithinPageBoundaries(testDraggedWidget, deviceType, widgetGridConfig);
      const targetWithinBounds = isWidgetWithinPageBoundaries(testTargetWidget, deviceType, widgetGridConfig);
      
      if (draggedWithinBounds && targetWithinBounds) {
        // 둘 다 페이지 경계 내에 있으면 교환
      const updatedApps = visibleApps.map(app => {
        if (!app.isWidget) return app;
        
        if (app.id === draggedWidget.id) {
          return { 
            ...app, 
            slotIndex: globalTargetIndex 
          };
        } else if (app.id === targetWidget.id) {
          return { 
            ...app, 
            slotIndex: draggedSlotIndex 
          };
        }
        
        return app;
      });

      setVisibleApps(updatedApps);
      } else {
        // 페이지 경계를 넘으면 다음 페이지로 이동
        const draggedPage = draggedSlotIndex !== undefined 
          ? Math.floor(draggedSlotIndex / widgetGridConfig.widgetsPerPage)
          : widgetPage;
        const targetPage = Math.floor(globalTargetIndex / widgetGridConfig.widgetsPerPage);
        
        // 드래그한 위젯이 페이지 경계를 넘으면 다음 페이지로 이동
        if (!draggedWithinBounds) {
          const moveResult = moveWidgetToNextPage(
            draggedWidget,
            draggedPage,
            deviceType,
            widgetGridConfig,
            visibleApps.filter(a => a.id !== draggedWidget.id)
          );
          
          if (moveResult) {
            const updatedApps = visibleApps.map(app => {
              if (!app.isWidget) return app;
              
              // 연쇄 이동된 위젯들 처리
              const cascadedMove = moveResult.cascadedMoves.find(m => m.widget.id === app.id);
              if (cascadedMove) {
                return {
                  ...app,
                  slotIndex: cascadedMove.newSlotIndex
                };
              }
              
              if (app.id === draggedWidget.id) {
                return { 
                  ...app, 
                  slotIndex: moveResult.slotIndex 
                };
              } else if (app.id === targetWidget.id) {
                return { 
                  ...app, 
                  slotIndex: draggedSlotIndex 
                };
              }
              
              return app;
            });
            setVisibleApps(updatedApps);
          }
        } else if (!targetWithinBounds) {
          // 타겟 위젯이 페이지 경계를 넘으면 다음 페이지로 이동
          const moveResult = moveWidgetToNextPage(
            targetWidget,
            targetPage,
            deviceType,
            widgetGridConfig,
            visibleApps.filter(a => a.id !== targetWidget.id)
          );
          
          if (moveResult) {
            const updatedApps = visibleApps.map(app => {
              if (!app.isWidget) return app;
              
              // 연쇄 이동된 위젯들 처리
              const cascadedMove = moveResult.cascadedMoves.find(m => m.widget.id === app.id);
              if (cascadedMove) {
                return {
                  ...app,
                  slotIndex: cascadedMove.newSlotIndex
                };
              }
              
              if (app.id === draggedWidget.id) {
                return { 
                  ...app, 
                  slotIndex: globalTargetIndex 
                };
              } else if (app.id === targetWidget.id) {
                return { 
                  ...app, 
                  slotIndex: moveResult.slotIndex 
                };
              }
              
              return app;
            });
            setVisibleApps(updatedApps);
          }
        }
      }
      
      // 드래그 종료 후 터치 이벤트 상태 초기화 (페이지 전환 방지)
      setTouchStart(null);
      setTouchEnd(null);
      setActiveWidgetId(null);
      return;
    }

    // 빈 슬롯에 드롭한 경우 - 기존 로직 (겹침 체크 후 이동)
    const draggedOccupiedSlots = getWidgetOccupiedSlots(
      { ...draggedWidget, slotIndex: globalTargetIndex },
      deviceType,
      widgetGridConfig
    );

    // 드래그 중인 위젯의 원래 슬롯 계산 (충돌 검사에서 제외하기 위해)
    const draggedOriginalOccupiedSlots = getWidgetOccupiedSlots(
      draggedWidget,
      deviceType,
      widgetGridConfig
    );

    // 타겟 위치에 다른 위젯과 겹치는지 체크 (자기 자신 및 원래 슬롯 제외)
    const hasCollision = visibleApps.some(app => {
      if (!app.isWidget || app.id === draggedWidget.id) return false;
      const appSlotIndex = app.slotIndex;
      if (appSlotIndex === undefined) return false;
      
      const appOccupiedSlots = getWidgetOccupiedSlots(app, deviceType, widgetGridConfig);
      
      // 충돌 체크: 타겟 슬롯과 다른 위젯의 슬롯이 겹치는지 확인
      // 단, 드래그 중인 위젯의 원래 슬롯은 제외 (원래 슬롯과 겹치는 것은 정상)
      const collisionSlots = draggedOccupiedSlots.filter(slot => appOccupiedSlots.includes(slot));
      
      // 원래 슬롯이 아닌 슬롯에서만 충돌이 발생하는지 확인
      return collisionSlots.some(slot => !draggedOriginalOccupiedSlots.includes(slot));
    });

    // 겹치면 이동 불가
    if (hasCollision) {
      // 드래그 종료 후 터치 이벤트 상태 초기화 (페이지 전환 방지)
      setTouchStart(null);
      setTouchEnd(null);
      setActiveWidgetId(null);
      return;
    }

    // 위젯이 이동할 페이지 계산 (위젯의 새로운 위치 기반)
    const targetPage = Math.floor(globalTargetIndex / widgetGridConfig.widgetsPerPage);
    const draggedPage = draggedSlotIndex !== undefined 
      ? Math.floor(draggedSlotIndex / widgetGridConfig.widgetsPerPage)
      : widgetPage;
    
    // 페이지 경계 확인
    const testWidget: App = {
      ...draggedWidget,
      slotIndex: globalTargetIndex
    };
    
    const isWithinBounds = isWidgetWithinPageBoundaries(testWidget, deviceType, widgetGridConfig);
    
    let finalSlotIndex = globalTargetIndex;
    
    if (!isWithinBounds) {
      // 페이지 경계를 넘으면 다음 페이지로 이동
      const moveResult = moveWidgetToNextPage(
        draggedWidget,
        targetPage,
        deviceType,
        widgetGridConfig,
        visibleApps.filter(a => a.id !== draggedWidget.id)
      );
      
      if (moveResult) {
        finalSlotIndex = moveResult.slotIndex;
        
        // 연쇄 이동된 위젯들도 함께 처리
        setVisibleApps(prev => prev.map(app => {
          const cascadedMove = moveResult.cascadedMoves.find(m => m.widget.id === app.id);
          if (cascadedMove) {
            return {
              ...app,
              slotIndex: cascadedMove.newSlotIndex
            };
          }
          return app;
        }));
      } else {
        // 다음 페이지에도 공간이 없으면 이동 불가
        setTouchStart(null);
        setTouchEnd(null);
        setActiveWidgetId(null);
        return;
      }
    }
    
    // 모든 위젯의 슬롯 인덱스 업데이트 (디바이스별)
    const updatedApps = visibleApps.map(app => {
      if (!app.isWidget) return app;
      
      if (app.id === draggedWidget.id) {
        // 드래그한 위젯을 타겟 슬롯으로 이동
        return { 
          ...app, 
          slotIndex: finalSlotIndex 
        };
      }
      
      return app;
    });

    setVisibleApps(updatedApps);
    
    // 위젯이 같은 페이지 내에서 이동한 경우에만 현재 페이지 유지
    // 다른 페이지로 이동한 경우, 위젯이 있는 페이지로 이동하지 않음 (사용자가 수동으로 이동)
    // 같은 페이지 내에서 이동한 경우는 현재 페이지 유지
    if (targetPage === draggedPage) {
      // 같은 페이지 내 이동이므로 페이지 변경 없음
      // widgetPage는 그대로 유지
    }
    // 다른 페이지로 이동한 경우는 페이지를 자동으로 변경하지 않음
    
    // 드래그 종료 후 터치 이벤트 상태 초기화 (페이지 전환 방지)
    setTouchStart(null);
    setTouchEnd(null);
    
    setActiveWidgetId(null);
    
    // 위젯 드래그 완료 직후 클릭 이벤트 무시 (편집 모드 자동 종료 방지)
    justFinishedDrag.current = true;
    setTimeout(() => {
      justFinishedDrag.current = false;
    }, 100);
  };

  // 모바일 통합 드래그 시작: 위젯/앱 모두 처리 (도크 포함)
  const handleMobileDragStart = (event: DragStartEvent) => {
    if (!isEditMode || resizingWidgetId) return;
    const item = visibleApps.find(app => app.id === event.active.id);
    if (!item) return;

    if (item.isWidget) {
      handleWidgetDragStart(event);
      return;
    }

    setActiveAppId(item.id);
    // 모바일 햅틱
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }

    // 포인터 위치 추적 (페이지 가장자리 자동 전환용)
    const handlePointerMove = (e: PointerEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      if (clientX !== undefined) {
        setCurrentPointerX(clientX);
      }
    };
    const handleMouseMove = (e: MouseEvent) => setCurrentPointerX(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        setCurrentPointerX(e.touches[0].clientX);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      pointerListenersRef.current = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchmove', handleTouchMove);
      };
    }
  };

  // 모바일 통합 드래그 종료: 위젯은 기존 로직 재사용, 앱은 도크/그리드 간 이동 처리
  const handleMobileDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const deviceType: DeviceType = 'mobile';
    const dragged = visibleApps.find(app => app.id === active.id);

    // 포인터 리스너 해제
    if (pointerListenersRef.current) {
      pointerListenersRef.current();
      pointerListenersRef.current = null;
    }
    setCurrentPointerX(null);
    if (autoPageChangeTimer) {
      clearTimeout(autoPageChangeTimer);
      setAutoPageChangeTimer(null);
    }
    if (continuousPageTimer) {
      clearInterval(continuousPageTimer);
      setContinuousPageTimer(null);
    }
    setEdgeZone(null);

    // 위젯이면 모바일 전용 처리 (충돌 없으면 그대로 적용, 있으면 재배치)
    if (dragged && dragged.isWidget) {
      if (!over) {
        setActiveAppId(null);
        setActiveWidgetId(null);
        return;
      }
      const overId = over.id as string;
      let targetSlotIndex: number | null = null;
      if (overId.startsWith('slot-')) {
        const localIndex = parseInt(overId.replace('slot-', ''), 10);
        if (!Number.isNaN(localIndex)) {
          const pageStart = widgetPage * widgetGridConfig.widgetsPerPage;
          targetSlotIndex = pageStart + localIndex;
        }
      } else {
        const targetWidget = visibleApps.find(app => app.id === overId);
        if (targetWidget && typeof targetWidget.slotIndex === 'number') {
          targetSlotIndex = targetWidget.slotIndex;
        }
      }
      if (targetSlotIndex === null) {
        setActiveAppId(null);
        setActiveWidgetId(null);
        return;
      }

      // 충돌 검사 (위젯/앱 공통)
      const updatedWidget: App = { ...dragged, slotIndex: targetSlotIndex };
      const newOccupied = getWidgetOccupiedSlots(updatedWidget, deviceType, widgetGridConfig);
      const hasCollision = visibleApps.some(app => {
        if (app.id === updatedWidget.id) return false;
        if (app.slotIndex === undefined) return false;
        const occupied = getWidgetOccupiedSlots(app, deviceType, widgetGridConfig);
        return newOccupied.some(s => occupied.includes(s));
      });

      const withinBounds = isWidgetWithinPageBoundaries(updatedWidget, deviceType, widgetGridConfig);

      if (!hasCollision && withinBounds) {
        setVisibleApps(prev => prev.map(app => app.id === updatedWidget.id ? updatedWidget : app));
      } else {
        const dockApps = visibleApps.filter(a => !a.isWidget && typeof a.dockIndex === 'number');
        const gridItems = visibleApps
          .filter(a => a.isWidget || a.dockIndex === undefined)
          .map(item => item.id === updatedWidget.id ? updatedWidget : item);
        const packed = packMobileGridItems(gridItems);
        setVisibleApps([...dockApps, ...packed]);
      }

      setActiveAppId(null);
      setActiveWidgetId(null);
      return;
    }

    if (!dragged) {
      setActiveAppId(null);
      return;
    }

    // 앱 드래그
    if (!over) {
      setActiveAppId(null);
      return;
    }

    const overId = over.id as string;

    // 도크 드롭 (레지스트리 병합으로 icon/gradient 등 디자인 정보 보장)
    if (overId.startsWith('dock-slot-')) {
      const dockIdx = parseInt(overId.replace('dock-slot-', ''), 10);
      if (!Number.isNaN(dockIdx)) {
        const registryApp = allAvailableApps.find(a => a.id === dragged.id);
        setVisibleApps(prev => {
          const updated = prev.map(app => {
            if (app.id === dragged.id) {
              return registryApp
                ? { ...registryApp, ...app, dockIndex: dockIdx, slotIndex: undefined }
                : { ...app, dockIndex: dockIdx, slotIndex: undefined };
            }
            // 도크 충돌 시 기존 앱은 그대로 두고, 중복만 방지
            if (!app.isWidget && app.dockIndex === dockIdx && app.id !== dragged.id) {
              return { ...app, dockIndex: undefined };
            }
            return app;
          });
          return updated;
        });
      }
      setActiveAppId(null);
      return;
    }

    // 그리드 드롭
    let targetSlotIndex: number | null = null;
    if (overId.startsWith('slot-')) {
      const localIndex = parseInt(overId.replace('slot-', ''), 10);
      if (!Number.isNaN(localIndex)) {
        const pageStart = widgetPage * widgetGridConfig.widgetsPerPage;
        targetSlotIndex = pageStart + localIndex;
      }
    } else {
      const targetItem = visibleApps.find(app => app.id === overId);
      if (targetItem && typeof targetItem.slotIndex === 'number') {
        targetSlotIndex = targetItem.slotIndex;
      }
    }

    if (targetSlotIndex === null) {
      setActiveAppId(null);
      setActiveWidgetId(null);
      return;
    }

    const updatedApp: App = {
      ...dragged,
      slotIndex: targetSlotIndex,
      dockIndex: undefined,
      size: { width: 1, height: 1 },
    };
    const newOccupied = getWidgetOccupiedSlots(updatedApp, deviceType, widgetGridConfig);
    const hasCollision = visibleApps.some(app => {
      if (app.id === updatedApp.id) return false;
      if (app.slotIndex === undefined) return false;
      const occupied = getWidgetOccupiedSlots(app, deviceType, widgetGridConfig);
      return newOccupied.some(s => occupied.includes(s));
    });
    const withinBounds = isWidgetWithinPageBoundaries(updatedApp, deviceType, widgetGridConfig);

    if (!hasCollision && withinBounds) {
      setVisibleApps(prev => prev.map(app => app.id === updatedApp.id ? updatedApp : app));
    } else {
      const dockApps = visibleApps.filter(a => !a.isWidget && typeof a.dockIndex === 'number');
      const gridItems = visibleApps
        .filter(a => a.isWidget || a.dockIndex === undefined)
        .map(item => item.id === updatedApp.id ? updatedApp : item);
      const packed = packMobileGridItems(gridItems);
      setVisibleApps([...dockApps, ...packed]);
    }

    setActiveAppId(null);
    setActiveWidgetId(null);
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setActiveAppId(null);
    setActiveWidgetId(null);
  };

  // Cleanup long press timer and move listeners
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
      if (longPressMoveCleanup.current) {
        longPressMoveCleanup.current();
      }
    };
  }, []);

  // 전역 마우스/터치 이벤트 리스너 (리사이즈 중)
  useEffect(() => {
    if (!resizingWidgetId) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleResizeMove({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      handleResizeEnd();
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // 스크롤 방지
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        if (touch.clientX !== undefined && touch.clientY !== undefined) {
          handleResizeMove({ x: touch.clientX, y: touch.clientY });
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      handleResizeEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false }); // passive 제거
    window.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [resizingWidgetId, handleResizeMove, handleResizeEnd]);

  const getButtonStyle = (_hasBackgroundImage: boolean) => ({
    ...getAdaptiveGlassStyleBlur(),
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  });
  
  const getTextStyle = (_hasBackgroundImage: boolean) => {
    // QuickAccessApps is always on home view which has background image
    return { color: 'rgba(255, 255, 255)', textShadow: 'none' };
  };

  const getIconClassName = (_hasBackgroundImage: boolean) => {
    // QuickAccessApps is always on home view which has background image
    return 'text-white';
  };

  // 위젯 컨텐츠 렌더링 헬퍼
  const renderWidgetContent = (widget: App, hasBackgroundImage: boolean, isFullscreen = false) => {
    const commonProps = {
      isDarkMode,
      isBackgroundDark: hasBackgroundImage,
      isEditMode,
      widgetId: widget.id, // Pass widget ID for automatic style mode determination
      isFullscreen,
    };
    const C = WIDGET_COMPONENTS[widget.id];
    if (!C) return null;
    if (widget.id === 'glass-trends-widget' && onPromptClick) {
      return <C {...commonProps} onPromptClick={onPromptClick} />;
    }
    if (widget.id === 'onthisday-widget' && onPromptClick) {
      return <C {...commonProps} onPromptClick={onPromptClick} isFullscreen={isFullscreen} />;
    }
    return <C {...commonProps} />;
  };

  return (
    <>
      {/* Edit mode overlay - click to exit - MUST be behind the apps */}
      {isEditMode && (
        <div 
          className="fixed inset-0 z-5"
          onClick={exitEditMode}
        />
      )}
      
      <div className="quick-access-no-callout w-full h-full mx-auto relative z-15 px-4 sm:px-8 flex flex-col" onClick={handleBackgroundClick}>
        {/* Widgets Section - 반응형 그리드 */}
        {onPromptClick && (getDeviceType() !== 'desktop' || visibleApps.filter(app => app.isWidget).length > 0) && (() => {
    const widgetsList = visibleApps.filter(app => app.isWidget || app.dockIndex === undefined);
    const gridApps = visibleApps.filter(app => !app.isWidget && app.dockIndex === undefined);
    const dockApps = visibleApps.filter(app => !app.isWidget && typeof app.dockIndex === 'number');
          
          // Calculate total pages based on maximum slotIndex (디바이스별)
          // 위젯이 확대되었을 때 차지하는 모든 슬롯 중 최대값 고려
          const deviceType = getDeviceType();
          let maxSlotIndex = -1;
          widgetsList.forEach(widget => {
            const slotIndex = widget.slotIndex;
            if (slotIndex !== undefined) {
              // 위젯이 차지하는 모든 슬롯 계산
              const occupied = getWidgetOccupiedSlots(widget, deviceType, widgetGridConfig);
              if (occupied.length > 0) {
                // 위젯이 차지하는 슬롯 중 최대값
                const maxOccupied = Math.max(...occupied);
                maxSlotIndex = Math.max(maxSlotIndex, maxOccupied);
              } else {
                // occupied가 없으면 기본 slotIndex 사용
                maxSlotIndex = Math.max(maxSlotIndex, slotIndex);
              }
            }
          });

          const totalPages = maxSlotIndex >= 0 
            ? Math.floor(maxSlotIndex / widgetGridConfig.widgetsPerPage) + 1 
            : 0;
            
          const { columns, rows, widgetsPerPage } = widgetGridConfig;
          
          const isMobileOrTablet = deviceType !== 'desktop';
          
          return (
            <div 
              className={`flex-1 flex flex-col ${isMobileOrTablet ? 'mb-0' : 'mb-6'} ${isEditMode ? 'quick-access-edit-mode' : ''}`}
              style={{
                paddingTop: isMobileOrTablet ? '0px' : '8px' // 최소 여백만 유지 (헤더는 별도 레이어)
              }}
            >
              <div className="flex-1 flex flex-col relative">
                {/* Navigation Arrows - 데스크탑에서만 표시 (터치 디바이스는 스와이프 사용) */}
                {totalPages > 1 && deviceType === 'desktop' && (
                  <>
                    {/* Left Arrow */}
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setWidgetPage(prev => (prev - 1 + totalPages) % totalPages); 
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full cursor-pointer"
                      style={getAdaptiveGlassStyleBlur()}
                    >
                      <ChevronLeft size={24} className="text-white" />
                    </button>
                    
                    {/* Right Arrow */}
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setWidgetPage(prev => (prev + 1) % totalPages); 
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full cursor-pointer"
                      style={getAdaptiveGlassStyleBlur()}
                    >
                      <ChevronRight size={24} className="text-white" />
                    </button>
                  </>
                )}
                {/* 반응형 그리드 컨테이너 - DnD로 위젯 정렬 */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={widgetCollisionDetection}
                  onDragStart={isMobileOrTablet ? handleMobileDragStart : handleWidgetDragStart}
                  onDragMove={handleWidgetDragMove}
                  onDragEnd={isMobileOrTablet ? handleMobileDragEnd : handleWidgetDragEnd}
                >
                  <div 
                    className="flex-1 flex flex-col px-4 sm:px-12" 
                    onClick={handleBackgroundClick}
                  >
                    <SortableContext
                      items={[
                        ...widgetsList.map(w => w.id),
                        ...gridApps.map(a => a.id),
                        ...Array.from({ length: widgetsPerPage }, (_, i) => `slot-${i}`),
                        ...dockApps.map(a => a.id),
                        ...Array.from({ length: 4 }, (_, i) => `dock-slot-${i}`),
                      ]}
                      strategy={rectSortingStrategy}
                    >
                      <div 
                        className="flex-1 grid content-start" 
                        style={{ 
                          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                          // 모바일/태블릿: 12px (모바일) 또는 16px (태블릿), 데스크탑: 예전 로직 (16px 또는 28px)
                          gap: (() => {
                            if (deviceType === 'mobile') return '28px'; // gap-7 - 그리드 간격 추가 확대 (24 -> 28)
                            if (deviceType === 'tablet') return '16px'; // 태블릿은 약간 더 넓은 간격
                            // 데스크탑: 예전 로직 (16px 또는 28px)
                            if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                              return '28px'; // 예전 로직
                            }
                            return '16px'; // 예전 로직
                          })(),
                          // 모바일/태블릿: gridTemplateRows 사용, 데스크탑: gridAutoRows 사용 (예전 로직)
                          ...(isMobileOrTablet 
                            ? {
                                // 각 행의 높이 = 셀 크기 + 라벨 높이 (제목 영역 확보)
                                gridTemplateRows: `repeat(${rows}, ${(widgetGridConfig.cellSize || 86) + (widgetGridConfig.labelHeight || 12)}px)`,
                                maxHeight: `calc(${rows} * ${(widgetGridConfig.cellSize || 86) + (widgetGridConfig.labelHeight || 12)}px + ${rows - 1} * ${deviceType === 'tablet' ? 16 : 28}px)`, // 간격 반영 (모바일 24 -> 28)
                                // overflow: 'hidden', // flex-1 활용을 위해 overflow hidden 제거
                              }
                            : {
                                gridAutoRows: '180px', // 예전 로직
                          minHeight: (() => {
                                  const gapSize = typeof window !== 'undefined' && window.innerWidth >= 1024 ? 28 : 16;
                                  return `${rows * 180 + (rows - 1) * gapSize}px`;
                                })(),
                              }
                          ),
                        }}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                      >
                        {/* 슬롯 기반 렌더링 - 각 슬롯마다 위젯 찾기 (디바이스별) */}
                        {(() => {
                          const gridItems = widgetsList; // widgetsList already contains apps where dockIndex is undefined
                          const allOccupiedSlots = new Set<number>();
                          const itemBySlot = new Map<number, App>();
                          const itemOccupiedMap = new Map<App, number[]>();
                          const pageStart = widgetPage * widgetsPerPage;
                          const pageEnd = pageStart + widgetsPerPage;
                          let draggedOriginalSlots: Set<number> = new Set();

                          const draggedId = activeWidgetId || activeAppId;
                          if (draggedId) {
                            const draggedItem = gridItems.find(w => w.id === draggedId);
                            if (draggedItem) {
                              getWidgetOccupiedSlots(draggedItem, deviceType, widgetGridConfig).forEach(s => draggedOriginalSlots.add(s));
                            }
                          }

                          gridItems.forEach(item => {
                            const slotIdx = item.slotIndex;
                            if (slotIdx === undefined) return;
                            const isDragging = item.id === draggedId;
                            const occupied = getWidgetOccupiedSlots(item, deviceType, widgetGridConfig);
                            itemOccupiedMap.set(item, occupied);

                              const occupiedInPage = occupied.filter(slot => slot >= pageStart && slot < pageEnd);
                              
                              if (occupiedInPage.length > 0) {
                              if (!isDragging) {
                                occupied.forEach(slot => allOccupiedSlots.add(slot));
                                  if (slotIdx >= pageStart && slotIdx < pageEnd) {
                                  itemBySlot.set(slotIdx, item);
                                } else {
                                  itemBySlot.set(occupiedInPage[0], item);
                                }
                              }
                            }
                          });
                          
                          return Array.from({ length: widgetsPerPage }).map((_, slotIndex) => {
                            const globalSlotIndex = widgetPage * widgetsPerPage + slotIndex;
                            const slotId = `slot-${slotIndex}`;
                            
                            let item = itemBySlot.get(globalSlotIndex);
                            if (!item) {
                              for (const [w] of itemOccupiedMap.entries()) {
                                if (w.id === draggedId) continue;
                                const slotIdx = w.slotIndex;
                                if (slotIdx === globalSlotIndex) {
                                  item = w;
                                  itemBySlot.set(globalSlotIndex, w);
                                  break;
                                }
                              }
                            }
                            
                            if (item) {
                              const isDragging = item.id === draggedId;
                              const isResizingThis = item.isWidget && resizingWidgetId === item.id;

                              if (isDragging) {
                                const size = item.isWidget ? getWidgetSize(item) : { width: 1, height: 1 };
                                return item.isWidget ? (
                                  <SortableWidgetItem
                                    key={item.id}
                                    widget={item}
                                    slotId={slotId}
                                    isEditMode={isEditMode}
                                    isDarkMode={isDarkMode}
                                    isRemoving={false}
                                    onDeleteWidget={() => {}}
                                    handleContextMenu={handleContextMenu}
                                    handleLongPressStart={handleLongPressStart}
                                    handleLongPressEnd={handleLongPressEnd}
                                    renderWidgetContent={renderWidgetContent}
                                    widgetSize={size}
                                    widgetGridColumns={columns}
                                    onResizeStart={undefined}
                                    onResizeMove={undefined}
                                    onResizeEnd={undefined}
                                    isResizing={false}
                                    hasResizeMovement={false}
                                    resizeStyles={undefined}
                                    justEnteredEditModeFromWidget={() => false}
                                    isTouchDevice={isTouchDevice}
                                    onWidgetActivate={handleVisionWidgetActivate}
                                  />
                                ) : (
                                  <SortableAppItem
                                    key={item.id}
                                    app={item}
                                    isEditMode={isEditMode}
                                    isDarkMode={isDarkMode}
                                    isRemoving={removingAppId === item.id}
                                    shouldShowBadge={item.id === 'whats-new' && showBadge && badgeReady}
                                    newUpdatesCount={newUpdatesCount}
                                    onAppClick={handleAppClick}
                                    onDeleteApp={handleDeleteApp}
                                    handleLongPressStart={handleLongPressStart}
                                    handleLongPressEnd={handleLongPressEnd}
                                    getButtonStyle={getButtonStyle}
                                    getTextStyle={getTextStyle}
                                    getIconClassName={getIconClassName}
                                    onRefReady={handleOnboardingRefReady}
                                    isTouchDevice={isTouchDevice}
                                    deviceType={deviceType}
                                  />
                                );
                              }

                              if (item.isWidget) {
                                const size = isMobileOrTablet
                                  ? { width: 4, height: 2 }
                                  : (isResizingThis && resizeStartSize ? resizeStartSize : getWidgetSize(item));
                                const resizeProps = isMobileOrTablet
                                  ? {
                                      onResizeStart: undefined,
                                      onResizeMove: undefined,
                                      onResizeEnd: undefined,
                                      isResizing: false,
                                      hasResizeMovement: false,
                                      resizeStyles: undefined,
                                    }
                                  : {
                                      onResizeStart: handleResizeStart,
                                      onResizeMove: handleResizeMove,
                                      onResizeEnd: handleResizeEnd,
                                      isResizing: isResizingThis,
                                      hasResizeMovement: hasResizeMovement,
                                      resizeStyles: isResizingThis && resizePreview && hasResizeMovement
                                        ? {
                                            width: (resizeDirection?.includes('w') || resizeDirection?.includes('e'))
                                              ? resizePreview.pixelWidth
                                              : undefined,
                                            height: (resizeDirection?.includes('n') || resizeDirection?.includes('s'))
                                              ? resizePreview.pixelHeight
                                              : undefined,
                                            transform: '',
                                            ...getResizeAlignment(resizeDirection),
                                          }
                                        : undefined,
                                    };
                              return (
                                <SortableWidgetItem
                                    key={item.id}
                                    widget={item}
                                  slotId={slotId}
                                  isEditMode={isEditMode}
                                  isDarkMode={isDarkMode}
                                    isRemoving={removingAppId === item.id}
                                  onDeleteWidget={(widgetId) => {
                                    setRemovingAppId(widgetId);
                                    setTimeout(() => {
                                      setVisibleApps(prev => prev.filter(app => app.id !== widgetId));
                                      setRemovingAppId(null);
                                    }, 0);
                                  }}
                                  handleContextMenu={handleContextMenu}
                                  handleLongPressStart={handleLongPressStart}
                                  handleLongPressEnd={handleLongPressEnd}
                                  renderWidgetContent={renderWidgetContent}
                                  widgetSize={size}
                                  widgetGridColumns={columns}
                                  onResizeStart={resizeProps.onResizeStart}
                                  onResizeMove={resizeProps.onResizeMove}
                                  onResizeEnd={resizeProps.onResizeEnd}
                                  isResizing={resizeProps.isResizing}
                                  hasResizeMovement={resizeProps.hasResizeMovement}
                                  resizeStyles={resizeProps.resizeStyles}
                                  justEnteredEditModeFromWidget={() => justEnteredEditModeFromWidget.current}
                                  isTouchDevice={isTouchDevice}
                                  onWidgetActivate={handleVisionWidgetActivate}
                                />
                              );
                              }

                              // 앱 그리드 내 렌더
                              return (
                                <SortableAppItem
                                  key={item.id}
                                  app={item}
                                  isEditMode={isEditMode}
                                  isDarkMode={isDarkMode}
                                  isRemoving={removingAppId === item.id}
                                  shouldShowBadge={item.id === 'whats-new' && showBadge && badgeReady}
                                  newUpdatesCount={newUpdatesCount}
                                  onAppClick={handleAppClick}
                                  onDeleteApp={handleDeleteApp}
                                  handleLongPressStart={handleLongPressStart}
                                  handleLongPressEnd={handleLongPressEnd}
                                  getButtonStyle={getButtonStyle}
                                  getTextStyle={getTextStyle}
                                  getIconClassName={getIconClassName}
                                  onRefReady={handleOnboardingRefReady}
                                  isTouchDevice={isTouchDevice}
                                  deviceType={deviceType}
                                />
                              );
                            } else if (!allOccupiedSlots.has(globalSlotIndex) || draggedOriginalSlots.has(globalSlotIndex)) {
                              return (
                                <EmptySlot
                                  key={slotId}
                                  slotId={slotId}
                                  isEditMode={isEditMode}
                                  handleContextMenu={handleContextMenu}
                                  cellSize={deviceType === 'mobile' ? widgetGridConfig.cellSize : undefined}
                                />
                              );
                            } else {
                              return null;
                            }
                          });
                        })()}
                      </div>
                    </SortableContext>
                  </div>

                  {/* Page Indicators (Mobile/Tablet) - 그리드와 도크 사이에 배치 */}
                  {isMobileOrTablet && widgetsList.length > 0 && (
                    <div className="flex justify-center items-center gap-2 mb-3 mt-0">
                      {Array.from({ length: Math.max(totalPages, 1) }).map((_, index) => (
                        <button
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation();
                            setWidgetPage(index);
                          }}
                          className={`transition-all duration-200 rounded-full ${
                            widgetPage === index
                              ? 'w-2 h-2 bg-white/90 dark:bg-white/90'
                              : 'w-1.5 h-1.5 bg-white/30 dark:bg-white/30 hover:bg-white/50 dark:hover:bg-white/50'
                          }`}
                          aria-label={`Go to page ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* 도크 영역 (모바일/태블릿 전용 4칸) */}
                  {isMobileOrTablet && (
                    <div className="mt-auto mb-4 flex justify-center">
                      <div 
                        className="px-4 py-3 rounded-3xl"
                        style={getAdaptiveGlassStyleBlur()}
                      >
                        <div 
                          className={`grid grid-cols-4 gap-3 ${isEditMode ? 'quick-access-edit-mode' : ''}`}
                          style={{ gridAutoRows: '64px' }}
                        >
                        {Array.from({ length: 4 }).map((_, dockIdx) => {
                          const slotId = `dock-slot-${dockIdx}`;
                          const dockApp = dockApps.find(app => app.dockIndex === dockIdx);
                          if (dockApp) {
                            return (
                              <SortableAppItem
                                key={dockApp.id}
                                app={dockApp}
                                isEditMode={isEditMode}
                                isDarkMode={isDarkMode}
                                isRemoving={removingAppId === dockApp.id}
                                shouldShowBadge={dockApp.id === 'whats-new' && showBadge && badgeReady}
                                newUpdatesCount={newUpdatesCount}
                                onAppClick={handleAppClick}
                                onDeleteApp={handleDeleteApp}
                                handleLongPressStart={handleLongPressStart}
                                handleLongPressEnd={handleLongPressEnd}
                                getButtonStyle={getButtonStyle}
                                getTextStyle={getTextStyle}
                                getIconClassName={getIconClassName}
                                onRefReady={handleOnboardingRefReady}
                                isTouchDevice={isTouchDevice}
                                isDock={true}
                                deviceType={deviceType}
                              />
                            );
                          }
                          return (
                            <EmptySlot
                              key={slotId}
                              slotId={slotId}
                              isEditMode={isEditMode}
                              handleContextMenu={handleContextMenu}
                              isAppSlot={true}
                            />
                          );
                        })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Page Indicators (Desktop) - 데스크탑에서만 표시 */}
                  {deviceType === 'desktop' && widgetsList.length > 0 && (
                    <div className="flex justify-center items-center gap-3 mt-10">
                      {Array.from({ length: Math.max(totalPages, 1) }).map((_, index) => (
                        <button
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation();
                            setWidgetPage(index);
                          }}
                          className={`transition-all duration-200 rounded-full ${
                            widgetPage === index
                              ? 'w-2.5 h-2.5 bg-white/90 dark:bg-white/90'
                              : 'w-2 h-2 bg-white/30 dark:bg-white/30 hover:bg-white/50 dark:hover:bg-white/50'
                          }`}
                          aria-label={`Go to page ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Drag Overlay - 위젯 드래그 중 표시 */}
                  <DragOverlay>
                    {activeWidgetId ? (() => {
                      const widget = widgetsList.find(w => w.id === activeWidgetId);
                      if (!widget) return null;
                      
                      // 데스크탑에서는 드래그 중 1x1로 표시, 모바일/태블릿은 원래 크기 유지
                      const displaySize = deviceType === 'desktop' && draggedWidgetOriginalSize
                        ? { width: 1, height: 1 } // 예전 로직
                        : getWidgetSize(widget);
                      
                      // 모바일/태블릿: 앱 그리드 기준 계산, 데스크탑: 예전 로직 (rowHeight = 180)
                      const rowHeight = isMobileOrTablet ? 86 : 180; // 모바일/태블릿: APP_CELL_HEIGHT, 데스크탑: 예전 로직
                      const gapSize = isMobileOrTablet 
                        ? (deviceType === 'tablet' ? 16 : 12)  // 태블릿: 16px, 모바일: 12px (gap-3)
                        : (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 28 : 16); // 예전 로직
                      
                      // 실제 위젯 높이 계산
                      const widgetHeight = displaySize.height * rowHeight + (displaySize.height - 1) * gapSize;
                      
                      // 실제 위젯 너비 계산 (그리드 컨테이너 기준)
                      const horizontalPadding = isMobileOrTablet ? 48 : 96;
                      const availableWidth = typeof window !== 'undefined' ? window.innerWidth - horizontalPadding : 800;
                      const cellWidth = (availableWidth - (columns - 1) * gapSize) / columns;
                      const widgetWidth = displaySize.width * cellWidth + (displaySize.width - 1) * gapSize;
                      
                      return (
                        <div 
                          className="opacity-90 cursor-grabbing" 
                          style={{ 
                            height: `${widgetHeight}px`, 
                            width: `${widgetWidth}px`,
                            minHeight: `${widgetHeight}px`,
                            minWidth: `${widgetWidth}px`
                          }}
                        >
                          <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
                            {renderWidgetContent(widget, hasBackgroundImage)}
                          </div>
                        </div>
                      );
                    })() : activeAppId && isMobileOrTablet ? (() => {
                      const app = visibleApps.find(a => a.id === activeAppId && !a.isWidget);
                      if (!app) return null;
                      const Icon = app.icon;
                      return (
                        <div className="flex flex-col items-center relative opacity-90 cursor-grabbing">
                          <div
                            className="w-16 h-16 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl shadow-2xl"
                            style={getButtonStyle(hasBackgroundImage)}
                          >
                            <Icon
                              className={`${
                                app.isCustomIcon ? 'w-7 h-7 sm:w-7 sm:h-7' : 'w-9 h-9 sm:w-9 sm:h-9'
                              } ${getIconClassName(hasBackgroundImage)}`}
                            />
                          </div>
                          <span
                            className="text-xs sm:text-xs font-bold mt-1"
                            style={getTextStyle(hasBackgroundImage)}
                          >
                            {app.label}
                          </span>
                        </div>
                      );
                    })() : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          );
        })()}

        {/* Apps Grid - 데스크탑에서만 표시 (모바일/태블릿은 위젯 그리드 내에서 도크로 렌더링) */}
        {getDeviceType() !== 'desktop' ? null : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleAppDragStart}
          onDragEnd={handleAppDragEnd}
        >
          <SortableContext
            items={(() => {
              const nonWidgetApps = visibleApps.filter(app => !app.isWidget);
              // 데스크탑: 모든 앱을 items에 포함
              return nonWidgetApps.map(app => app.id);
            })()}
            strategy={rectSortingStrategy}
          >
            {(() => {
              const deviceType = getDeviceType();
              const nonWidgetApps = visibleApps.filter(app => !app.isWidget);
              
              // 모바일/태블릿은 이 분기에 도달하지 않음 (위에서 null 반환)
              if (deviceType !== 'desktop') {
                // 슬롯 수 동적 계산: 4개 이하면 4개 슬롯(1행), 5개 이상이면 8개 슬롯(2행)
                const appCount = nonWidgetApps.length; // add-app 제외한 실제 앱 개수
                const slotCount = appCount <= 4 ? 4 : 8;
                
                // 드래그 중인 앱의 원래 슬롯 추적 (다른 앱 위치 고정을 위해)
                let draggedAppOriginalSlot: number | null = null;
                if (activeAppId) {
                  const draggedApp = nonWidgetApps.find(a => a.id === activeAppId);
                  if (draggedApp) {
                    draggedAppOriginalSlot = draggedApp.slotIndex ?? null;
                  }
                }
                
                return (
                  <div
                    className={`grid grid-cols-4 gap-1 ${isEditMode ? 'quick-access-edit-mode' : ''}`}
                    onContextMenu={handleContextMenu}
                    onClick={handleBackgroundClick}
                  >
                    {Array.from({ length: slotCount }).map((_, slotIndex) => {
                      const slotId = `slot-${slotIndex}`;
                      
                      // 드래그 중인 앱의 원래 슬롯은 빈 슬롯으로 표시 (다른 앱이 그 자리를 차지하지 않도록)
                      if (draggedAppOriginalSlot === slotIndex) {
                        return (
                          <EmptySlot
                            key={slotId}
                            slotId={slotId}
                            isEditMode={isEditMode}
                            handleContextMenu={handleContextMenu}
                            isAppSlot={true}
                          />
                        );
                      }
                      
                      // 다른 앱 렌더링 (드래그 중인 앱 제외)
                      const app = nonWidgetApps.find(a => 
                        a.slotIndex === slotIndex && a.id !== activeAppId
                      );
                      
                      if (app) {
                        const isRemoving = removingAppId === app.id;
                        const shouldShowBadge = app.id === 'whats-new' && showBadge && badgeReady;
                        
                        return (
                          <SortableAppItem
                            key={app.id}
                            app={app}
                            isEditMode={isEditMode}
                            isDarkMode={isDarkMode}
                            isRemoving={isRemoving}
                            shouldShowBadge={shouldShowBadge}
                            newUpdatesCount={newUpdatesCount}
                            onAppClick={handleAppClick}
                            onDeleteApp={handleDeleteApp}
                            handleLongPressStart={handleLongPressStart}
                            handleLongPressEnd={handleLongPressEnd}
                            getButtonStyle={getButtonStyle}
                            getTextStyle={getTextStyle}
                            getIconClassName={getIconClassName}
                            onRefReady={handleOnboardingRefReady}
                            isTouchDevice={isTouchDevice}
                            isDock={true}
                            deviceType={deviceType}
                          />
                        );
                      } else {
                        // 일반 빈 슬롯
                        return (
                          <EmptySlot
                            key={slotId}
                            slotId={slotId}
                            isEditMode={isEditMode}
                            handleContextMenu={handleContextMenu}
                            isAppSlot={true}
                          />
                        );
                      }
                    })}
                  </div>
                );
              }
              
              // 데스크탑: Flexbox를 사용하여 자동 중앙 정렬 (짝수 개수도 완벽하게 중앙 정렬)
              // 도커 너비 고정: 앱 개수에 따라 계산 (아이콘 64px + gap + padding)
              const appCount = nonWidgetApps.length;
              const iconSize = 64; // w-16 h-16
              const gap = 16; // gap-4
              const padding = 16; // px-4 양쪽
              const minDockWidth = appCount > 0 
                ? appCount * iconSize + (appCount - 1) * gap + padding * 2
                : iconSize + padding * 2;
              
              return (
                <div className="flex justify-center">
                  <div
                    className={`flex flex-nowrap justify-center gap-4 px-4 py-3 rounded-3xl ${isEditMode ? 'quick-access-edit-mode' : ''}`}
                    style={{
                      ...getAdaptiveGlassStyleBlur(),
                      width: `${minDockWidth}px`,
                      minWidth: `${minDockWidth}px`,
                      maxWidth: `${minDockWidth}px`,
                    }}
                    onContextMenu={handleContextMenu}
                    onClick={handleBackgroundClick}
                  >
                    {/* 앱들 렌더링 */}
                    {nonWidgetApps.map((app) => {
                    const isRemoving = removingAppId === app.id;
                    const shouldShowBadge = app.id === 'whats-new' && showBadge && badgeReady;
                    
                    return (
                      <React.Fragment key={app.id}>
                        <SortableAppItem
                          app={app}
                          isEditMode={isEditMode}
                          isDarkMode={isDarkMode}
                          isRemoving={isRemoving}
                          shouldShowBadge={shouldShowBadge}
                          newUpdatesCount={newUpdatesCount}
                          onAppClick={handleAppClick}
                          onDeleteApp={handleDeleteApp}
                          handleLongPressStart={handleLongPressStart}
                          handleLongPressEnd={handleLongPressEnd}
                          getButtonStyle={getButtonStyle}
                          getTextStyle={getTextStyle}
                          getIconClassName={getIconClassName}
                          onRefReady={handleOnboardingRefReady}
                          isTouchDevice={isTouchDevice}
                          isDock={true}
                          deviceType={deviceType}
                        />
                      </React.Fragment>
                    );
                  })}
                  </div>
                </div>
              );
            })()}
          </SortableContext>

          {/* Centralized Onboarding Renderer for add-app */}
          <OnboardingRenderer
            location="quick-access"
            context={{ appId: 'add-app' }}
            target={onboardingTooltipTargetsRef.current}
            hideWhen={isEditMode}
            displayTypes={['tooltip']}
          />

          {/* Drag Overlay - 앱 드래그 중 표시 */}
          <DragOverlay>
            {activeAppId ? (
              (() => {
                const app = visibleApps.find(a => a.id === activeAppId);
                if (!app) return null;
                const Icon = app.icon;
                return (
                  <div className="flex flex-col items-center relative opacity-90 cursor-grabbing">
                    <div
                      className="w-16 h-16 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl shadow-2xl"
                      style={getButtonStyle(hasBackgroundImage)}
                    >
                      <Icon
                        className={`${
                          app.isCustomIcon ? 'w-7 h-7 sm:w-7 sm:h-7' : 'w-9 h-9 sm:w-9 sm:h-9'
                        } ${getIconClassName(hasBackgroundImage)}`}
                      />
                    </div>
                      <span
                        className="text-xs sm:text-xs font-bold mt-1"
                        style={getTextStyle(hasBackgroundImage)}
                      >
                      {app.label}
                    </span>
                  </div>
                );
              })()
            ) : null}
          </DragOverlay>
        </DndContext>
        )}
    </div>

      {/* App Selection Modal */}
      <AppSelectionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        availableApps={allAvailableApps.filter(app => app.id !== 'add-app')}
        visibleApps={visibleApps}
        onAddApp={handleAddApp}
        onRemoveApp={handleDeleteApp}
        onAddMultipleApps={handleAddMultipleApps}
        onRemoveMultipleApps={handleRemoveMultipleApps}
        isDarkMode={isDarkMode}
        user={user}
        onPromptClick={onPromptClick}
      />
      {fullscreenWidget && (
        <VisionWidgetOverlay
          widget={fullscreenWidget}
          onClose={closeFullscreenWidget}
          renderWidgetContent={renderWidgetContent}
        />
      )}
      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        onClose={() => setIsSettingsPanelOpen(false)}
        user={user}
      />
    </>
  );
}







