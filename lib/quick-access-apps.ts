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
];

export const DEFAULT_QUICK_ACCESS_APPS_MOBILE: StoredApp[] = [
  // 도크(4칸 고정)
  { id: 'add-app', dockIndex: 0 },
  { id: 'messages', dockIndex: 1 },
  { id: 'photos', dockIndex: 2 },
  { id: 'settings', dockIndex: 3 },
];

export const DEFAULT_QUICK_ACCESS_APPS_TABLET: StoredApp[] = [
  // 도크(4칸 고정) - iOS 스타일
  { id: 'add-app', dockIndex: 0 },
  { id: 'messages', dockIndex: 1 },
  { id: 'photos', dockIndex: 2 },
  { id: 'settings', dockIndex: 3 },
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


