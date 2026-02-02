// Shared constants for Quick Access Apps
// Keep this file framework-agnostic (no React/DOM imports)

export type StoredApp = string | { id: string; slotIndex?: number; dockIndex?: number; size?: { width: number; height: number } };

export const DEFAULT_QUICK_ACCESS_APPS: string[] = [
  'add-app',
  'messages',
  'photos',
  'settings',
];

export const DEFAULT_QUICK_ACCESS_APPS_DESKTOP: StoredApp[] = [
  { id: 'add-app' },
  { id: 'messages' },
  { id: 'photos' },
  { id: 'settings' },
  { id: 'glass-trends-widget', size: { width: 2, height: 3 }, slotIndex: 1 },
];

export const DEFAULT_QUICK_ACCESS_APPS_MOBILE: StoredApp[] = [
  // 도크(4칸 고정)
  { id: 'add-app', dockIndex: 0 },
  { id: 'messages', dockIndex: 1 },
  { id: 'photos', dockIndex: 2 },
  { id: 'settings', dockIndex: 3 },
  // 위젯/그리드 영역: 트렌딩 위젯 + 농담 위젯 두 개
  { id: 'glass-trends-widget', size: { width: 4, height: 2 }, slotIndex: 0 },
  { id: 'daily-joke-widget', size: { width: 4, height: 2 }, slotIndex: 1 },
];

export const DEFAULT_QUICK_ACCESS_APPS_TABLET: StoredApp[] = [
  // 도크(4칸 고정) - iOS 스타일
  { id: 'add-app', dockIndex: 0 },
  { id: 'messages', dockIndex: 1 },
  { id: 'photos', dockIndex: 2 },
  { id: 'settings', dockIndex: 3 },

  // 위젯/그리드 영역 - iPad 화면에 맞게 최적화된 위젯 배치
  // 태블릿 기본: 트렌드 위젯(6x4)
  { id: 'glass-trends-widget', size: { width: 6, height: 4 }, slotIndex: 1 },
];

export const VALID_APP_IDS: string[] = [
  'add-app',
  'messages',
  'memory',
  'photos',
  'pensieve',
  'settings',
  'trending',
  'onthisday-widget',
  'random-fact-widget',
  'daily-joke-widget',
  'glass-trends-widget',
];


